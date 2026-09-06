import { Queue } from "bullmq";
import { CONSTANTS, EmailJobPayload } from "@reachinbox/shared";
import { getRedisClient } from "../config/redis";
import { pool } from "../db";

let _queue: Queue | null = null;
function getQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(CONSTANTS.BULLMQ_QUEUE_NAME, {
      connection: getRedisClient(),
      defaultJobOptions: { removeOnComplete: 200, removeOnFail: 500 },
    });
  }
  return _queue;
}

export interface Recipient {
  email: string;
  name: string | null;
}

export async function scheduleCampaign(
  campaignId: string,
  userId: string,
  recipients: Recipient[]
): Promise<{ enqueued: number }> {
  const client = await pool.connect();
  try {
    // Load campaign
    const { rows: camps } = await client.query(
      "SELECT * FROM campaigns WHERE id = $1 AND user_id = $2",
      [campaignId, userId]
    );
    if (camps.length === 0) throw new Error("Campaign not found");
    const campaign = camps[0];

    if (campaign.status !== "draft") {
      throw new Error(`Campaign is in '${campaign.status}' status, not draft`);
    }

    await client.query("BEGIN");

    const jobRows: { id: string; sequenceIndex: number }[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const rec = recipients[i];
      const { rows } = await client.query(
        `INSERT INTO email_jobs
           (campaign_id, user_id, recipient_email, recipient_name, sequence_index, status)
         VALUES ($1, $2, $3, $4, $5, 'queued')
         ON CONFLICT (campaign_id, recipient_email) DO NOTHING
         RETURNING id`,
        [campaignId, userId, rec.email, rec.name, i]
      );
      if (rows.length > 0) {
        jobRows.push({ id: rows[0].id, sequenceIndex: i });
      }
    }

    await client.query(
      `UPDATE campaigns
       SET status = 'scheduled', recipient_count = $1, updated_at = NOW()
       WHERE id = $2`,
      [jobRows.length, campaignId]
    );

    await client.query("COMMIT");

    // Enqueue BullMQ delayed jobs
    const queue = getQueue();
    const now = Date.now();
    const scheduledStartMs = new Date(campaign.scheduled_start).getTime();

    const bullJobs = jobRows.map((j) => {
      const initialDelay = Math.max(0, scheduledStartMs - now);
      const seqDelay = j.sequenceIndex * campaign.delay_seconds * 1000;
      const totalDelay = initialDelay + seqDelay;

      const payload: EmailJobPayload = {
        emailJobId: j.id,
        campaignId,
        userId,
        recipientEmail: recipients[j.sequenceIndex].email,
        recipientName: recipients[j.sequenceIndex].name,
        subject: campaign.subject,
        body: campaign.body,
        fromName: campaign.from_name,
        fromEmail: campaign.from_email,
        sequenceIndex: j.sequenceIndex,
        hourlyLimit: campaign.hourly_limit,
        campaignRlPrefix: `rl:campaign:${campaignId}`,
      };

      return {
        name: "send-email",
        data: payload,
        opts: {
          jobId: j.id, // idempotency: UUID = BullMQ jobId
          delay: totalDelay,
          attempts: 5,
          backoff: { type: "exponential", delay: 10_000 },
        },
      };
    });

    if (bullJobs.length > 0) {
      await queue.addBulk(bullJobs);
    }

    // Update scheduled_at timestamps in DB
    for (const j of jobRows) {
      const initialDelay = Math.max(0, scheduledStartMs - now);
      const seqDelay = j.sequenceIndex * campaign.delay_seconds * 1000;
      const scheduledAt = new Date(now + initialDelay + seqDelay);
      await pool.query(
        "UPDATE email_jobs SET scheduled_at = $1, bullmq_job_id = $2 WHERE id = $3",
        [scheduledAt, j.id, j.id]
      );
    }

    return { enqueued: jobRows.length };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
