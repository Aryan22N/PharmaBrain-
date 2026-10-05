-- ==============================================================================
-- Patient Longitudinal Timeline & Recorded Medicines Tables (Supabase)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS patient_timeline_events (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(64) NOT NULL,
    user_id INTEGER,
    event_date VARCHAR(32) NOT NULL,
    category VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    source VARCHAR(64) DEFAULT 'Manual Entry',
    reliability VARCHAR(64) DEFAULT 'Low',
    verification_status VARCHAR(64) DEFAULT 'Patient Confirmed',
    facility VARCHAR(160),
    doctor VARCHAR(160),
    reference_id VARCHAR(80),
    is_conflicting BOOLEAN DEFAULT false,
    conflict_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_timeline_patient_id ON patient_timeline_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_timeline_event_date ON patient_timeline_events(event_date);

CREATE TABLE IF NOT EXISTS patient_medications (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(64) NOT NULL,
    user_id INTEGER,
    name VARCHAR(160) NOT NULL,
    strength VARCHAR(64),
    status VARCHAR(32) DEFAULT 'ACTIVE',
    indication VARCHAR(160),
    frequency VARCHAR(80),
    route VARCHAR(40) DEFAULT 'Oral',
    start_date VARCHAR(32),
    end_date VARCHAR(32),
    doctor VARCHAR(160),
    reference_id VARCHAR(80),
    is_conflicting BOOLEAN DEFAULT false,
    conflict_details TEXT,
    source VARCHAR(64) DEFAULT 'Hospital HMS',
    reliability VARCHAR(64) DEFAULT 'High',
    verification_status VARCHAR(64) DEFAULT 'Hospital Verified',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_medications_patient_id ON patient_medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_medications_status ON patient_medications(status);
