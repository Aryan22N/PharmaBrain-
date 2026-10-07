const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', 'frontend', '.env.local') });

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false
});

async function main() {
  const client = await pool.connect();
  try {
    const res1 = await client.query(`DELETE FROM "Analysis" WHERE "documentId" IN (SELECT id FROM "Document" WHERE status = 'DISCARDED');`);
    console.log(`Deleted ${res1.rowCount} analysis records with DISCARDED status.`);
    const res2 = await client.query(`DELETE FROM "Document" WHERE status = 'DISCARDED';`);
    console.log(`Deleted ${res2.rowCount} document records with DISCARDED status.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("Cleanup error:", err);
  process.exit(1);
});
