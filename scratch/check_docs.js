const { Pool } = require('pg');
require('dotenv').config({ path: 'frontend/.env.local' });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: 'model/.env' });
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query('SELECT id, "originalName", "storedFilename", "filePath", status FROM "Document" ORDER BY id DESC LIMIT 5;');
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}

main().catch(console.error);
