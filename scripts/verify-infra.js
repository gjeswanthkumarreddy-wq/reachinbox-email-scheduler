#!/usr/bin/env node
/**
 * scripts/verify-infra.js
 *
 * Verifies that all three infrastructure services (PostgreSQL, Redis,
 * Elasticsearch) are reachable and healthy. Run after `docker-compose up -d`.
 *
 * Usage:
 *   node scripts/verify-infra.js
 *   npm run verify
 *
 * Exit code 0 = all healthy | Exit code 1 = one or more services unavailable.
 */

"use strict";

const { Pool } = require("pg");
const net = require("net");
const http = require("http");
require("dotenv").config();

// ── Colour helpers ────────────────────────────────────────────────────────────
const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
};

// ── PostgreSQL ────────────────────────────────────────────────────────────────
async function checkPostgres() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/reachinbox",
    connectionTimeoutMillis: 5000,
  });
  try {
    const client = await pool.connect();
    const { rows } = await client.query("SELECT version(), current_database() AS db");
    client.release();
    const ver = rows[0].version.match(/PostgreSQL [\d.]+/)?.[0] ?? rows[0].version;
    console.log(c.green("  ✓ PostgreSQL"), c.dim(`${ver} | db: ${rows[0].db}`));
    return true;
  } catch (err) {
    console.log(c.red("  ✗ PostgreSQL"), c.dim(err.message));
    return false;
  } finally {
    await pool.end();
  }
}

// ── Redis (raw TCP PING/PONG — no external dep) ───────────────────────────────
function checkRedis() {
  return new Promise((resolve) => {
    const url = new URL(process.env.REDIS_URL || "redis://localhost:6379");
    const host = url.hostname;
    const port = parseInt(url.port || "6379", 10);
    const socket = new net.Socket();
    let resolved = false;

    const done = (ok, msg) => {
      if (resolved) return;
      resolved = true;
      if (ok) console.log(c.green("  ✓ Redis"), c.dim(msg));
      else     console.log(c.red("  ✗ Redis"), c.dim(msg));
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(5000);
    socket.connect(port, host, () => socket.write("PING\r\n"));

    socket.on("data", (data) => {
      const resp = data.toString();
      if (resp.includes("+PONG")) {
        done(true, `PONG received from ${host}:${port} (AOF persistence required — verify docker-compose)`);
      } else {
        done(false, `Unexpected response: ${resp.trim()}`);
      }
    });

    socket.on("error",   (err) => done(false, err.message));
    socket.on("timeout", ()    => done(false, "Connection timed out"));
  });
}

// ── Elasticsearch (HTTP /_cluster/health) ─────────────────────────────────────
function checkElasticsearch() {
  return new Promise((resolve) => {
    const esUrl = process.env.ELASTICSEARCH_URL || "http://localhost:9200";
    const url = new URL("/_cluster/health", esUrl);

    const req = http.get(url.toString(), { timeout: 10000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const health = JSON.parse(data);
          const statusColor = health.status === "green" ? c.green : c.yellow;
          console.log(
            c.green("  ✓ Elasticsearch"),
            c.dim(
              `cluster="${health.cluster_name}" status=${statusColor(health.status)} ` +
              `nodes=${health.number_of_nodes}`
            )
          );
          resolve(true);
        } catch {
          console.log(c.red("  ✗ Elasticsearch"), c.dim("Invalid JSON response"));
          resolve(false);
        }
      });
    });

    req.on("error", (err) => {
      console.log(c.red("  ✗ Elasticsearch"), c.dim(err.message));
      resolve(false);
    });

    req.on("timeout", () => {
      console.log(c.red("  ✗ Elasticsearch"), c.dim("Connection timed out (ES may still be starting — wait ~60s)"));
      req.destroy();
      resolve(false);
    });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function verify() {
  console.log(c.bold("\n🔍 ReachInbox — Infrastructure Health Check\n"));

  const [pg, redis, es] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkElasticsearch(),
  ]);

  const all = pg && redis && es;
  const failed = [!pg && "PostgreSQL", !redis && "Redis", !es && "Elasticsearch"]
    .filter(Boolean);

  console.log("\n" + "─".repeat(50));
  if (all) {
    console.log(c.green(c.bold("✅ All infrastructure services are healthy!")));
    console.log(c.dim("   Next step: npm run migrate"));
  } else {
    console.log(c.red(c.bold(`❌ Service(s) not ready: ${failed.join(", ")}`)));
    console.log(c.yellow("   Run: docker-compose up -d"));
    console.log(c.yellow("   Note: Elasticsearch takes ~60s to start on first boot."));
    process.exit(1);
  }
  console.log("");
}

verify();
