# ReachInbox Hiring Assignment — Full-stack Email Job Scheduler

## Architecture Overview
- **Frontend**: Next.js App Router, Tailwind CSS, TypeScript.
- **Backend API**: Node.js, Express, TypeScript.
- **Worker**: Separate BullMQ worker process.
- **Database**: PostgreSQL 16 (Source of Truth).
- **Queue/Cache**: Redis 7 (AOF enabled).
- **Search**: Elasticsearch 8.13.0.
- **Authentication**: Google OAuth 2.0 with Redis-backed sessions.
- **Email**: Ethereal SMTP.
- **Monitoring**: BullMQ Board (at `/admin/queues` with Basic Auth).

## Setup & Run Instructions

1. **Infrastructure**:
   ```bash
   docker-compose up -d
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Database Migrations**:
   ```bash
   npm run migrate
   ```
4. **Environment Variables**:
   Copy `.env.example` to `.env` and fill in your Google OAuth credentials.
5. **Run Applications** (in separate terminals):
   ```bash
   npm run dev:api
   npm run dev:worker
   npm run dev:web
   ```

## Key Requirements Implemented

### Persistence & Restart Behavior
- PostgreSQL acts as the single source of truth for idempotency and campaign state.
- Redis uses AOF (`appendfsync everysec`) so delayed BullMQ jobs survive container restarts.
- The worker on startup will resume any `queued` or `rate_limited` jobs, and recover `processing` jobs that are stale.

### Concurrency & Rate Limiting
- **Worker Concurrency**: Configurable via `WORKER_CONCURRENCY` in `.env`.
- **Delay Between Emails**: Configured per campaign via `delay_seconds`. Handled by scheduling the jobs with incremental delays.
- **Hourly Limit**: Handled via a custom atomic Lua script in Redis using a fixed tumbling window (`rl:campaign:{campaignId}:{YYYY-MM-DD-HH}`). If the limit is hit, jobs are rescheduled back to the delayed queue using `moveToDelayed()` and a `DelayedError` is thrown (so it's not marked as failed).

### Idempotency & Duplicate Protection
- **BullMQ jobId = DB emailJobId**: Prevents the same recipient row from being queued multiple times in BullMQ.
- **DB Unique Constraint**: `(campaign_id, recipient_email)` prevents duplicate insertions from CSV.
- **Atomic DB Claiming**: The worker updates the status to `processing` atomically: `UPDATE ... WHERE status IN ('queued', 'rate_limited')`.
- **Sent Fast-Path**: If a job was already sent (e.g. SMTP accepted but crash occurred before DB update), it returns early.

### Stale Processing Recovery
- If a worker crashes during `processing`, the row in the DB stays stuck. A recovery condition `status='processing' AND updated_at < NOW() - 90s` is included in the atomic claim query to reclaim stalled jobs.
- BullMQ's `stalledInterval` (30s) and `maxStalledCount` (3) are configured.

### Trade-offs & Assumptions
- **Exactly-once Delivery**: While the system has strong idempotency, if the worker crashes *after* the Ethereal SMTP server accepts the email but *before* the DB update to `sent`, the job may be retried and result in a duplicate email. To truly solve this, a transactional outbox or checking SMTP logs/message-id uniquely would be needed, but that's out of scope for Ethereal.
- **Elasticsearch Consistency**: Elasticsearch is updated asynchronously (best-effort) after DB commits. In an extreme crash scenario, ES might be out of sync, requiring a backfill script. PostgreSQL remains the true state.

## Testing
Unit and integration tests are available. Run them with:
```bash
npm run test
```
