-- =========================================================================
-- Supabase PostgreSQL Schema & Security Migration Script
-- Project: Prescription Intelligence / Patient-Centric DMR
-- =========================================================================

-- 1. Helper function for unique 9-digit non-sequential Patient ID generation
CREATE OR REPLACE FUNCTION generate_unique_9digit_patient_id()
RETURNS VARCHAR(9) AS $$
DECLARE
    new_id VARCHAR(9);
    done BOOLEAN;
BEGIN
    done := false;
    WHILE NOT done LOOP
        -- Generate random 9-digit number between 100000000 and 999999999
        new_id := (floor(random() * (999999999 - 100000000 + 1)) + 100000000)::text;
        IF NOT EXISTS (SELECT 1 FROM "User" WHERE "patientId" = new_id) THEN
            done := true;
        END IF;
    END LOOP;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- 2. User Table (with 9-digit patientId and legacyPatientId for backward compatibility)
CREATE TABLE IF NOT EXISTS "User" (
    id SERIAL PRIMARY KEY,
    "patientId" VARCHAR(32) UNIQUE,
    "legacyPatientId" VARCHAR(32),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "createdAt" VARCHAR(64) DEFAULT CURRENT_TIMESTAMP::text
);

-- Ensure patientId column exists if table was previously created
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "patientId" VARCHAR(32);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "legacyPatientId" VARCHAR(32);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_patient_id ON "User"("patientId");

-- 3. Document Table (stores uploaded and confirmed prescriptions & reports)
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

-- 4. Analysis Table (stores structured OCR results & clinical narratives)
CREATE TABLE IF NOT EXISTS "Analysis" (
    id SERIAL PRIMARY KEY,
    "documentId" INTEGER REFERENCES "Document"(id) ON DELETE CASCADE,
    summary TEXT,
    "structuredResult" JSONB,
    "isDemo" BOOLEAN DEFAULT false,
    "createdAt" VARCHAR(64) DEFAULT CURRENT_TIMESTAMP::text
);
CREATE INDEX IF NOT EXISTS idx_analysis_document_id ON "Analysis"("documentId");

-- 5. Python OCR Service Tables
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

-- 6. Row Level Security (RLS) Setup
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Analysis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmed_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_ocr ENABLE ROW LEVEL SECURITY;
ALTER TABLE extractions ENABLE ROW LEVEL SECURITY;

-- Allow backend services and connection pooler full access via service role
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_user') THEN
        CREATE POLICY service_role_all_user ON "User" FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_document') THEN
        CREATE POLICY service_role_all_document ON "Document" FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_analysis') THEN
        CREATE POLICY service_role_all_analysis ON "Analysis" FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_rx') THEN
        CREATE POLICY service_role_all_rx ON confirmed_prescriptions FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_obs') THEN
        CREATE POLICY service_role_all_obs ON observations FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 7. Ensure default user has both 9-digit patientId and legacyPatientId
UPDATE "User"
SET "patientId" = '483027156',
    "legacyPatientId" = 'CCM12578'
WHERE email = 'rahul.sharma@example.com' AND ("patientId" IS NULL OR "patientId" = '');

-- Backfill any existing users without a patientId
UPDATE "User"
SET "patientId" = (floor(random() * (999999999 - 100000000 + 1)) + 100000000)::text
WHERE "patientId" IS NULL OR "patientId" = '';
