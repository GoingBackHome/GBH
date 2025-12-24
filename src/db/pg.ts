import pg from 'pg';
import { CONFIG } from '../config.js';

export const pool = new pg.Pool({
  connectionString: CONFIG.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
});

export async function withClient<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try { return await fn(c); }
  finally { c.release(); }
}
