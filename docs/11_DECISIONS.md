---
Title: Architecture Decision Records
Purpose: Why key technical decisions were made
Last verified against code: 2026-10-07
Code version: no git
Owner: TBD
---

# 11 — Architecture Decisions

---

## ADR-001 — PaddleOCR as the OCR Engine

**Date:** Unknown (pre-2026-10)  
**Status:** Accepted

**Context:**  
The system needs to extract text from prescription images, including handwritten doctor entries. Multiple OCR engines were candidates: Tesseract, Google Vision API, PaddleOCR.

**Decision:**  
Use PaddleOCR (PaddlePaddle framework) as the primary OCR engine. The codebase also supports `PaddleOCR-VL` via the `OCR_ENGINE_TYPE` environment variable.

**Evidence:** Confirmed — `model/final_prescription_ocr_service_windows.py` → `run_ocr()`, `import paddle`, `from paddleocr import PaddleOCR`.

**Alternatives considered:** `Unknown` — no record of alternatives considered.

**Consequences:**
- PaddleOCR is CPU-only by default, giving 5–15 s inference per image on CPU.
- PaddlePaddle 3.x has a MKL-DNN and PIR execution engine bug requiring workarounds (`FLAGS_use_mkldnn=0`, `FLAGS_enable_pir_api=0`).
- GPU support requires CUDA setup and `use_gpu=True`.
- Model weights are downloaded on first use (~200 MB, cached in `/root/.paddlex`).

---

## ADR-002 — Google Gemini as the LLM for Structuring

**Date:** Unknown (pre-2026-10)  
**Status:** Accepted

**Context:**  
After OCR, the raw text lines need to be structured into clinical fields. A schema-constrained LLM approach was chosen over classical NLP (regex, NER).

**Decision:**  
Use Google Gemini API (`google-genai` SDK) with `response_schema=Prescription` enforced JSON output. A cascade of model candidates is used to handle model deprecations and availability.

**Evidence:** Confirmed — `model/final_prescription_ocr_service_windows.py` → `call_gemini()`, `client = genai.Client(api_key=GEMINI_API_KEY)`.

**Alternatives considered:** `Unknown` — no record.

**Consequences:**
- Gemini API calls have per-call cost.
- Patient clinical data (including names and diagnoses) is sent to Google's API. Data processing agreement required.
- Model cascade (`MODEL_CANDIDATES`) handles availability but may include invalid model names.
- `SEND_IMAGE_TO_LLM = True` sends image bytes to Gemini — enables visual handwriting transcription but increases data sent to third party.

---

## ADR-003 — Human-in-the-Loop Before Record Commit

**Date:** Unknown  
**Status:** Accepted

**Context:**  
Given the clinical safety risk of medication errors, automated commit of LLM-extracted prescriptions to patient records is not acceptable.

**Decision:**  
Every extraction has status `PENDING_USER_CONFIRMATION`. No auto-confirm path exists. Confirmation requires explicit `POST /confirm/{id}` with a confirmed record payload.

**Evidence:** Confirmed — `extractions.status`, `api_confirm()`, `require_key()` in `model/final_prescription_ocr_service_windows.py`.

**Consequences:**
- Adds a manual review step for every prescription.
- `edits_json` preserves the diff between machine output and human confirmation.
- Clinician review time is the primary throughput bottleneck at scale.

---

## ADR-004 — RapidFuzz String Matching for Medicine Lookup (Current)

**Date:** Unknown  
**Status:** Accepted (interim — to be superseded by ADR-005)

**Context:**  
Medicine names from OCR are often misspelled or abbreviated. A simple exact match would miss most drugs.

**Decision:**  
Use `rapidfuzz.process.extractOne` with `fuzz.ratio` scorer and a threshold of 85 for near-match detection, against an in-memory dict built from `medicine_master`.

**Evidence:** Confirmed — `model/final_prescription_ocr_service_windows.py` → `lookup_medicine()`.

**Consequences:**
- Fast (in-memory lookup, O(n) scan for fuzzy).
- Near matches are flagged, never auto-accepted.
- Short names (< 5 chars) are excluded from fuzzy matching to avoid cross-drug confusion.
- Does not scale well beyond ~500k records in memory.

---

## ADR-005 — Hybrid SQL + pgvector Medicine Matching (PLANNED)

**Date:** Proposed (not yet implemented)  
**Status:** Proposed

**Context:**  
The current RapidFuzz approach scans the full in-memory index for every fuzzy lookup, does not support trigram-based pre-filtering, and does not leverage semantic similarity.

**Decision:**  
Replace with: (1) SQL trigram index (`pg_trgm`) for fast candidate retrieval; (2) `pgvector` embeddings as fallback for semantically similar names; (3) relational SQL as sole source of truth for verified facts.

**Evidence:** Documented in `Doc/model.md` §10, `Doc/system_design.md` §17. Not in production code.

**Consequences:**
- Requires PostgreSQL with `pg_trgm` and `pgvector` extensions.
- More complex query logic.
- Better accuracy and scale for large medicine databases.
- The LLM must still never generate drug facts — only retrieve from SQL.

---

## ADR-006 — SQLAlchemy Core for Python DB Access

**Date:** Unknown  
**Status:** Accepted

**Context:**  
Python DB access needed to be explicit and debuggable. ORM abstractions can hide query issues.

**Decision:**  
Use SQLAlchemy Core (Table/Column definitions, explicit `select()`, `insert()`, `update()`) with `psycopg2-binary` driver for PostgreSQL. SQLite supported as fallback.

**Evidence:** Confirmed — `md_ = MetaData()`, `Table(...)` definitions in `model/final_prescription_ocr_service_windows.py`.

**Consequences:**
- No migration framework (Alembic) — schema managed via `create_all()` and manual SQL scripts.
- Explicit SQL means changes are visible and auditable.
- Changing the schema requires manually writing `ALTER TABLE` SQL.

---

## ADR-007 — Next.js App Router + pg Pool for Frontend

**Date:** Unknown  
**Status:** Accepted

**Context:**  
The frontend needs both server-rendered UI and serverless API routes that can query the database and proxy to the Python service.

**Decision:**  
Use Next.js 16 App Router. Frontend API routes use `pg.Pool` directly via `frontend/lib/db.ts` for queries against `"User"`, `"Document"`, `"Analysis"` tables. Python service manages its own tables via SQLAlchemy.

**Evidence:** Confirmed — `frontend/package.json`, `frontend/lib/db.ts`.

**Consequences:**
- Two separate DB access patterns in the same Supabase database (Next.js via `pg` pool, Python via SQLAlchemy).
- Table naming conventions differ: PascalCase quoted (Next.js) vs snake_case unquoted (Python).
- This dual-namespace design is a known technical debt item. See [docs/13_KNOWN_ISSUES.md](13_KNOWN_ISSUES.md).

---

## ADR-008 — SHA-256 Image Deduplication per Patient

**Date:** Unknown  
**Status:** Accepted

**Context:**  
If a user uploads the same prescription image twice, it should not re-run OCR and LLM, saving API cost.

**Decision:**  
Compute SHA-256 of the raw image bytes. Before processing, check if `raw_ocr` has a row with the same `image_sha256` and `patient_id` with a non-DISCARDED extraction. If found, return the existing extraction.

**Evidence:** Confirmed — `process_image()` in `model/final_prescription_ocr_service_windows.py` → `sha = hashlib.sha256(data).hexdigest()`.

**Consequences:**
- Deduplication is per-patient (same image for a different patient is processed fresh).
- A discarded extraction does not prevent re-processing the same image.
