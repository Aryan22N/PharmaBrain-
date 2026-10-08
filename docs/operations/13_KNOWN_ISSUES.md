---
Title: Known Issues
Purpose: Bugs, security gaps, technical debt, and doc gaps
Last verified against code: 2026-10-08
Code version: a100256
Owner: TBD
---

# 13 — Known Issues

---

## Bugs and Risks

### [KI-01] Hardcoded JWT secret fallback — 🔴 Critical

**Evidence:** `frontend/lib/auth.ts` → `const JWT_SECRET = process.env.JWT_SECRET || 'pharma_brain_patient_dmr_jwt_secret_key_2026_super_secure!'`  
**Impact:** If `JWT_SECRET` is not set in production, a known public string is used — any JWT can be forged.  
**Fix:** Always set `JWT_SECRET` in the frontend production environment. Remove or fail-hard on the fallback.

---

### [KI-02] CORS open to all origins — 🟠 High

**Evidence:** `model/final_prescription_ocr_service_windows.py` → `CORSMiddleware(allow_origins=["*"])`  
**Impact:** Any web page can make authenticated requests to the Python API (with the API key).  
**Fix:** Set `allow_origins=[FRONTEND_ORIGIN]` in production. The `FRONTEND_ORIGIN` env var is already plumbed.

---

### [KI-03] No rate limiting on `POST /ocr` — 🟠 High

**Evidence:** `api_ocr()` — no rate limit middleware.  
**Impact:** Unauthenticated `/api/ocr` endpoint and authenticated `/ocr` endpoint can be called repeatedly, consuming Gemini API credits and compute.  
**Fix:** Add `slowapi` or similar FastAPI rate-limiting middleware.

---

### [KI-04] Patient data sent to Google Gemini API without masking — 🔴 Critical

**Evidence:** `call_gemini()` — only emails/phones masked; patient name, UHID, diagnosis, medicines sent.  
**Impact:** Compliance risk under DPDPA 2023 (India); possibly GDPR if patients are in EU.  
**Fix:** Obtain legal opinion; consider de-identifying or pseudonymising patient identifiers before the LLM call; get data processing agreement with Google.

---

### [KI-05] No TLS between Docker services — 🟠 High

**Evidence:** `docker-compose.yml` — `PYTHON_API_URL=http://python-ocr:8000` (plain HTTP).  
**Impact:** Internal Docker traffic is unencrypted. Within a private network this is lower risk, but should be addressed for cloud deployment.  
**Fix:** Use a TLS-terminating reverse proxy (nginx/traefik) for the Docker network.

---

### [KI-06] Starter medicine set is too small for production — 🟠 High

**Evidence:** `model/final_prescription_ocr_service_windows.py` → `STARTER` list — 27 drugs.  
**Impact:** Most medicine names on real prescriptions will not be found in the database, generating `unverified` warnings. Fuzzy matching is limited.  
**Fix:** Import a licensed, pharmacist-verified Indian medicine dataset. See [docs/model/06_MEDICINE_KNOWLEDGE_BASE.md](../model/06_MEDICINE_KNOWLEDGE_BASE.md) and [docs/architecture/12_ROADMAP.md](../architecture/12_ROADMAP.md) R-06.

---

### [KI-07] No evaluation benchmark exists — 🟠 High

**Evidence:** `docs/model/07_EVALUATION.md` — "No evaluation has been run against a formal test set."  
**Impact:** Accuracy claims (> 95%) are unverified engineering targets.  
**Fix:** Build annotated test set, run evaluation, publish results. See R-07, R-08 in roadmap.

---

### [KI-08] `MODEL_CANDIDATES` contains speculative model names — 🟡 Medium

**Evidence:** `MODEL_CANDIDATES` includes names like `gemini-3.5-flash-lite`, `gemini-3.7-flash`, `gemini-3.1-flash-lite` that are not confirmed valid Google AI model IDs.  
**Impact:** These produce 404 fast-fails on every request, adding latency before falling back to a valid model.  
**Fix:** Verify valid model names against Google AI API; remove invalid names from the list.

---

### [KI-09] Medicine matching does not scale beyond ~500k in-memory — 🟡 Medium

**Evidence:** `load_med_index()` builds `MED_INDEX` dict entirely in RAM; `lookup_medicine()` uses `process.extractOne` which scans all keys.  
**Impact:** Memory usage and fuzzy lookup time grow linearly with database size.  
**Fix:** Replace with PostgreSQL `pg_trgm` + `pgvector` (ADR-005, Roadmap R-10, R-11).

---

### [KI-10] Flat `medicine_master` cannot represent multi-ingredient drugs — 🟡 Medium

**Evidence:** `composition` column is a free-text string (e.g. `"Tramadol + Paracetamol"`).  
**Impact:** Cannot check total daily dosage of paracetamol across combination products; cannot link to ATC codes.  
**Fix:** Normalise to `medicines` + `ingredients` schema (ADR-005, Roadmap R-12).

---

### [KI-11] CPU-only OCR is slow — 🟡 Medium

**Evidence:** `PADDLEOCR_DEVICE=cpu` in `docker-compose.yml`. Comments in old docs mention "5–15 s per page on CPU".  
**Impact:** User waits 10–20 s for each prescription (OCR + Gemini).  
**Fix:** Enable GPU acceleration (Roadmap R-13).

---

### [KI-12] Prescription images stored unencrypted on local disk — ✅ RESOLVED

**Evidence:** Local `frontend/public/uploads/` plain file storage replaced with Supabase Storage Cloud Bucket (`OCR_Images/uploads/`) with public CDN URLs and encrypted transit.  
**Impact:** Images are now stored in scalable cloud object storage rather than unencrypted local disk directories.  
**Fix:** Implemented `frontend/lib/supabaseStorage.ts` helper and migrated all files to Supabase Storage Bucket `OCR_Images`.

---

### [KI-13] No database migration framework — 🟡 Medium

**Evidence:** Python service uses `MetaData.create_all(engine)` only; schema changes require manual `ALTER TABLE` SQL.  
**Impact:** Risk of schema drift between environments; no rollback capability.  
**Fix:** Add Alembic (Roadmap R-17).

---

### [KI-14] Dual table namespace in same database — 🟡 Medium

**Evidence:** Next.js uses `"User"`, `"Document"`, `"Analysis"` (PascalCase, pg pool); Python uses `raw_ocr`, `extractions`, etc. (snake_case, SQLAlchemy). No FK relationship across the boundary.  
**Impact:** No referential integrity between the frontend EHR records and the backend extraction records. The `Document.status` field is not updated when the Python service confirms an extraction.  
**Fix:** Unify under a single schema manager (Roadmap R-18).

---

### [KI-15] `date_iso` defaults to today if absent — 🟡 Medium

**Evidence:** `api_confirm()` → `if not date_iso: date_iso = datetime.date.today().isoformat()`  
**Impact:** If the prescription date cannot be parsed, the confirmation silently uses today's date — this could mis-date historical prescriptions.  
**Fix:** Return an error or require the frontend to always supply a confirmed date.

---

### [KI-16] Dev API token accepted in production if `API_TOKEN` is not set — 🔴 Critical

**Evidence:** `require_key()` → `if not API_TOKEN or API_TOKEN == DEV_API_TOKEN: if not x_api_key or x_api_key == DEV_API_TOKEN: return`  
**Impact:** If `API_TOKEN` is not set in production, the well-known dev token `rx_local_dev_token_2026_secure` grants full API access.  
**Fix:** Fail hard at startup if `API_TOKEN` is not set or equals the dev token in production.

---

## UNVERIFIED Items (Documentation Gaps)

| Item | Location | What needs verification |
|---|---|---|
| Production `medicine_master` row count (claimed 253,313) | `docs/model/06_MEDICINE_KNOWLEDGE_BASE.md` | Check actual row count in Supabase; the number may vary |
| `MODEL_CANDIDATES` validity | `docs/model/10_PROMPT_REGISTRY.md` | Verify each model name against Google AI API documentation |
| OCR processing time estimates ("5–15 s on CPU") | Old `Doc/system_design.md` | Benchmark on target hardware |
| Target accuracy numbers from `accuracy_improvement_plan.md` | `docs/model/07_EVALUATION.md` | Run formal evaluation to produce real numbers |
| Medicine dataset licence (CDSCO / Jan Aushadhi) | `docs/model/06_MEDICINE_KNOWLEDGE_BASE.md` | Confirm licence terms before production use |
| DPDPA 2023 compliance for Gemini data transfer | `docs/operations/08_SECURITY_PRIVACY.md` | Confirm with legal counsel |
| PaddlePaddle version actually installed in Docker | `model/requirements.txt` specifies 2.6.2 but comments mention 3.x | Check installed version in running container |

---

## Technical Debt

| Item | Evidence | Impact |
|---|---|---|
| Single-file Python service (1,633 lines) | `model/final_prescription_ocr_service_windows.py` | Hard to navigate; all logic in one module |
| No unit tests for core functions (`preprocess_image`, `build_lines`, `parse_vital`, `lookup_medicine`) | `scratch/` has integration tests only | Regressions are not caught automatically |
| Windows-specific filename for production service | `final_prescription_ocr_service_windows.py` | Confusing; Dockerfile renames it to `service.py` |
| `requirements.txt` has loose version pins for most packages | `fastapi>=0.110.0` — no upper bound | May break on future major version releases |
| No `.env.example` file | Root directory | New developers do not know what variables are needed |
