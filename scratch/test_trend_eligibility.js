/**
 * Comprehensive Automated Verification Suite for Trend Analysis Engine
 * Tests all requirements from USER_REQUEST:
 * 1. Minimum prescription requirement (<5 dates vs >=5 dates)
 * 2. Unconfirmed / discarded / invalid date exclusion
 * 3. Mirror deduplication & same-date consolidation
 * 4. Metric-specific data sufficiency checks
 * 5. Hash fingerprinting & stale cache detection
 * 6. Explicit generation & refresh behavior
 * 7. Gemini quota / error resilience
 */

const path = require("path");
const { Pool } = require(path.resolve(__dirname, "../frontend/node_modules/pg"));

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres.dvydfsahkqzgluusdsnn:arn2252006%40123@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// Auth token for Rahul Sharma (userId: 1, patientId: 483027156)
const DEMO_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoicmFodWwuc2hhcm1hQGV4YW1wbGUuY29tIiwibmFtZSI6IlJhaHVsIFNoYXJtYSIsImlhdCI6MTc5MTEyNTc5NSwiZXhwIjoxNzkxNzMwNTk1fQ.GQqUJVwTFcCM45qS1S11Ab8yiZuSFxYnhBwVDOlUvS0";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runQuery(sql, params = []) {
  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows;
  } finally {
    client.release();
  }
}

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName} - ${details}`);
    failedTests++;
  }
}

async function main() {
  console.log("==================================================================");
  console.log("TREND ANALYSIS ENGINE - COMPREHENSIVE VERIFICATION SUITE");
  console.log("==================================================================");

  // ------------------------------------------------------------------
  // TEST 1: Security - Unauthorized Access
  // ------------------------------------------------------------------
  console.log("\n[TEST GROUP 1] Security & Authorization");
  try {
    const res = await fetch(`${BASE_URL}/api/patient/trends`);
    assert(res.status === 401, "Rejects request without auth token (401)");
  } catch (e) {
    assert(false, "Rejects request without auth token", e.message);
  }

  // ------------------------------------------------------------------
  // TEST 2: Current Ineligible State (< 5 Distinct Dates)
  // ------------------------------------------------------------------
  console.log("\n[TEST GROUP 2] Behavior with Fewer than 5 Confirmed Prescriptions");
  try {
    const res = await fetch(`${BASE_URL}/api/patient/trends`, {
      headers: { Authorization: `Bearer ${DEMO_TOKEN}` },
    });
    assert(res.ok, "API returns 200 for authenticated patient");
    const data = await res.json();

    assert(data.isEligible === false, "isEligible is false when < 5 distinct dates exist");
    assert(data.eligibility.requiredCount === 5, "requiredCount is strictly 5");
    assert(data.eligibility.distinctDatesCount < 5, `distinctDatesCount (${data.eligibility.distinctDatesCount}) is less than 5`);
    assert(data.aiSummary === null, "aiSummary is NULL (Gemini was NOT called)");
    assert(data.trends.clinicalSummary.overallRiskTier === "Insufficient Longitudinal History", "overallRiskTier is 'Insufficient Longitudinal History'");
    
    // Check individual measurements remain accessible
    const bpObsCount = data.trends.metrics.bp.count;
    assert(bpObsCount > 0, `Historical measurements remain accessible (BP count: ${bpObsCount})`);
    
    // Trajectory conclusions must be suppressed
    assert(data.trends.metrics.bp.overallTrend === "insufficient_data", "BP overallTrend is suppressed to 'insufficient_data'");
  } catch (e) {
    assert(false, "Ineligible state check failed", e.message);
  }

  // ------------------------------------------------------------------
  // TEST 3: Deduplication, Unconfirmed, and Discarded Records
  // ------------------------------------------------------------------
  console.log("\n[TEST GROUP 3] Prescription Filtering, Mirror Elimination & Validation");
  try {
    const res = await fetch(`${BASE_URL}/api/patient/trends`, {
      headers: { Authorization: `Bearer ${DEMO_TOKEN}` },
    });
    const data = await res.json();
    const rxList = data.eligibility.eligiblePrescriptions;

    // Check Document 15 (NOT CONFIRMED) is excluded
    const doc15 = rxList.find(r => r.documentId === 15 || r.extractionId === 16);
    assert(!doc15, "Unconfirmed prescriptions (status != CONFIRMED) are excluded");

    // Check database mirrors: Document 14 vs confirmed_prescriptions 10 on 2026-07-22
    const dates = rxList.map(r => r.date);
    const date722Count = dates.filter(d => d === "2026-07-22").length;
    assert(date722Count <= 1, "Database mirrors on same date/extraction are unified into 1 record");

    // Multiple prescriptions on the same date count as 1 distinct date
    const distinctDates = data.eligibility.distinctDates;
    const uniqueDatesSet = new Set(distinctDates);
    assert(distinctDates.length === uniqueDatesSet.size, "Multiple prescriptions on same date do NOT count as separate time points");
  } catch (e) {
    assert(false, "Deduplication and filtering failed", e.message);
  }

  // ------------------------------------------------------------------
  // TEST 4: Metric-Specific Data Sufficiency
  // ------------------------------------------------------------------
  console.log("\n[TEST GROUP 4] Metric-Specific Data Sufficiency Checks");
  try {
    const res = await fetch(`${BASE_URL}/api/patient/trends`, {
      headers: { Authorization: `Bearer ${DEMO_TOKEN}` },
    });
    const data = await res.json();
    const m = data.trends.metrics;

    for (const key of ["bp", "glucose", "hba1c", "pulse", "spo2", "weight"]) {
      const metric = m[key];
      if (metric.count < 2) {
        assert(metric.hasSufficientData === false, `${key}: count < 2 sets hasSufficientData = false`);
        assert(Boolean(metric.insufficientDataReason), `${key}: provides insufficientDataReason: "${metric.insufficientDataReason}"`);
      } else {
        assert(metric.hasSufficientData === true, `${key}: count >= 2 sets hasSufficientData = true`);
      }
    }
  } catch (e) {
    assert(false, "Metric sufficiency check failed", e.message);
  }

  // ------------------------------------------------------------------
  // TEST 5: Transition to Eligible State (>= 5 Distinct Clinical Dates)
  // ------------------------------------------------------------------
  console.log("\n[TEST GROUP 5] Eligibility Unlock (>= 5 Distinct Clinical Dates) & Caching Lifecycle");
  const testDates = ["2026-01-15", "2026-02-20", "2026-03-25", "2026-04-30", "2026-06-05"];
  const insertedDocIds = [];

  try {
    // Clean any prior test documents
    await runQuery(`DELETE FROM "Document" WHERE "originalName" LIKE 'TEST_SUITE_RX_%' AND "userId" = 1;`);
    await runQuery(`DELETE FROM patient_trends_cache WHERE patient_id = '483027156';`);

    // Insert 5 confirmed test prescriptions with distinct clinical dates
    for (let i = 0; i < testDates.length; i++) {
      const dt = testDates[i];
      const docName = `TEST_SUITE_RX_${i + 1} - ${dt}`;
      const docRows = await runQuery(
        `INSERT INTO "Document" ("userId", "patientId", "originalName", "storedFilename", "documentType", "mimeType", "filePath", status, "uploadedAt")
         VALUES (1, '483027156', $1, '/sample_prescription.png', 'PRESCRIPTION', 'image/jpeg', $2, 'CONFIRMED', NOW())
         RETURNING id;`,
        [docName, `/extractions/test_${i + 1}`]
      );
      const docId = docRows[0].id;
      insertedDocIds.push(docId);

      await runQuery(
        `INSERT INTO "Analysis" ("documentId", summary, "structuredResult", "isDemo", "createdAt")
         VALUES ($1, 'Test Clinical Prescription', $2, false, NOW());`,
        [
          docId,
          JSON.stringify({
            date_iso: dt,
            hospital: `Apollo Specialty Clinic ${i + 1}`,
            doctor: `Dr. Specialist ${i + 1}`,
            medicines: [{ name: "Telmisartan", strength: "40mg" }],
            vitals: [
              { kind: "bp", name: "Blood Pressure", parsed: { systolic: 130 - i * 2, diastolic: 84 - i } },
              { kind: "sugar_fasting", name: "Fasting Blood Sugar", parsed: { value: 120 - i * 3, unit: "mg/dL" } },
            ],
          }),
        ]
      );
    }

    // 5A. Test Normal Load when Eligible with No Cache (State 4)
    console.log("  Testing State 4: Eligible with No Cache...");
    const resNoCache = await fetch(`${BASE_URL}/api/patient/trends`, {
      headers: { Authorization: `Bearer ${DEMO_TOKEN}` },
    });
    const dataNoCache = await resNoCache.json();
    assert(dataNoCache.isEligible === true, "isEligible is true with >= 5 distinct dates");
    assert(dataNoCache.eligibility.distinctDatesCount >= 5, `distinctDatesCount is ${dataNoCache.eligibility.distinctDatesCount} (>= 5)`);
    assert(dataNoCache.aiSummary === null, "Normal page load does NOT invoke Gemini (aiSummary is null)");
    assert(dataNoCache.cached === false, "cached is false");

    // 5B. Test Explicit Generation (State 4 -> State 5: ?generate=true)
    console.log("  Testing State 5: Explicit User Click to Generate AI Summary (?generate=true)...");
    const resGen = await fetch(`${BASE_URL}/api/patient/trends?generate=true`, {
      headers: { Authorization: `Bearer ${DEMO_TOKEN}` },
    });
    const dataGen = await resGen.json();
    assert(dataGen.isEligible === true, "Eligibility preserved during generation");
    assert(dataGen.aiSummary !== null, "AI summary generated successfully");
    assert(typeof dataGen.aiSummary?.narrative === "string" && dataGen.aiSummary.narrative.length > 20, "AI narrative is non-empty string");
    assert(Array.isArray(dataGen.aiSummary?.keyHighlights) && dataGen.aiSummary.keyHighlights.length > 0, "AI keyHighlights is non-empty array");
    assert(Array.isArray(dataGen.aiSummary?.questionsForDoctor) && dataGen.aiSummary.questionsForDoctor.length > 0, "AI questionsForDoctor is non-empty array");
    assert(Boolean(dataGen.aiSummary?.safetyDisclaimer), "safetyDisclaimer is present in AI response");
    const initialHash = dataGen.hash;

    // 5C. Test Instant Cache Hit on Subsequent Page Load (0ms)
    console.log("  Testing State 5: Subsequent page load reuses cache...");
    const resCached = await fetch(`${BASE_URL}/api/patient/trends`, {
      headers: { Authorization: `Bearer ${DEMO_TOKEN}` },
    });
    const dataCached = await resCached.json();
    assert(dataCached.cached === true, "Second load returns cached: true");
    assert(dataCached.isStale === false, "Second load returns isStale: false");
    assert(dataCached.aiSummary?.narrative === dataGen.aiSummary.narrative, "Cached narrative matches generated narrative");

    // 5D. Test Clinical Data Change -> Stale Summary (State 6)
    console.log("  Testing State 6: Clinical data changes -> summary marked isStale: true...");
    // Add a new observation date to trigger fingerprint divergence
    const newDocRows = await runQuery(
      `INSERT INTO "Document" ("userId", "patientId", "originalName", "storedFilename", "documentType", "mimeType", "filePath", status, "uploadedAt")
       VALUES (1, '483027156', 'TEST_SUITE_NEW_DATE - 2026-07-10', '/sample_prescription.png', 'PRESCRIPTION', 'image/jpeg', '/extractions/test_new', 'CONFIRMED', NOW())
       RETURNING id;`
    );
    insertedDocIds.push(newDocRows[0].id);
    await runQuery(
      `INSERT INTO "Analysis" ("documentId", summary, "structuredResult", "isDemo", "createdAt")
       VALUES ($1, 'New Visit Prescription', $2, false, NOW());`,
      [
        newDocRows[0].id,
        JSON.stringify({
          date_iso: "2026-07-10",
          hospital: "New City Hospital",
          doctor: "Dr. New Doctor",
          vitals: [{ kind: "bp", name: "BP", parsed: { systolic: 118, diastolic: 76 } }],
        }),
      ]
    );

    const resStale = await fetch(`${BASE_URL}/api/patient/trends`, {
      headers: { Authorization: `Bearer ${DEMO_TOKEN}` },
    });
    const dataStale = await resStale.json();
    assert(dataStale.cached === true, "Cached entry returned without calling Gemini");
    assert(dataStale.isStale === true, "isStale is true because clinical data fingerprint changed");
    assert(Boolean(dataStale.staleReason), `staleReason provided: "${dataStale.staleReason}"`);
    assert(dataStale.hash !== initialHash, "Fingerprint changed after data modification");

    // 5E. Test Explicit Refresh Analysis (?force=true)
    console.log("  Testing State 7/5: User clicks Refresh Analysis (?force=true)...");
    await new Promise((r) => setTimeout(r, 1500));
    const resRefreshed = await fetch(`${BASE_URL}/api/patient/trends?force=true`, {
      headers: { Authorization: `Bearer ${DEMO_TOKEN}` },
    });
    const dataRefreshed = await resRefreshed.json();
    assert(dataRefreshed.isStale === false, "Force refresh returns isStale: false with fresh cache");
    assert(
      dataRefreshed.aiSummary !== null || (dataRefreshed.aiError && Boolean(dataRefreshed.aiError.code)),
      "Force refresh returns fresh AI summary or structured quota/error state"
    );
  } finally {
    // Clean up test documents
    console.log("\n[CLEANUP] Removing test artifacts from database...");
    if (insertedDocIds.length > 0) {
      await runQuery(`DELETE FROM "Analysis" WHERE "documentId" = ANY($1::int[]);`, [insertedDocIds]);
      await runQuery(`DELETE FROM "Document" WHERE id = ANY($1::int[]);`, [insertedDocIds]);
    }
    await runQuery(`DELETE FROM patient_trends_cache WHERE patient_id = '483027156';`);
    console.log("  ✓ Test artifacts cleaned up.");
  }

  // ------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------
  console.log("\n==================================================================");
  console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("==================================================================");

  await pool.end();
  process.exit(failedTests > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test execution failed with fatal error:", err);
  pool.end();
  process.exit(1);
});
