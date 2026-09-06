import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { CreateCampaignSchema, CsvUploadResult } from "@reachinbox/shared";
import { pool } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { scheduleCampaign } from "../services/campaignScheduler";
import { indexEmailJob } from "../services/elasticsearch";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth);

// POST /api/campaigns — create draft campaign
router.post("/", async (req, res) => {
  const parsed = CreateCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;
  try {
    const user = req.user as { id: string };
    const { rows } = await pool.query(
      `INSERT INTO campaigns
         (user_id, name, subject, body, from_name, from_email, delay_seconds, hourly_limit, scheduled_start, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft')
       RETURNING *`,
      [user.id, d.name, d.subject, d.body, d.fromName, d.fromEmail, d.delaySeconds, d.hourlyLimit, d.scheduledStart]
    );
    res.status(201).json(rows[0]);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/campaigns — list user campaigns
router.get("/", async (req, res) => {
  const user = req.user as { id: string };
  const { rows } = await pool.query(
    "SELECT * FROM campaigns WHERE user_id = $1 ORDER BY created_at DESC",
    [user.id]
  );
  res.json(rows);
});

// GET /api/campaigns/:id
router.get("/:id", async (req, res) => {
  const user = req.user as { id: string };
  const { rows } = await pool.query(
    "SELECT * FROM campaigns WHERE id = $1 AND user_id = $2",
    [req.params.id, user.id]
  );
  if (rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  res.json(rows[0]);
});

// POST /api/campaigns/:id/upload — parse CSV, return preview (no schedule yet)
router.post("/:id/upload", upload.single("file"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  const user = req.user as { id: string };
  const { rows: camps } = await pool.query(
    "SELECT * FROM campaigns WHERE id = $1 AND user_id = $2",
    [req.params.id, user.id]
  );
  if (camps.length === 0) { res.status(404).json({ error: "Campaign not found" }); return; }

  const csvText = req.file.buffer.toString("utf-8");
  let records: Record<string, string>[];
  try {
    records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
  } catch {
    res.status(400).json({ error: "Invalid CSV format" });
    return;
  }

  const result: CsvUploadResult = { total: records.length, valid: [], invalid: [], duplicates: [] };
  const seen = new Set<string>();

  records.forEach((row, idx) => {
    const emailRaw = (row["email"] || row["Email"] || "").trim().toLowerCase();
    const name = (row["name"] || row["Name"] || "").trim() || null;

    if (!emailRaw) {
      result.invalid.push({ row: idx + 2, value: "", reason: "Missing email" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      result.invalid.push({ row: idx + 2, value: emailRaw, reason: "Invalid email format" });
      return;
    }
    if (seen.has(emailRaw)) {
      result.duplicates.push(emailRaw);
      return;
    }
    seen.add(emailRaw);
    result.valid.push({ email: emailRaw, name });
  });

  res.json(result);
});

// POST /api/campaigns/:id/schedule — enqueue jobs
router.post("/:id/schedule", upload.single("file"), async (req, res) => {
  const user = req.user as { id: string };

  // Accept recipients either from body JSON or from CSV file
  let recipients: { email: string; name: string | null }[] = [];

  if (req.file) {
    const csvText = req.file.buffer.toString("utf-8");
    const records: Record<string, string>[] = parse(csvText, {
      columns: true, skip_empty_lines: true, trim: true,
    });
    const seen = new Set<string>();
    for (const row of records) {
      const email = (row["email"] || row["Email"] || "").trim().toLowerCase();
      const name = (row["name"] || row["Name"] || "").trim() || null;
      if (email && !seen.has(email)) { seen.add(email); recipients.push({ email, name }); }
    }
  } else if (Array.isArray(req.body.recipients)) {
    recipients = req.body.recipients;
  } else {
    res.status(400).json({ error: "Provide a CSV file or recipients array in body" });
    return;
  }

  if (recipients.length === 0) {
    res.status(400).json({ error: "No valid recipients" });
    return;
  }

  try {
    const result = await scheduleCampaign(req.params.id, user.id, recipients);

    // Index queued jobs into ES (best-effort)
    const { rows: jobs } = await pool.query(
      "SELECT * FROM email_jobs WHERE campaign_id = $1",
      [req.params.id]
    );
    const { rows: camp } = await pool.query("SELECT subject FROM campaigns WHERE id = $1", [req.params.id]);
    const subject = camp[0]?.subject ?? "";
    for (const job of jobs) {
      await indexEmailJob({
        emailJobId: job.id, campaignId: job.campaign_id, userId: job.user_id,
        recipientEmail: job.recipient_email, recipientName: job.recipient_name,
        subject, status: job.status, scheduledAt: job.scheduled_at,
      });
    }

    res.json({ success: true, enqueued: result.enqueued });
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// PATCH /api/campaigns/:id/pause
router.patch("/:id/pause", async (req, res) => {
  const user = req.user as { id: string };
  const { rows } = await pool.query(
    `UPDATE campaigns SET status = 'paused', updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status IN ('scheduled','running')
     RETURNING *`,
    [req.params.id, user.id]
  );
  if (rows.length === 0) { res.status(404).json({ error: "Not found or not pausable" }); return; }
  res.json(rows[0]);
});

// PATCH /api/campaigns/:id/resume
router.patch("/:id/resume", async (req, res) => {
  const user = req.user as { id: string };
  const { rows } = await pool.query(
    `UPDATE campaigns SET status = 'scheduled', updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'paused'
     RETURNING *`,
    [req.params.id, user.id]
  );
  if (rows.length === 0) { res.status(404).json({ error: "Not found or not resumable" }); return; }
  res.json(rows[0]);
});

// PATCH /api/campaigns/:id/cancel
router.patch("/:id/cancel", async (req, res) => {
  const user = req.user as { id: string };
  const { rows } = await pool.query(
    `UPDATE campaigns SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status NOT IN ('completed','cancelled')
     RETURNING *`,
    [req.params.id, user.id]
  );
  if (rows.length === 0) { res.status(404).json({ error: "Not found or already terminal" }); return; }
  res.json(rows[0]);
});

export default router;
