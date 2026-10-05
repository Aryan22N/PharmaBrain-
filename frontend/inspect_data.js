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
    const docs = await client.query(`
      SELECT d.id, d."userId", d."patientId", d."originalName", d."storedFilename", d."documentType", d.status, d."uploadedAt", d."filePath",
             a.summary, a."structuredResult"
      FROM "Document" d
      LEFT JOIN "Analysis" a ON d.id = a."documentId"
      ORDER BY d."uploadedAt" DESC;
    `);
    console.log(`TOTAL DOCUMENTS IN DB: ${docs.rows.length}`);
    for (const d of docs.rows) {
      console.log(`\nDoc ID: ${d.id} | User: ${d.userId} | Patient: ${d.patientId} | Status: ${d.status}`);
      console.log(`  File: ${d.originalName} | Date: ${d.uploadedAt}`);
      console.log(`  Summary: ${d.summary}`);
      const sr = d.structuredResult;
      if (sr) {
        console.log(`  Doctor:`, sr.doctor);
        console.log(`  Hospital:`, sr.hospital);
        console.log(`  Meds:`, JSON.stringify(sr.medicines));
        console.log(`  Vitals:`, JSON.stringify(sr.vitals));
        console.log(`  Diagnoses/Conditions:`, JSON.stringify(sr.diagnosis || sr.conditions));
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
