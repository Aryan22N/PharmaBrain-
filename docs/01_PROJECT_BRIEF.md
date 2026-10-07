---
Title: Project Brief
Purpose: Problem statement, scope, success criteria, and constraints
Last verified against code: 2026-10-07
Code version: no git
Owner: TBD
---

# 01 — Project Brief

## Problem and Users

Paper prescriptions in Indian clinical settings (outpatient departments, cancer care, general medicine) are handwritten or printed, and are a primary source of medication errors. Patients and care-team members cannot reliably read, store, or track prescription history.

**Users:**
- **Patients** — need to store, review, and share their prescription history.
- **Clinicians / pharmacists** — need to verify that the system's extraction is correct before the record is committed.
- **Hospital administrators** — (future) need aggregate reporting on prescribing patterns.

## Vision

A single-hospital deployment where any patient can photograph a prescription, upload it through a web portal, and receive a structured, clinician-verified medical record — with medicine names verified against an authenticated drug database and vital signs tracked over time.

## Scope: In Scope (Now)

- Upload image (JPEG, PNG, WebP, max 10 MB) of a prescription.
- Preprocess, run PaddleOCR, and send to Google Gemini for structuring.
- Medicine name lookup against `medicine_master` (exact + fuzzy match via RapidFuzz).
- Human-in-the-loop review UI where the clinician can edit fields and confirm.
- Confirmed records stored in Supabase PostgreSQL; vitals extracted to `observations`.
- Patient timeline and vitals trend views.
- Docker-based deployment.

## Scope: Out of Scope (Non-Goals)

- Autonomous prescription dispensing or signing without human confirmation.
- Autonomous diagnosis or clinical decision making.
- Full hospital ERP integration.
- Multi-page PDF prescription support. (PLANNED)
- GPU-accelerated inference. (PLANNED)
- Mobile app. (PLANNED)
- HL7 FHIR / hospital EMR integration. (PLANNED)

## Success Criteria

Measurable targets linked to evaluation methodology in [docs/07_EVALUATION.md](07_EVALUATION.md):

| Criterion | Target |
|---|---|
| Patient header extraction accuracy (name, UHID, date) | > 95% on annotated test set |
| Medicine name extraction precision | > 90% on annotated test set |
| Medicine database match rate (starter set) | 100% exact match for the 27 starter drugs |
| Clinician review cycle time | < 60 seconds per prescription |
| No phantom medicines (hallucinations) | 0 hallucinations when `SEND_IMAGE_TO_LLM = True` |

> No evaluation has been run against a formal test set yet. See [docs/07_EVALUATION.md](07_EVALUATION.md).

## Constraints

| Category | Constraint |
|---|---|
| Regulatory | Outputs are clinical-support drafts; clinician confirmation is mandatory before any use |
| Privacy (India) | Digital Personal Data Protection Act, 2023 — patient data must be handled lawfully; confirm with legal counsel |
| Cost | Google Gemini API calls incur per-call costs; optimize by using `gemini-2.5-flash` as primary candidate |
| Infrastructure | Single-host Docker deployment; no horizontal scaling in current design |
| OCR device | CPU-only PaddleOCR in Docker (5–15 s per image); GPU requires separate configuration |
| Medicine data | Starter set of 27 drugs only; production-grade coverage requires a licensed drug dataset |

## Assumptions

- The system is deployed within a trusted hospital network; network-level access control is the responsibility of the operator.
- The Supabase PostgreSQL instance is accessible and credentials are correctly configured.
- The clinician always reviews the draft before confirmation — the system does not auto-confirm.

## Open Questions

- Which licensed Indian medicine dataset (CDSCO / Jan Aushadhi / NLEM) will be used for production? `Unknown`
- Where will prescription images be stored long-term — local disk or cloud object storage? `Unknown`
- Is there a specific legal or regulatory certification required for clinical deployment in this hospital? `Unknown`
