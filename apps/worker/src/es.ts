import { Client } from "@elastic/elasticsearch";

let _client: Client | null = null;
function getClient(): Client {
  if (!_client) {
    _client = new Client({ node: process.env.ELASTICSEARCH_URL || "http://localhost:9200" });
  }
  return _client;
}

const INDEX = process.env.ELASTICSEARCH_INDEX || "email_jobs";

export async function indexEmailJob(doc: Record<string, unknown>): Promise<void> {
  try {
    await getClient().index({ index: INDEX, id: doc["emailJobId"] as string, document: doc });
  } catch (err: unknown) {
    console.warn("[Worker ES] Index failed (non-fatal):", (err as Error).message);
  }
}
