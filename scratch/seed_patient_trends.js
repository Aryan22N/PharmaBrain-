const path = require('path');
const { Pool } = require('../frontend/node_modules/pg');

const connectionString = (process.env.DATABASE_URL || '').replace(/[\?&]sslmode=[^&]+/g, '');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const DEMO_ENCOUNTERS = [
  // Encounter 1 (2026-03-12)
  { date: '2026-03-12', kind: 'bp', systolic: 148, diastolic: 94, unit: 'mmHg', text: 'BP 148/94 mmHg' },
  { date: '2026-03-12', kind: 'sugar_fasting', value: 142, unit: 'mg/dL', text: 'FBS 142 mg/dL' },
  { date: '2026-03-12', kind: 'hba1c', value: 8.2, unit: '%', text: 'HbA1c 8.2%' },
  { date: '2026-03-12', kind: 'pulse', value: 86, unit: '/min', text: 'PR 86/min' },
  { date: '2026-03-12', kind: 'spo2', value: 96, unit: '%', text: 'SpO2 96%' },
  { date: '2026-03-12', kind: 'weight', value: 81.2, unit: 'kg', text: 'Weight 81.2 kg' },

  // Encounter 2 (2026-05-20)
  { date: '2026-05-20', kind: 'bp', systolic: 138, diastolic: 88, unit: 'mmHg', text: 'BP 138/88 mmHg' },
  { date: '2026-05-20', kind: 'sugar_fasting', value: 124, unit: 'mg/dL', text: 'FBS 124 mg/dL' },
  { date: '2026-05-20', kind: 'pulse', value: 80, unit: '/min', text: 'Pulse 80/min' },
  { date: '2026-05-20', kind: 'spo2', value: 97, unit: '%', text: 'SpO2 97%' },
  { date: '2026-05-20', kind: 'weight', value: 79.5, unit: 'kg', text: 'Weight 79.5 kg' },

  // Encounter 3 (2026-07-15)
  { date: '2026-07-15', kind: 'bp', systolic: 132, diastolic: 84, unit: 'mmHg', text: 'BP 132/84 mmHg' },
  { date: '2026-07-15', kind: 'sugar_fasting', value: 114, unit: 'mg/dL', text: 'FBS 114 mg/dL' },
  { date: '2026-07-15', kind: 'hba1c', value: 7.1, unit: '%', text: 'HbA1c 7.1%' },
  { date: '2026-07-15', kind: 'pulse', value: 76, unit: '/min', text: 'PR 76/min' },
  { date: '2026-07-15', kind: 'spo2', value: 98, unit: '%', text: 'SpO2 98%' },
  { date: '2026-07-15', kind: 'weight', value: 78.0, unit: 'kg', text: 'Weight 78.0 kg' },

  // Encounter 4 (2026-09-28)
  { date: '2026-09-28', kind: 'bp', systolic: 124, diastolic: 80, unit: 'mmHg', text: 'BP 124/80 mmHg' },
  { date: '2026-09-28', kind: 'sugar_fasting', value: 106, unit: 'mg/dL', text: 'FBS 106 mg/dL' },
  { date: '2026-09-28', kind: 'hba1c', value: 6.4, unit: '%', text: 'HbA1c 6.4%' },
  { date: '2026-09-28', kind: 'pulse', value: 72, unit: '/min', text: 'Pulse 72/min' },
  { date: '2026-09-28', kind: 'spo2', value: 99, unit: '%', text: 'SpO2 99%' },
  { date: '2026-09-28', kind: 'weight', value: 76.5, unit: 'kg', text: 'Weight 76.5 kg' },
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding observations for Rahul Sharma (483027156 / CCM12578)...');
    for (const patientId of ['483027156', 'CCM12578']) {
      for (const item of DEMO_ENCOUNTERS) {
        await client.query(
          `INSERT INTO observations (patient_id, obs_date, kind, systolic, diastolic, value, unit, raw_text, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()::text);`,
          [
            patientId,
            item.date,
            item.kind,
            item.systolic || null,
            item.diastolic || null,
            item.value || null,
            item.unit,
            item.text,
          ]
        );
      }
    }
    console.log('Successfully seeded longitudinal vitals encounters into Supabase observations table!');
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
