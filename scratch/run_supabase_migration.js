const fs = require('fs');
const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const rawConnectionString = process.env.DATABASE_URL;
if (!rawConnectionString) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const connectionString = rawConnectionString.replace(/[\?&]sslmode=[^&]+/g, '');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  console.log('Connecting to Supabase PostgreSQL...');
  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, 'supabase_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying scratch/supabase_schema.sql schema to Supabase...');
    await client.query(sql);
    console.log('SUCCESS: Supabase database schema ("User", "Document", "Analysis", raw_ocr, extractions, etc.) initialized successfully!');

    // Seed default user if not existing
    const hashedPassword = '$2b$10$J65hBcUjNyvmOrjDUELC4eISq8IUsiFatGUrLsJfk6iOcgw3Nj26i'; // password: password123
    await client.query(`
      INSERT INTO "User" (id, name, email, "passwordHash", "patientId", "legacyPatientId", "createdAt")
      VALUES (1, 'Rahul Sharma', 'rahul.sharma@example.com', '${hashedPassword}', '483027156', 'CCM12578', NOW()::text)
      ON CONFLICT (email) DO NOTHING;
    `);
    console.log('Default demo user (rahul.sharma@example.com) verified.');

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
