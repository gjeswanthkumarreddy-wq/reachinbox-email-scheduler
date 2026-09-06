import { Client } from "@elastic/elasticsearch";

let _client: Client | null = null;

export function getEsClient(): Client {
  if (!_client) {
    _client = new Client({
      node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
    });
  }
  return _client;
}

const INDEX = process.env.ELASTICSEARCH_INDEX || "email_jobs";

export async function ensureEsIndex(): Promise<void> {
  const client = getEsClient();
  try {
    const exists = await client.indices.exists({ index: INDEX });
    if (!exists) {
      await client.indices.create({
        index: INDEX,
        mappings: {
          properties: {
            emailJobId:     { type: "keyword" },
            campaignId:     { type: "keyword" },
            userId:         { type: "keyword" },
            recipientEmail: { type: "keyword" },
            recipientName:  { type: "text" },
            subject:        { type: "text" },
            status:         { type: "keyword" },
            scheduledAt:    { type: "date" },
            sentAt:         { type: "date" },
          },
        },
      });
      console.log("[ES] Index created:", INDEX);
    }
  } catch (err: unknown) {
    console.warn("[ES] Index ensure failed (non-fatal):", (err as Error).message);
  }
}

export async function indexEmailJob(doc: {
  emailJobId: string;
  campaignId: string;
  userId: string;
  recipientEmail: string;
  recipientName?: string | null;
  subject: string;
  status: string;
  scheduledAt?: Date | null;
  sentAt?: Date | null;
}): Promise<void> {
  try {
    await getEsClient().index({
      index: INDEX,
      id: doc.emailJobId,
      document: {
        ...doc,
        scheduledAt: doc.scheduledAt?.toISOString() ?? null,
        sentAt: doc.sentAt?.toISOString() ?? null,
      },
    });
  } catch (err: unknown) {
    console.warn("[ES] Index failed (non-fatal):", (err as Error).message);
  }
}

export async function searchEmailJobs(
  q: string,
  userId: string
): Promise<unknown[]> {
  try {
    const resp = await getEsClient().search({
      index: INDEX,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: q,
                fields: ["recipientEmail", "recipientName", "subject"],
                fuzziness: "AUTO",
              },
            },
          ],
          filter: [{ term: { userId } }],
        },
      },
      size: 50,
    });
    return resp.hits.hits.map((h) => h._source);
  } catch (err: unknown) {
    console.warn("[ES] Search failed:", (err as Error).message);
    return [];
  }
}
