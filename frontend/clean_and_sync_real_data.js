const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const envContent = fs.readFileSync(path.join(__dirname, ".env.local"), "utf8");
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    // 1. Remove all old raw/fake dummy seed records from patient_timeline_events and patient_medications
    await client.query("DELETE FROM patient_timeline_events WHERE patient_id IN ('483027156', 'CCM12578');");
    await client.query("DELETE FROM patient_medications WHERE patient_id IN ('483027156', 'CCM12578');");

    // 2. Insert ONLY the real patient self-entry and symptom report for discrepancy tracking
    await client.query(`
      INSERT INTO patient_timeline_events (
        patient_id, user_id, event_date, category, title, description,
        source, reliability, verification_status, facility, doctor, reference_id,
        is_conflicting, conflict_details
      ) VALUES
      (
        '483027156', 1, '2026-09-12', 'Symptom Report',
        'Patient Symptom Note: Gastrointestinal Discomfort',
        'Reported nausea and abdominal heaviness 1-2 hours following evening Metformin dose.',
        'Manual Entry', 'Low', 'Patient Confirmed', 'Patient Home Portal',
        'Rahul Sharma (Patient Self-Report)', 'PATIENT-SYMPTOM-2026-0912',
        false, null
      ),
      (
        '483027156', 1, '2026-09-11', 'Medication',
        'Discrepant Medication Self-Entry: Metformin 1000mg',
        'Patient self-reported increasing Metformin dose to 1000mg. Flagged conflicting with hospital prescribed 500mg regimen.',
        'Manual Entry', 'Low', 'Conflicting Record', 'Patient Home Portal',
        'Rahul Sharma (Patient Self-Entry)', 'PATIENT-MED-2026-0911',
        true, 'HMS Reference: Metformin 500 mg BID (10 Sep 2026) vs Patient Self-Entry: Metformin 1000 mg (11 Sep 2026).'
      );
    `);

    // 3. Insert the conflicting self-entry into patient_medications to track the discrepancy
    await client.query(`
      INSERT INTO patient_medications (
        patient_id, user_id, name, strength, status, indication,
        frequency, route, start_date, doctor, reference_id,
        is_conflicting, conflict_details, source, reliability, verification_status
      ) VALUES
      (
        '483027156', 1, 'Metformin Hydrochloride', '500 mg', 'ACTIVE',
        'Type 2 Diabetes Glycemic Control', 'Twice daily after meals', 'Oral',
        '2026-09-10', 'Dr. Priya Deshmukh', 'HMS-PRESCRIPTION-2026-0910',
        true, 'Conflicting information detected — Hospital HMS record is shown as the higher-priority source. The patient-entered record has been retained for history.',
        'Hospital HMS', 'High', 'Hospital Verified'
      ),
      (
        '483027156', 1, 'Telmisartan', '40 mg', 'ACTIVE',
        'Hypertension Management', 'Once daily in the morning', 'Oral',
        '2026-04-05', 'Dr. Priya Deshmukh', 'HMS-OPD-2026-0322-RX',
        false, null, 'Hospital HMS', 'High', 'Hospital Verified'
      );
    `);

    console.log("Successfully cleaned dummy seeds and synced authentic records!");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
