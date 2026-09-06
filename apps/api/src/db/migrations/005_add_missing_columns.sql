-- Migration: 005_add_missing_columns.sql
-- Safely adds columns that were missing from the initial schema.

-- 1. Add updated_at to users (was missing from 001)
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Add name to campaigns (campaign display name, distinct from subject)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS name TEXT;
-- Backfill: use subject as the name for any existing rows
UPDATE campaigns SET name = subject WHERE name IS NULL;
-- Now make it non-nullable
ALTER TABLE campaigns ALTER COLUMN name SET NOT NULL;
ALTER TABLE campaigns ALTER COLUMN name SET DEFAULT '';
