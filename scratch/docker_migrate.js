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

const sqlSchema = `
CREATE OR REPLACE FUNCTION generate_unique_9digit_patient_id()
RETURNS VARCHAR(9) AS $$
DECLARE
    new_id VARCHAR(9);
    done BOOLEAN;
BEGIN
    done := false;
    WHILE NOT done LOOP
        new_id := (floor(random() * (999999999 - 100000000 + 1)) + 100000000)::text;
        IF NOT EXISTS (SELECT 1 FROM "User" WHERE "patientId" = new_id) THEN
            done := true;
        END IF;
    END LOOP;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS "User" (
    id SERIAL PRIMARY KEY,
    "patientId" VARCHAR(32) UNIQUE,
    "legacyPatientId" VARCHAR(32),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "createdAt" VARCHAR(64) DEFAULT CURRENT_TIMESTAMP::text
);

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "patientId" VARCHAR(32);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "legacyPatientId" VARCHAR(32);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_patient_id ON "User"("patientId");

CREATE TABLE IF NOT EXISTS "Document" (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER REFERENCES "User"(id) ON DELETE CASCADE,
    "patientId" VARCHAR(32),
    "originalName" VARCHAR(255) NOT NULL,
    "storedFilename" VARCHAR(255),
    "documentType" VARCHAR(64) DEFAULT 'PRESCRIPTION',
    "mimeType" VARCHAR(64) DEFAULT 'image/jpeg',
    "filePath" VARCHAR(255),
    status VARCHAR(64) DEFAULT 'NOT CONFIRMED',
    "uploadedAt" VARCHAR(64) DEFAULT CURRENT_TIMESTAMP::text
);

ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "patientId" VARCHAR(32);
CREATE INDEX IF NOT EXISTS idx_document_user_id ON "Document"("userId");
CREATE INDEX IF NOT EXISTS idx_document_patient_id ON "Document"("patientId");

CREATE TABLE IF NOT EXISTS "Analysis" (
    id SERIAL PRIMARY KEY,
    "documentId" INTEGER REFERENCES "Document"(id) ON DELETE CASCADE,
    summary TEXT,
    "structuredResult" JSONB,
    "isDemo" BOOLEAN DEFAULT false,
    "createdAt" VARCHAR(64) DEFAULT CURRENT_TIMESTAMP::text
);
CREATE INDEX IF NOT EXISTS idx_analysis_document_id ON "Analysis"("documentId");

CREATE TABLE IF NOT EXISTS raw_ocr (
    id SERIAL PRIMARY KEY,
    image_sha256 VARCHAR(64),
    patient_id VARCHAR(64),
    filename VARCHAR(255),
    ocr_engine VARCHAR(64),
    image_w INTEGER,
    image_h INTEGER,
    avg_conf FLOAT,
    lines_json TEXT,
    created_at VARCHAR(32)
);
CREATE INDEX IF NOT EXISTS idx_raw_ocr_patient_id ON raw_ocr(patient_id);

CREATE TABLE IF NOT EXISTS extractions (
    id SERIAL PRIMARY KEY,
    raw_ocr_id INTEGER,
    llm_model VARCHAR(64),
    analysis_json TEXT,
    status VARCHAR(32),
    created_at VARCHAR(32)
);
CREATE INDEX IF NOT EXISTS idx_extractions_raw_ocr ON extractions(raw_ocr_id);
CREATE INDEX IF NOT EXISTS idx_extractions_status ON extractions(status);

CREATE TABLE IF NOT EXISTS confirmed_prescriptions (
    id SERIAL PRIMARY KEY,
    extraction_id INTEGER UNIQUE,
    patient_id VARCHAR(64),
    rx_date VARCHAR(10),
    hospital VARCHAR(255),
    doctor VARCHAR(255),
    doctor_reg_no VARCHAR(64),
    data_json TEXT,
    edits_json TEXT,
    confirmed_by VARCHAR(64),
    confirmed_at VARCHAR(32)
);
CREATE INDEX IF NOT EXISTS idx_confirmed_prescriptions_patient ON confirmed_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_confirmed_prescriptions_rx_date ON confirmed_prescriptions(rx_date);

CREATE TABLE IF NOT EXISTS observations (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(64),
    prescription_id INTEGER,
    obs_date VARCHAR(10),
    kind VARCHAR(24),
    systolic FLOAT,
    diastolic FLOAT,
    value FLOAT,
    unit VARCHAR(16),
    raw_text VARCHAR(120),
    created_at VARCHAR(32)
);
CREATE INDEX IF NOT EXISTS idx_observations_patient ON observations(patient_id);
CREATE INDEX IF NOT EXISTS idx_observations_kind_date ON observations(kind, obs_date);

CREATE TABLE IF NOT EXISTS medicine_master (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) UNIQUE,
    generic VARCHAR(160),
    composition TEXT,
    uses TEXT,
    strengths_mg VARCHAR(200),
    source VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    ts VARCHAR(32),
    event VARCHAR(40),
    extraction_id INTEGER,
    detail TEXT
);
`;

async function main() {
  console.log('Connecting to Supabase PostgreSQL from container...');
  const client = await pool.connect();
  try {
    await client.query(sqlSchema);
    console.log('Successfully created all tables ("User", "Document", "Analysis", raw_ocr, extractions, confirmed_prescriptions, observations, medicine_master, audit_log) in Supabase!');

    const hashedPassword = '$2b$10$J65hBcUjNyvmOrjDUELC4eISq8IUsiFatGUrLsJfk6iOcgw3Nj26i';
    await client.query(`
      INSERT INTO "User" (id, name, email, "passwordHash", "patientId", "legacyPatientId", "createdAt")
      VALUES (1, 'Rahul Sharma', 'rahul.sharma@example.com', '${hashedPassword}', '483027156', 'CCM12578', NOW()::text)
      ON CONFLICT (email) DO NOTHING;
    `);
    console.log('Default user seeded successfully.');
  } catch (err) {
    console.error('Migration execution error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
