import "dotenv/config";
import app from "./app";
import { initDb } from "./db";
import { ensureEsIndex } from "./services/elasticsearch";

const PORT = parseInt(process.env.API_PORT || "3001", 10);

async function start(): Promise<void> {
  try {
    await initDb();
    await ensureEsIndex();
    app.listen(PORT, () => {
      console.log(`[API] Listening on http://localhost:${PORT}`);
      console.log(`[API] BullMQ Board: http://localhost:${PORT}/admin/queues`);
    });
  } catch (err) {
    console.error("[API] Failed to start:", err);
    process.exit(1);
  }
}

start();
