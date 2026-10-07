import { Pool, QueryResultRow } from 'pg';

/**
 * Normalizes PostgreSQL connection string for Supabase and local environments.
 * Strips `sslmode` parameter so `pg` Pool options explicitly manage SSL behavior without conflicts.
 */
function getConnectionString(): string {
  const raw =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/postgres';

  return raw.replace(/[\?&]sslmode=[^&]+/g, '');
}

const connectionString = getConnectionString();

const isLocalhost =
  connectionString.includes('localhost') ||
  connectionString.includes('127.0.0.1') ||
  connectionString.startsWith('sqlite');

// Global pool instance to prevent connection leaks across Next.js API reloads
declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined;
}

export const pool: Pool =
  global.__dbPool ||
  new Pool({
    connectionString,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

// Catch and handle idle pool errors (e.g. Supabase connection resets) to prevent process crashes
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

if (process.env.NODE_ENV !== 'production') {
  global.__dbPool = pool;
}

/**
 * Execute a parameterized query against Supabase PostgreSQL
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params: any[] = []
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const res = await client.query<T>(text, params);
    return res.rows;
  } catch (error) {
    console.error('Supabase DB Query Error:', error);
    throw error;
  } finally {
    client.release();
  }
}

