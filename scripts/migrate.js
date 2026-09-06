#!/usr/bin/env node
/**
 * scripts/migrate.js
 *
 * Applies pending SQL migrations from apps/api/src/db/migrations/ in filename
 * order. Already-applied migrations are tracked in a _migrations table and
 * skipped. Each migration runs inside a transaction; failure rolls back only
 * that migration and exits with code 1.
 *
 * Usage:
 *   node scripts/migrate.js
 *   npm run migrate
 */

"use strict";

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const MIGRATIONS_DIR = path.join(
  __dirname,
  "../apps/api/src/db/migrations"
);

// ── Colour helpers (no external dep) ─────────────────────────────────────────
const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
};

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(c.red("ERROR: DATABASE_URL is not set in .env"));
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  console.log(c.bold("\n📦 ReachInbox — Database Migrations\n"));
  console.log(c.dim("   Database: " + databaseUrl.replace(/:([^:@]+)@/, ":****@")));

  let client;
  try {
    client = await pool.connect();
    console.log(c.green("   ✓ Connected to PostgreSQL\n"));

    // ── Ensure migrations tracking table exists ─────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id          SERIAL      PRIMARY KEY,
        filename    TEXT        UNIQUE NOT NULL,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── Get already-applied migrations ──────────────────────────────────────
    const { rows: applied } = await client.query(
      "SELECT filename FROM _migrations ORDER BY filename"
    );
    const appliedSet = new Set(applied.map((r) => r.filename));

    // ── Discover migration files ─────────────────────────────────────────────
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log(c.yellow("   No migration files found in:"), MIGRATIONS_DIR);
      return;
    }

    let applied_count = 0;
    let skipped_count = 0;

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(c.dim(`   ⏭  Skipping (already applied): ${file}`));
        skipped_count++;
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      process.stdout.write(c.cyan(`   ⚙  Applying: ${file} ... `));

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO _migrations (filename) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        console.log(c.green("✓ done"));
        applied_count++;
      } catch (err) {
        await client.query("ROLLBACK");
        console.log(c.red("✗ FAILED"));
        console.error(c.red(`\n   ERROR in ${file}:`), err.message);
        process.exit(1);
      }
    }

    console.log(
      c.bold(
        `\n🎉 Migrations complete — applied: ${applied_count}, skipped: ${skipped_count}\n`
      )
    );
  } catch (err) {
    console.error(c.red("\n❌ Migration runner error:"), err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

migrate();
