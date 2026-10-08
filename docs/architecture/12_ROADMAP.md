---
Title: Roadmap
Purpose: Phased plan with effort, dependencies, and status
Last verified against code: 2026-10-08
Code version: a100256
Owner: TBD
---

# 12 — Roadmap

All items marked `PLANNED` are not yet in production code. All items marked `Done` are confirmed in code.

Items are ordered by impact. The first three are actionable this week.

---

## Phase 1 — Security and Stability (actionable this week)

| ID | Description | Effort | Dependencies | Status | Closes Issue |
|---|---|---|---|---|---|
| R-01 | **Set strong production secrets** — Set `JWT_SECRET`, `API_TOKEN`, `PYTHON_API_TOKEN` in all deployment environments; remove hardcoded fallback values from code | S | None | Not started | [KI-01] |
| R-02 | **Restrict CORS** — Change `allow_origins=["*"]` to `allow_origins=[FRONTEND_ORIGIN]` in the FastAPI app | S | None | Not started | [KI-02] |
| R-03 | **Add rate limiting** — Add per-IP rate limiting on `POST /ocr` to prevent abuse | S | None | Not started | [KI-03] |
| R-04 | **Legal review of Gemini data transfer** — Obtain legal counsel opinion on sending patient data to Google Gemini API under DPDPA 2023 | M | Legal | Not started | [KI-04] |
| R-05 | **TLS between Docker services** — Add nginx reverse proxy with TLS termination for internal service-to-service calls | M | None | Not started | [KI-05] |

---

## Phase 2 — Medicine Database and Accuracy (high impact)

| ID | Description | Effort | Dependencies | Status | Closes Issue |
|---|---|---|---|---|---|
| R-06 | **Ingest licensed medicine dataset** — Obtain and import NLEM / Jan Aushadhi / CDSCO catalogue into `medicine_master` with pharmacist verification | L | Licence decision | Not started | [KI-06] |
| R-07 | **Build evaluation test set** — Annotate 100 prescription images with ground-truth field values | M | None | Not started | [KI-07] |
| R-08 | **Run baseline evaluation** — Write evaluation script, run against test set, publish results in `docs/model/07_EVALUATION.md` | M | R-07 | Not started | [KI-07] |
| R-09 | **Verify `MODEL_CANDIDATES` list** — Confirm which model names are currently valid in the Google AI API; remove invalid names | S | None | Not started | [KI-08] |

---

## Phase 3 — Advanced Medicine Matching (PLANNED)

| ID | Description | Effort | Dependencies | Status | Closes Issue |
|---|---|---|---|---|---|
| R-10 | **Enable `pg_trgm` on `medicine_master.name`** — Add trigram index for fast fuzzy candidate retrieval in SQL | S | R-06 | PLANNED | [KI-09] |
| R-11 | **Add `pgvector` embedding-based fallback** — Generate drug name embeddings; add `pgvector` similarity search as fallback after trigram | L | R-10 | PLANNED | [KI-09] |
| R-12 | **Normalise medicine schema** — Split flat `medicine_master` into `medicines`, `ingredients`, `medicine_aliases`, `medicine_ingredients` | L | R-06 | PLANNED | [KI-10] |

---

## Phase 4 — Performance and Scale (PLANNED)

| ID | Description | Effort | Dependencies | Status | Closes Issue |
|---|---|---|---|---|---|
| R-13 | **GPU acceleration** — Configure PaddleOCR with NVIDIA CUDA; update `docker-compose.yml` with GPU passthrough | M | GPU hardware | PLANNED | [KI-11] |
| R-14 | **Multi-page PDF support** — Add PDF-to-image conversion (e.g. `pdf2image`) before the preprocessing stage | M | None | PLANNED | — |
| R-15 | **Cloud object storage for images** — Move `public/uploads/` to Supabase Storage Cloud Bucket (`OCR_Images/uploads/`) with public CDN URLs | M | None | Done | [KI-12] |
| R-16 | **Real-time WebSocket progress** — Replace client polling with WebSocket updates for OCR → LLM → validation pipeline stages | L | None | PLANNED | — |
| R-17 | **Formal migration framework** — Add Alembic for DB schema migrations | M | None | PLANNED | [KI-13] |
| R-18 | **Unified table schema** — Merge Next.js EHR tables (`"User"`, `"Document"`) with Python service tables under a single schema manager | L | R-17 | PLANNED | [KI-14] |
| R-19 | **Patient Initial Onboarding Flow** — 4-step health context wizard (`/onboarding`) saving profile demographics, chronic conditions, and past history into `patient_onboarding` PostgreSQL table | M | None | Done | — |
