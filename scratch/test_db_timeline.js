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
  const patientIds = ['483027156', 'CCM12578'];
  const res = await pool.query(
    `SELECT id, patient_id, user_id, event_date, category, title 
     FROM patient_timeline_events 
     WHERE patient_id = ANY($1::text[]) OR user_id = $2
     ORDER BY event_date DESC;`,
    [patientIds, 1]
  );
  console.log(`Found ${res.rows.length} timeline events!`);
  for (const r of res.rows.slice(0, 3)) {
    console.log(r);
  }
  await pool.end();
}

main().catch(console.error);
