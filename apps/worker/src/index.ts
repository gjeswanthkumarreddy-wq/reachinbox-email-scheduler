import "dotenv/config";
import Redis from "ioredis";
import { Worker, DelayedError } from "bullmq";
import { CONSTANTS, EmailJobPayload } from "@reachinbox/shared";
import { pool } from "./db";
import { sendEmail } from "./mailer";
import { indexEmailJob } from "./es";

// ── Redis ─────────────────────────────────────────────────────────────────────
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on("ready", () => console.log("[Worker] Redis connected"));
redis.on("error", (e) => console.error("[Worker] Redis error:", e.message));

// ── Atomic Fixed-Hourly-Window Rate-Limit Lua Script ─────────────────────────
//
// Key:   rl:campaign:{campaignId}:{YYYY-MM-DD-HH}  (UTC)
// Logic: INCR; set EXPIREAT to next clock-hour boundary +1s on first write;
//        if counter > limit, DECR and return 0 (denied); else return 1 (allowed)
const RATE_LIMIT_LUA = `
local key     = KEYS[1]
local limit   = tonumber(ARGV[1])
local expiry  = tonumber(ARGV[2])

local current = redis.call("INCR", key)
if current == 1 then
  redis.call("EXPIREAT", key, expiry)
end
if current > limit then
  redis.call("DECR", key)
  return 0
end
return 1
`;

async function checkRateLimit(
  prefix: string,
  hourlyLimit: number
): Promise<boolean> {
  const now = new Date();
  const hourKey = `${prefix}:${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}-${String(now.getUTCHours()).padStart(2, "0")}`;
  const nextHour = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() + 1)
  );
  const expirySec = Math.floor(nextHour.getTime() / 1000) + 1;

  const result = await redis.eval(
    RATE_LIMIT_LUA,
    1,
    hourKey,
    String(hourlyLimit),
    String(expirySec)
  );
  return result === 1;
}

function msUntilNextHour(): number {
  const now = new Date();
  const nextHour = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() + 1)
  );
  return nextHour.getTime() - Date.now() + CONSTANTS.RATE_LIMIT_RESCHEDULE_BUFFER_MS;
}

// ── Job processor ─────────────────────────────────────────────────────────────
async function processJob(job: import("bullmq").Job<EmailJobPayload>): Promise<Record<string, unknown>> {
  const p = job.data;
  const dbClient = await pool.connect();

  try {
    // ── 1. Atomic claim: queued | rate_limited, OR stale processing ──────────
    const claimRes = await dbClient.query<{ id: string; status: string }>(
      `UPDATE email_jobs
       SET status = 'processing', updated_at = NOW()
       WHERE id = $1
         AND (
           status IN ('queued', 'rate_limited')
           OR (
             status = 'processing'
             AND updated_at < NOW() - INTERVAL '${CONSTANTS.STALE_PROCESSING_THRESHOLD_SECONDS} seconds'
           )
         )
       RETURNING id, status`,
      [p.emailJobId]
    );

    if (claimRes.rows.length === 0) {
      // Check if already sent (idempotency fast-path)
      const check = await dbClient.query<{ status: string }>(
        "SELECT status FROM email_jobs WHERE id = $1",
        [p.emailJobId]
      );
      if (check.rows[0]?.status === "sent") {
        console.log(`[Worker] Job ${p.emailJobId} already sent — skipping`);
        return { skipped: true };
      }
      throw new Error(`Cannot claim job ${p.emailJobId} (status: ${check.rows[0]?.status})`);
    }

    // ── 2. Fixed hourly rate limit ────────────────────────────────────────────
    const allowed = await checkRateLimit(p.campaignRlPrefix, p.hourlyLimit);

    if (!allowed) {
      await dbClient.query(
        "UPDATE email_jobs SET status = 'rate_limited', updated_at = NOW() WHERE id = $1",
        [p.emailJobId]
      );

      const delay = msUntilNextHour();
      console.log(`[Worker] Rate limited — rescheduling job ${p.emailJobId} in ${Math.round(delay / 1000)}s`);

      // Reschedule existing BullMQ job in-place (no new job created)
      await job.moveToDelayed(Date.now() + delay, job.token);
      throw new DelayedError();
    }

    // ── 3. Send email via Ethereal SMTP ───────────────────────────────────────
    const { messageId, previewUrl } = await sendEmail({
      from: `"${p.fromName}" <${p.fromEmail}>`,
      to: p.recipientEmail,
      subject: p.subject,
      html: p.body,
    });

    // ── 4. Mark sent in PostgreSQL ────────────────────────────────────────────
    await dbClient.query(
      `UPDATE email_jobs
       SET status = 'sent', sent_at = NOW(), updated_at = NOW(),
           message_id = $2, attempts = attempts + 1
       WHERE id = $1`,
      [p.emailJobId, messageId]
    );

    // ── 5. Index in Elasticsearch (non-fatal) ─────────────────────────────────
    await indexEmailJob({
      emailJobId: p.emailJobId,
      campaignId: p.campaignId,
      userId: p.userId,
      recipientEmail: p.recipientEmail,
      recipientName: p.recipientName,
      subject: p.subject,
      status: "sent",
      sentAt: new Date().toISOString(),
    });

    // ── 6. Check if all jobs for campaign are done → mark completed ───────────
    const { rows } = await dbClient.query<{ pending_count: string }>(
      `SELECT COUNT(*) AS pending_count
       FROM email_jobs
       WHERE campaign_id = $1 AND status NOT IN ('sent', 'failed')`,
      [p.campaignId]
    );
    if (parseInt(rows[0].pending_count) === 0) {
      await dbClient.query(
        `UPDATE campaigns SET status = 'completed', updated_at = NOW() WHERE id = $1 AND status NOT IN ('completed','cancelled')`,
        [p.campaignId]
      );
    } else {
      // Mark running once first job sent
      await dbClient.query(
        `UPDATE campaigns SET status = 'running', updated_at = NOW() WHERE id = $1 AND status = 'scheduled'`,
        [p.campaignId]
      );
    }

    return { sent: true, messageId, previewUrl };
  } catch (err: unknown) {
    if (err instanceof DelayedError) throw err; // Let BullMQ handle the delay

    // Update error count in DB
    await dbClient.query(
      `UPDATE email_jobs
       SET attempts = attempts + 1, last_error = $2, updated_at = NOW(),
           status = CASE WHEN attempts + 1 >= 5 THEN 'failed' ELSE 'queued' END
       WHERE id = $1`,
      [p.emailJobId, (err as Error).message]
    ).catch(() => {});

    throw err;
  } finally {
    dbClient.release();
  }
}

// ── Start Worker ──────────────────────────────────────────────────────────────
const concurrency = parseInt(
  process.env.WORKER_CONCURRENCY || String(CONSTANTS.DEFAULT_WORKER_CONCURRENCY),
  10
);

const worker = new Worker<EmailJobPayload>(
  CONSTANTS.BULLMQ_QUEUE_NAME,
  processJob,
  {
    connection: redis,
    concurrency,
    stalledInterval: CONSTANTS.BULLMQ_STALLED_INTERVAL_MS,
    maxStalledCount: CONSTANTS.BULLMQ_MAX_STALLED_COUNT,
  }
);

worker.on("completed", (job, result) => {
  if (result?.skipped) return;
  console.log(`[Worker] ✓ Job ${job.id} completed`);
});
worker.on("failed", (job, err) => {
  if (err instanceof DelayedError) return;
  console.error(`[Worker] ✗ Job ${job?.id} failed: ${err.message}`);
});
worker.on("error", (err) => console.error("[Worker] Worker error:", err.message));

console.log(`[Worker] Started — queue="${CONSTANTS.BULLMQ_QUEUE_NAME}" concurrency=${concurrency}`);

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Worker] SIGTERM received — draining...");
  await worker.close();
  process.exit(0);
});
process.on("SIGINT", async () => {
  await worker.close();
  process.exit(0);
});
