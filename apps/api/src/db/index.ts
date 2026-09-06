import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDb(): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT NOW() AS now');
    console.log('[DB] PostgreSQL connected:', rows[0].now);
  } finally {
    client.release();
  }
}
