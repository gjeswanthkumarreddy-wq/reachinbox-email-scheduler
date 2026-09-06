import { Router } from "express";
import { pool } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { searchEmailJobs } from "../services/elasticsearch";

const router = Router();
router.use(requireAuth);

// GET /api/emails/scheduled
router.get("/scheduled", async (req, res) => {
  const user = req.user as { id: string };
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT ej.*, c.name AS campaign_name, c.subject
     FROM email_jobs ej
     JOIN campaigns c ON c.id = ej.campaign_id
     WHERE ej.user_id = $1 AND ej.status IN ('queued','rate_limited','pending')
     ORDER BY ej.scheduled_at ASC NULLS LAST
     LIMIT $2 OFFSET $3`,
    [user.id, limit, offset]
  );
  const { rows: countRows } = await pool.query(
    "SELECT COUNT(*) FROM email_jobs WHERE user_id = $1 AND status IN ('queued','rate_limited','pending')",
    [user.id]
  );
  res.json({ jobs: rows, total: parseInt(countRows[0].count), page, limit });
});

// GET /api/emails/sent
router.get("/sent", async (req, res) => {
  const user = req.user as { id: string };
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT ej.*, c.name AS campaign_name, c.subject
     FROM email_jobs ej
     JOIN campaigns c ON c.id = ej.campaign_id
     WHERE ej.user_id = $1 AND ej.status IN ('sent','failed')
     ORDER BY ej.sent_at DESC NULLS LAST
     LIMIT $2 OFFSET $3`,
    [user.id, limit, offset]
  );
  const { rows: countRows } = await pool.query(
    "SELECT COUNT(*) FROM email_jobs WHERE user_id = $1 AND status IN ('sent','failed')",
    [user.id]
  );
  res.json({ jobs: rows, total: parseInt(countRows[0].count), page, limit });
});

// GET /api/emails/search?q=...
router.get("/search", async (req, res) => {
  const user = req.user as { id: string };
  const q = (req.query.q as string || "").trim();
  if (!q) { res.json([]); return; }
  const results = await searchEmailJobs(q, user.id);
  res.json(results);
});

// GET /api/emails/stats
router.get("/stats", async (req, res) => {
  const user = req.user as { id: string };
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'sent') AS sent,
       COUNT(*) FILTER (WHERE status = 'failed') AS failed,
       COUNT(*) FILTER (WHERE status IN ('queued','pending')) AS queued,
       COUNT(*) FILTER (WHERE status = 'rate_limited') AS rate_limited,
       COUNT(*) FILTER (WHERE status = 'processing') AS processing
     FROM email_jobs WHERE user_id = $1`,
    [user.id]
  );
  const { rows: campRows } = await pool.query(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled,
       COUNT(*) FILTER (WHERE status = 'running') AS running,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed,
       COUNT(*) FILTER (WHERE status = 'failed') AS failed
     FROM campaigns WHERE user_id = $1`,
    [user.id]
  );
  res.json({ emails: rows[0], campaigns: campRows[0] });
});

export default router;
