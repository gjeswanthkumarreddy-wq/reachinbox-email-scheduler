import { z } from 'zod';

// ── Enums ─────────────────────────────────────────────────────────────────────

export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  COMPLETED = 'completed',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export enum EmailJobStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  PROCESSING = 'processing',
  SENT = 'sent',
  RATE_LIMITED = 'rate_limited',
  FAILED = 'failed',
}

// ── Domain types ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  google_id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  body: string;
  from_name: string;
  from_email: string;
  recipient_count: number;
  delay_seconds: number;
  hourly_limit: number;
  scheduled_start: Date;
  status: CampaignStatus;
  created_at: Date;
  updated_at: Date;
}

export interface EmailJob {
  id: string;
  campaign_id: string;
  user_id: string;
  recipient_email: string;
  recipient_name: string | null;
  sequence_index: number;
  bullmq_job_id: string | null;
  status: EmailJobStatus;
  attempts: number;
  last_error: string | null;
  scheduled_at: Date | null;
  sent_at: Date | null;
  message_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SlackConnection {
  id: string;
  user_id: string;
  access_token: string;
  team_id: string;
  team_name: string | null;
  channel_id: string | null;
  channel_name: string | null;
  scope: string | null;
  connected_at: Date;
  updated_at: Date;
}

// ── BullMQ job payload ────────────────────────────────────────────────────────

export interface EmailJobPayload {
  emailJobId: string;
  campaignId: string;
  userId: string;
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  body: string;
  fromName: string;
  fromEmail: string;
  sequenceIndex: number;
  hourlyLimit: number;
  /** Redis rate-limit key prefix: rl:campaign:{campaignId} */
  campaignRlPrefix: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const CONSTANTS = {
  DEFAULT_WORKER_CONCURRENCY: 5,
  DEFAULT_EMAIL_DELAY_SECONDS: 60,
  DEFAULT_HOURLY_LIMIT: 100,
  STALE_PROCESSING_THRESHOLD_SECONDS: 90,
  BULLMQ_STALLED_INTERVAL_MS: 30_000,
  BULLMQ_MAX_STALLED_COUNT: 3,
  BULLMQ_QUEUE_NAME: 'email-delivery',
  SESSION_TTL_SECONDS: 86_400,
  RATE_LIMIT_RESCHEDULE_BUFFER_MS: 2_000,
} as const;

// ── Validation schemas ────────────────────────────────────────────────────────

export const CreateCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(255),
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required'),
  fromName: z.string().min(1, 'From name is required').max(255),
  fromEmail: z.string().email('Invalid from email'),
  delaySeconds: z
    .number()
    .int()
    .min(0)
    .default(CONSTANTS.DEFAULT_EMAIL_DELAY_SECONDS),
  hourlyLimit: z
    .number()
    .int()
    .min(1)
    .default(CONSTANTS.DEFAULT_HOURLY_LIMIT),
  scheduledStart: z.string(),
});

export type CreateCampaignDTO = z.infer<typeof CreateCampaignSchema>;

export const CsvRecipientSchema = z.object({
  email: z.string().email(),
  name: z.string().optional().nullable(),
});

export type CsvRecipient = z.infer<typeof CsvRecipientSchema>;

export interface CsvUploadResult {
  total: number;
  valid: CsvRecipient[];
  invalid: { row: number; value: string; reason: string }[];
  duplicates: string[];
}
