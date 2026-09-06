-- Migration: 001_create_users.sql
-- Creates the users table populated by Google OAuth sign-in.
-- google_id is the stable identifier from Google; email is used for display.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- provides gen_random_uuid()

CREATE TABLE IF NOT EXISTS users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id   TEXT        UNIQUE NOT NULL,
  email       TEXT        UNIQUE NOT NULL,
  name        TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  users              IS 'Application users authenticated via Google OAuth 2.0';
COMMENT ON COLUMN users.google_id   IS 'Stable Google account identifier (sub claim from ID token)';
COMMENT ON COLUMN users.email       IS 'Primary email from Google profile';
COMMENT ON COLUMN users.avatar_url  IS 'Google profile picture URL';
