-- Migration: 006_fix_campaign_status.sql
-- Safely add 'cancelled' to the campaigns_status_check constraint

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;

ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check CHECK (
  status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'failed', 'cancelled')
);
