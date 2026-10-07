const { Pool } = require('pg');

const rawConnectionString = process.env.DATABASE_URL;
if (!rawConnectionString) {
  console.error('DATABASE_URL not found in environment');
  process.exit(1);
}

const connectionString = rawConnectionString.replace(/[\?&]sslmode=[^&]+/g, '');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function fixSequences() {
  console.log('Syncing PostgreSQL auto-increment sequences in Supabase...');
  const client = await pool.connect();
  try {
    const queries = [
      `SELECT setval(pg_get_serial_sequence('"User"', 'id'), COALESCE((SELECT MAX(id) FROM "User"), 1));`,
      `SELECT setval(pg_get_serial_sequence('"Document"', 'id'), COALESCE((SELECT MAX(id) FROM "Document"), 1));`,
      `SELECT setval(pg_get_serial_sequence('"Analysis"', 'id'), COALESCE((SELECT MAX(id) FROM "Analysis"), 1));`,
      `SELECT setval(pg_get_serial_sequence('raw_ocr', 'id'), COALESCE((SELECT MAX(id) FROM raw_ocr), 1));`,
      `SELECT setval(pg_get_serial_sequence('extractions', 'id'), COALESCE((SELECT MAX(id) FROM extractions), 1));`,
      `SELECT setval(pg_get_serial_sequence('confirmed_prescriptions', 'id'), COALESCE((SELECT MAX(id) FROM confirmed_prescriptions), 1));`,
      `SELECT setval(pg_get_serial_sequence('observations', 'id'), COALESCE((SELECT MAX(id) FROM observations), 1));`,
      `SELECT setval(pg_get_serial_sequence('medicine_master', 'id'), COALESCE((SELECT MAX(id) FROM medicine_master), 1));`,
      `SELECT setval(pg_get_serial_sequence('audit_log', 'id'), COALESCE((SELECT MAX(id) FROM audit_log), 1));`
    ];

    for (const q of queries) {
      await client.query(q);
    }
    console.log('SUCCESS: All PostgreSQL primary key sequences synced successfully!');
  } catch (err) {
    console.error('Failed to sync sequences:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixSequences();
