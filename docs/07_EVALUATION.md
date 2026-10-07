---
Title: Evaluation
Purpose: Metrics, test set, how to run evaluation, and current results
Last verified against code: 2026-10-07
Code version: no git
Owner: TBD
---

# 07 — Evaluation

## Metrics and Definitions

| Metric | Definition |
|---|---|
| **Character Error Rate (CER)** | `(S + D + I) / N` where S=substitutions, D=deletions, I=insertions in the OCR text vs. ground-truth transcription, N=total characters in ground truth. Lower is better. |
| **Field-level Precision** | `TP / (TP + FP)` for a given field (e.g. `patient_name`): fraction of extracted values that are correct. |
| **Field-level Recall** | `TP / (TP + FN)`: fraction of ground-truth values that were extracted. |
| **Field-level F1** | `2 × Precision × Recall / (Precision + Recall)` |
| **Medicine mapping top-1 accuracy** | Fraction of extracted medicine names where the database maps to the exact correct drug on the first result. |
| **Medicine mapping top-3 accuracy** | Fraction where the correct drug appears in the top-3 candidates. |
| **Quality gate precision** | Fraction of `HIGH_CONFIDENCE` gates that actually had no extraction errors on manual review. |

**Critical fields for evaluation:** `name`, `strength`, `frequency`, `duration` (the `CRITICAL_FIELDS` constant in code).

---

## Test Set

**No formal evaluation test set exists yet.** No evaluation has been run against a labelled dataset.

The only documented test case is the Dalia Kundu oncology prescription used during accuracy debugging (referenced in `Doc/accuracy_improvement_plan.md`). This is not an annotated benchmark.

**What is needed (PLANNED):**
- A set of at least 100 prescription images with ground-truth annotations for all fields.
- Images must be anonymised or use synthetic patient data before inclusion in the test set.
- Annotations should cover: patient header fields, all medicine fields, vitals, and diagnosis.

---

## How to Run Evaluation

No evaluation script exists yet. Running evaluation requires:

1. A labelled test set (see above).
2. A script that calls `POST /ocr` for each image, compares the extraction against ground truth, and computes the metrics above.

To manually test a single prescription:
```bash
curl -X POST http://localhost:8000/ocr \
  -H "X-API-Key: rx_local_dev_token_2026_secure" \
  -F "file=@test_prescription.jpg" \
  -F "patient_id=TEST001"
```

---

## Latest Results

**No evaluation has been run against a formal test set.**

The accuracy improvement plan (`Doc/accuracy_improvement_plan.md`) states target metrics after the Phase 1–3 upgrades were applied. These are aspirational targets, not measured results:

| Metric | Target stated in plan |
|---|---|
| Patient header accuracy | > 98% |
| Doctor / hospital extraction | > 95% |
| Medicine name & dose precision | > 95% |
| Clinical diagnosis & advice extraction | > 90% |

These numbers were not measured — they are engineering targets. They are documented here as `UNVERIFIED`. See [docs/13_KNOWN_ISSUES.md](13_KNOWN_ISSUES.md) — "No evaluation has been run".

---

## Notes on Performance Measurements Seen in Old Docs

The old `Doc/system_design.md` contained statements like "253,313 medicine records" and "reduces OCR processing time from ~15s to ~2s per page". These are not benchmarked measurements — they are log output observations and estimates. They are marked `UNVERIFIED` in this documentation set.
