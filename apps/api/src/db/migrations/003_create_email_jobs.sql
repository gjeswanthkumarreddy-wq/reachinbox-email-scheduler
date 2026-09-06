-- Migration: 003_create_email_jobs.sql
-- One row per recipient per campaign. This is the core idempotency record.
--
-- STATUS MACHINE:
--   pending      -> created in DB; BullMQ job not yet enqueued
--   queued       -> BullMQ delayed job has been enqueued (or re-promoted after rate_limited)
--   processing   -> a worker has atomically claimed the job (UPDATE WHERE status IN (...))
--   sent         -> SMTP call succeeded; terminal state
--   failed       -> exhausted BullMQ retry attempts; terminal state
--   rate_limited -> hourly limit was reached; job moved to BullMQ delayed via
--                   job.moveToDelayed(); will transition back to queued automatically
--
-- IDEMPOTENCY:
--   - id (UUID) is set as the BullMQ jobId — prevents duplicate enqueue
--   - UNIQUE(campaign_id, recipient_email) — collapses duplicate CSV rows
--   - Processor claims via: UPDATE WHERE status IN ('queued','rate_limited')
--   - Stall-recovery: UPDATE WHERE status='processing' AND updated_at < NOW()-90s
--   - Pre-check: SELECT status; if 'sent', processor exits immediately

CREATE TABLE IF NOT EXISTS email_jobs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES users(id),
  recipient_email  TEXT        NOT NULL,
  recipient_name   TEXT,
  sequence_index   INT         NOT NULL,  -- 0-based; preserves intended send order

  -- Cross-reference back to the BullMQ job (same value as id; stored for observability)
  bullmq_job_id    TEXT,

  status           TEXT        NOT NULL DEFAULT 'pending',
  attempts         INT         NOT NULL DEFAULT 0,
  last_error       TEXT,

  -- Scheduling
  scheduled_at     TIMESTAMPTZ,          -- when this email is intended to be sent
  sent_at          TIMESTAMPTZ,          -- actual SMTP delivery timestamp

  -- SMTP metadata
  message_id       TEXT,                 -- Ethereal SMTP Message-ID header (for preview link)

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- updated_at is kept current by the processor; used for stall-recovery
  -- (WHERE status='processing' AND updated_at < NOW() - INTERVAL '90 seconds')
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Idempotency: one row per recipient per campaign
  CONSTRAINT email_jobs_unique_recipient UNIQUE (campaign_id, recipient_email),

  CONSTRAINT email_jobs_status_check CHECK (
    status IN ('pending', 'queued', 'processing', 'sent', 'failed', 'rate_limited')
  ),
  CONSTRAINT email_jobs_sequence_nonneg CHECK (sequence_index >= 0),
  CONSTRAINT email_jobs_attempts_nonneg CHECK (attempts >= 0)
);

-- Fast lookup of all jobs for a campaign (dashboard, campaign completion check)
CREATE INDEX IF NOT EXISTS idx_email_jobs_campaign_id
  ON email_jobs(campaign_id);

-- Filter by status (scheduled view: pending/queued/rate_limited; sent view: sent/failed)
CREATE INDEX IF NOT EXISTS idx_email_jobs_status
  ON email_jobs(status);

-- Reverse-lookup: all emails for a user across campaigns
CREATE INDEX IF NOT EXISTS idx_email_jobs_user_id
  ON email_jobs(user_id);

-- Stall-recovery query: WHERE status='processing' AND updated_at < NOW() - 90s
CREATE INDEX IF NOT EXISTS idx_email_jobs_processing_updated
  ON email_jobs(updated_at) WHERE status = 'processing';

-- Ordered delivery within a campaign (sequence_index enforces send order)
CREATE INDEX IF NOT EXISTS idx_email_jobs_campaign_sequence
  ON email_jobs(campaign_id, sequence_index);

COMMENT ON TABLE  email_jobs                  IS 'One row per recipient per campaign; serves as the idempotency record';
COMMENT ON COLUMN email_jobs.id               IS 'UUID used as both PK and BullMQ jobId for deduplication';
COMMENT ON COLUMN email_jobs.sequence_index   IS 'Zero-based index within the campaign; preserves CSV upload order';
COMMENT ON COLUMN email_jobs.bullmq_job_id    IS 'Mirrors id; stored for cross-referencing with Bull Board';
COMMENT ON COLUMN email_jobs.updated_at       IS 'Updated by the worker on every status transition; used for stall-recovery detection';
COMMENT ON COLUMN email_jobs.message_id       IS 'Ethereal SMTP Message-ID; use nodemailer.getTestMessageUrl() to get preview link';
