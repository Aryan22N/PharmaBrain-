const { Pool } = require("pg");
require("dotenv").config({ path: "frontend/.env.local" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("Connected to DB:", process.env.DATABASE_URL.split("@")[1]);
    
    // 1. Documents
    const docsRes = await client.query("SELECT id, patient_id, user_id, filename, status, structured_result, summary, created_at FROM documents ORDER BY id ASC;");
    console.log(`\n=== TOTAL DOCUMENTS (${docsRes.rows.length}) ===`);
    for (const d of docsRes.rows) {
      let sr = d.structured_result;
      if (typeof sr === "string") {
        try { sr = JSON.parse(sr); } catch(e) {}
      }
      const meds = sr?.medicines || [];
      const date = sr?.date_iso || d.created_at;
      const doc = sr?.doctor || "N/A";
      const hosp = sr?.hospital || "N/A";
      console.log(`Doc ID: ${d.id} | Patient: ${d.patient_id} | Status: ${d.status} | File: ${d.filename}`);
      console.log(`  Date: ${date} | Doctor: ${JSON.stringify(doc)} | Hospital: ${hosp}`);
      console.log(`  Meds count: ${meds.length}`);
      if (meds.length > 0) {
        console.log(`  Meds:`, JSON.stringify(meds));
      }
      console.log(`  Summary: ${d.summary}`);
      console.log("-----------------------------------------");
    }

    // 2. Extractions
    const extRes = await client.query("SELECT id, patient_id, user_id, status, structured_data, created_at FROM extractions ORDER BY id ASC;");
    console.log(`\n=== TOTAL EXTRACTIONS (${extRes.rows.length}) ===`);
    for (const e of extRes.rows) {
      let sd = e.structured_data;
      if (typeof sd === "string") {
        try { sd = JSON.parse(sd); } catch(err) {}
      }
      const meds = sd?.medicines || [];
      console.log(`Ext ID: ${e.id} | Patient: ${e.patient_id} | Status: ${e.status} | Meds: ${meds.length}`);
      if (meds.length > 0) {
        console.log(`  Meds:`, JSON.stringify(meds));
      }
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
