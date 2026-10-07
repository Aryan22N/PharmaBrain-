const { query } = require('./lib/db');

async function clean() {
  try {
    const res1 = await query(`DELETE FROM "Analysis" WHERE "documentId" IN (SELECT id FROM "Document" WHERE status = 'DISCARDED');`);
    const res2 = await query(`DELETE FROM "Document" WHERE status = 'DISCARDED';`);
    console.log("Cleanup succeeded! Purged all discarded drafts.");
  } catch (err) {
    console.error("Cleanup error:", err);
  }
}

clean();
