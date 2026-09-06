-- Migration: 004_create_slack_connections.sql
-- Stores per-user Slack OAuth tokens for optional rate-limit notifications.
--
-- IMPORTANT: Slack is entirely optional. The application MUST continue to
-- function normally when no row exists for a given user_id.
-- Every call site must check `if (connection)` before invoking the Slack API.

CREATE TABLE IF NOT EXISTS slack_connections (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- One Slack connection per user; UNIQUE enforces this
  user_id       UUID        UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- OAuth access token — treat as a secret; do not log
  access_token  TEXT        NOT NULL,

  team_id       TEXT        NOT NULL,   -- Slack workspace ID
  team_name     TEXT,                   -- Slack workspace display name

  -- Default channel for rate-limit notifications
  channel_id    TEXT,
  channel_name  TEXT,

  scope         TEXT,                   -- granted OAuth scopes (comma-separated)

  connected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  slack_connections              IS 'Per-user Slack OAuth credentials for optional rate-limit notifications';
COMMENT ON COLUMN slack_connections.access_token IS 'Bot/user OAuth token — keep secret; never expose in API responses';
COMMENT ON COLUMN slack_connections.channel_id   IS 'Slack channel ID where rate-limit notifications are sent';
COMMENT ON COLUMN slack_connections.scope        IS 'Space-separated list of OAuth scopes granted during Slack OAuth flow';
