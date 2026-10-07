# AGENTS.md — AI Agent Instructions

> Read this file at the start of every session before touching any code.

---

## Project Summary

Single-Hospital-Pro converts a photo of a medical prescription into a structured, human-verified patient medical record. It is a two-service system: a Python FastAPI backend (`model/`) that runs OCR and LLM structuring, and a Next.js 16 frontend (`frontend/`) that provides the clinician review UI. **All LLM output is a draft — a licensed clinician must confirm before any clinical use.**

Architecture details: [docs/02_ARCHITECTURE.md](docs/02_ARCHITECTURE.md)  
Pipeline details: [docs/03_PIPELINE_SPEC.md](docs/03_PIPELINE_SPEC.md)

---

## Commands

| Task | Command |
|---|---|
| Start Python service (local) | `python model/final_prescription_ocr_service_windows.py` |
| Start frontend (local) | `cd frontend && npm run dev` |
| Start both via Docker | `docker-compose up --build` |
| Stop Docker | `docker-compose down` |
| Install Python deps | `cd model && pip install -r requirements.txt` |
| Install Node deps | `cd frontend && npm install` |
| Lint frontend | `cd frontend && npm run lint` |
| Python health check | `curl http://localhost:8000/health` |
| Import medicine CSV | `python -c "import model.final_prescription_ocr_service_windows as s; s.import_medicine_csv('file.csv')"` |

---

## Code Conventions

| Concern | Rule |
|---|---|
| Python version | 3.11+ |
| TypeScript | Strict mode; all new code typed |
| Python typing | Use `Optional[str]`, `List[X]` from `typing` |
| Pydantic | v2 — use `.model_validate_json()`, not `.parse_raw()` |
| Error handling (Python) | Raise `PipelineError` with an `http` code; FastAPI handler converts it |
| Logging (Python) | Use `log_stage(stage, msg, elapsed)` — never `print()` for business logic |
| Config loading | All secrets via `_secret(name)` from environment; never hardcode values |
| DB access | SQLAlchemy Core only (no ORM); use `engine.begin()` for writes |
| Frontend API calls | Use `pythonBackendFetch()` from `frontend/lib/api.ts` |
| JWT tokens | Sign/verify via `frontend/lib/auth.ts` |

---

## Where Things Live

| Task | Edit this file |
|---|---|
| Change OCR preprocessing | `model/final_prescription_ocr_service_windows.py` → `preprocess_image()` |
| Change LLM prompt | `model/final_prescription_ocr_service_windows.py` → `SYSTEM_PROMPT` + update `docs/10_PROMPT_REGISTRY.md` |
| Change Pydantic schema | `model/final_prescription_ocr_service_windows.py` → `Prescription`, `Medicine`, `Val` + update `docs/04_DATA_MODEL.md` |
| Change DB schema | Update SQLAlchemy Table definitions in same file + `scratch/supabase_schema.sql` + update `docs/04_DATA_MODEL.md` |
| Change confidence thresholds | `model/final_prescription_ocr_service_windows.py` → `THRESH_OK`, `THRESH_LOW`, `CRITICAL_FIELDS` |
| Change LLM model candidates | `model/final_prescription_ocr_service_windows.py` → `MODEL_CANDIDATES` |
| Add/edit API endpoint | `model/final_prescription_ocr_service_windows.py` + update `docs/05_API_SPEC.md` |
| Change auth / JWT | `frontend/lib/auth.ts` |
| Change frontend DB queries | `frontend/lib/db.ts` |
| Change upload UI | `frontend/app/upload/page.tsx` |
| Change extraction review UI | `frontend/app/extractions/[id]/page.tsx` |
| Change medicine edit form | `frontend/components/MedicineEditor.tsx` |
| Change patient onboarding flow | `frontend/app/onboarding/page.tsx` + `frontend/app/api/user/onboarding/route.ts` |
| Add new medicine records | Use `import_medicine_csv()` or add to `STARTER` list |

---

## DO / DO NOT Rules

**DO:**
- Always use `log_stage()` for significant backend events.
- Always update `CHANGELOG.md` when changing code, schema, prompt, or API.
- Always update the matching `docs/` file when you change what it documents.
- Always run `docker-compose up --build` to verify Docker integration after backend changes.
- Always label uncertain claims in docs as `Inferred` or `Unknown`.

**DO NOT:**
- Never let the LLM be the source of truth for medicine facts. Only `medicine_master` data is trusted.
- Never log patient data (names, UHID, prescriptions) to stdout or files.
- Never log API keys, JWT secrets, or database passwords.
- Never commit `.env` files or any file containing real credentials.
- Never change the Pydantic schema (`Prescription`, `Medicine`, `Val`) without also updating `docs/04_DATA_MODEL.md` and confirming existing DB data is compatible.
- Never change `SYSTEM_PROMPT` without updating `docs/10_PROMPT_REGISTRY.md` (version bump + change log entry).
- Never auto-accept a near fuzzy match from `lookup_medicine()` — the `near` status exists specifically to require human review.
- Never document a feature as "verified" or "safe" unless the code enforces it.
- Never use line numbers as code references in documentation — they go stale.

---

## Definition of Done

A change is complete when:
1. All existing behaviour still works (`docker-compose up --build` starts clean, `/health` returns 200).
2. The matching `docs/` file is updated to reflect the change.
3. A line is added to `CHANGELOG.md` under `## [Unreleased]`.
4. No secrets, patient data, or real `.env` values appear anywhere in documentation.

---

## Healthcare Safety Rules

- System outputs are clinical-support **drafts only**. State this clearly in any new UI or API response.
- Never mark a medicine as "verified" unless it matched a record in `medicine_master` with `status="exact"`.
- Near-match drugs (`status="near"`) must always be flagged for human review; never auto-confirm them.
- Patient name mismatches (`NAME_MISMATCH` in gate reasons) must block silent auto-confirmation.
- Vitals outside physiological bounds are flagged and must not be silently stored.

---

## Known Traps

| Trap | Detail |
|---|---|
| `app.py` is NOT the main service | `app.py` is a minimal standalone OCR server. The real service is `model/final_prescription_ocr_service_windows.py`. |
| Dockerfile renames the entry point | `model/Dockerfile` copies `final_prescription_ocr_service_windows.py` to `/app/service.py`. Inside the container the filename is `service.py`. |
| `MED_INDEX` loads in background | `load_med_index()` spawns a daemon thread. The index may be empty for the first few seconds after startup. `/health` reports `medicine_names_indexed: 0` while loading. |
| `OCR_LOCK` is not re-entrant | PaddleOCR is not thread-safe. All OCR calls go through `OCR_LOCK`. Do not call `run_ocr()` from multiple threads without the lock. |
| Dual table namespaces | Next.js queries `"User"`, `"Document"`, `"Analysis"` (camelCase, quoted). Python SQLAlchemy manages `raw_ocr`, `extractions`, `confirmed_prescriptions`, `observations`, `medicine_master`, `audit_log` (snake_case). These are separate namespaces in the same Supabase DB. |
| `SEND_IMAGE_TO_LLM = True` is critical | Setting this to `False` removes the image from the Gemini call — handwriting transcription quality drops drastically. The flag exists for debugging only. |
| `USE_UNWARPING = False` | Perspective unwarping is not implemented. Curved or photographed-from-angle images will have degraded OCR quality. |
| `MODEL_CANDIDATES` list may contain invalid model names | The list includes speculative future model IDs. The cascade will skip unavailable models with a 404/503 fast-fail. |
| JWT_SECRET fallback is insecure | `frontend/lib/auth.ts` has a hardcoded fallback JWT secret. Set `JWT_SECRET` in the frontend environment before production deployment. |

---

## Ongoing Maintenance Rule

> Any change to code, schema, prompt, API, or configuration **must** update the matching document in the same change, and add a line to `CHANGELOG.md`. Documentation that disagrees with the code is a bug.
