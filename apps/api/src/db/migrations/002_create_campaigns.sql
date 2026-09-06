-- Migration: 002_create_campaigns.sql
-- An email campaign is a batch of emails sharing subject/body/sender settings
-- and a common schedule configuration (start time, delay, hourly limit).

CREATE TABLE IF NOT EXISTS campaigns (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject          TEXT        NOT NULL,
  body             TEXT        NOT NULL,
  from_name        TEXT        NOT NULL,
  from_email       TEXT        NOT NULL,
  recipient_count  INT         NOT NULL DEFAULT 0,

  -- Scheduling configuration
  delay_seconds    INT         NOT NULL DEFAULT 60,   -- pause between individual emails
  hourly_limit     INT         NOT NULL DEFAULT 100,  -- max emails sent per clock-hour (fixed window)
  scheduled_start  TIMESTAMPTZ NOT NULL,

  -- Lifecycle status
  -- draft      : created, not yet submitted
  -- scheduled  : all jobs enqueued; waiting for scheduled_start
  -- running    : first job has been processed
  -- paused     : (future) operator-paused mid-campaign
  -- completed  : all email_jobs are in terminal state (sent/failed)
  -- failed     : campaign-level failure (e.g. bad CSV)
  status           TEXT        NOT NULL DEFAULT 'draft',

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT campaigns_status_check CHECK (
    status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'failed')
  ),
  CONSTRAINT campaigns_delay_positive   CHECK (delay_seconds   >= 0),
  CONSTRAINT campaigns_hourly_positive  CHECK (hourly_limit    >= 1)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status  ON campaigns(status);

COMMENT ON TABLE  campaigns                 IS 'Email campaign definitions created by users';
COMMENT ON COLUMN campaigns.delay_seconds   IS 'Seconds to wait between consecutive individual email sends';
COMMENT ON COLUMN campaigns.hourly_limit    IS 'Maximum emails that may be sent per clock-hour (fixed tumbling window)';
COMMENT ON COLUMN campaigns.scheduled_start IS 'Earliest time the first email in this campaign may be sent';
