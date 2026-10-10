# Changelog

All notable changes to this project will be documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

---

## [Unreleased]

### Fixed
- 2026-10-10 — Supabase Storage Cloud Bucket Upload & Patient Overview Image Display Fix:
  - Resolved issue where prescription image uploads failed and defaulted to `/sample_prescription.png` placeholder on the Patient Overview dashboard (`/patient/overview`).
  - Configured Supabase Storage Bucket `OCR_Images` ACL to `public: true` and enabled all standard medical scan MIME types (`image/png`, `image/jpeg`, `image/webp`).
  - Updated `docker-compose.yml` to inject all Supabase URL, bucket, and key environment variables into the frontend Next.js container.
  - Upgraded `frontend/lib/supabaseStorage.ts` with a resilient dual-upload engine (Supabase JS SDK with automatic fallback to direct REST API `POST /storage/v1/object/...`), MIME normalization, and credential defaults.
  - Fixed image URL resolution in `frontend/app/api/user/dashboard/route.ts` to preserve public Supabase CDN URLs (`https://...`) without corrupting them with `/uploads/` prefix.
  - Fixed `frontend/app/api/confirm/[id]/route.ts` to sync and maintain confirmed prescription image URLs in `Document.storedFilename` and `Analysis.structuredResult`.
  - Fixed Docker container runner permissions in `frontend/Dockerfile` (`/app/public/uploads` owned by `nextjs:nodejs`) ensuring local disk fallback works reliably if cloud storage is unreachable.
  - Backfilled existing patient records with real prescription scans uploaded to Supabase Storage.

### Added
- 2026-10-10 — Longitudinal Vitals Analysis, Risk Staging & Interactive Trends (`feature/Krishna`):
  - Created statistical trajectory engine (`frontend/lib/trends.ts`) implementing deterministic clinical guidelines (AHA/ACC 2017 for Blood Pressure stages and sustained rise warnings; ADA 2024 for Glycemia/HbA1c).
  - Built Next.js longitudinal trends API endpoint (`frontend/app/api/patient/trends/route.ts`) querying Supabase `observations` table, deduplicating readings, computing pairwise deltas ($\Delta$), and generating patient-friendly AI health reviews via Google Gemini (`PROMPT-002`).
  - Added `/patients/{patient_id}/trends_summary` endpoint to Python backend (`model/final_prescription_ocr_service_windows.py`) with `TrendsSummaryResponse` Pydantic model and Gemini prompt cascade.
  - Upgraded Patient Health Trends UI (`frontend/app/patient/trends/page.tsx`) with interactive SVG time-series charts (`frontend/components/patient/LongitudinalVitalChart.tsx`) featuring color-coded clinical reference bands, hover tooltips with pairwise visit deltas, metric tabs (BP, Glucose, HbA1c, Heart Rate, SpO2, Weight), Gemini AI narrative review card, and source prescription modal links.
  - Verified confirmed prescription vitals populate Supabase `observations` table cleanly in `frontend/app/api/confirm/[id]/route.ts`.
- 2026-10-08 — Supabase Storage Cloud Bucket Integration: Migrated prescription document image storage from local disk directory (`frontend/public/uploads`) to Supabase Storage Cloud Bucket (`OCR_Images/uploads/`). Created `frontend/lib/supabaseStorage.ts` helper module, updated `frontend/app/api/ocr/route.ts` and API routes to store and serve public Supabase CDN URLs, created migration script `scratch/migrate_uploads_to_supabase.js`, and cleaned up local `public/uploads` directory.
- 2026-10-08 — Patient Initial Profile Context Onboarding Flow: 4-step health context wizard (`frontend/app/onboarding/page.tsx` & `frontend/app/patient/onboarding/page.tsx`), PostgreSQL initial profile storage endpoint (`frontend/app/api/user/onboarding/route.ts`), and `patient_onboarding` database schema.
- 2026-10-08 — Deduplication detection on prescription upload (`POST /api/ocr`) via SHA-256 image hashing.
- 2026-10-08 — Discard draft functionality (`POST /api/discard/[id]`) to delete unconfirmed prescription drafts from database.
- 2026-10-07 — Documentation rebuilt from scratch against current code. All old docs archived to `docs/_archive_20261007/`. New docs cover `README.md`, `AGENTS.md`, and `docs/01` through `docs/13` plus `GLOSSARY.md`.

### Changed
- 2026-10-08 — Post-authentication routing redirect in `frontend/app/auth/page.tsx` directs patients to `/onboarding`.
- 2026-10-08 — Cleaned up all demo MVP text footers and `DemoDisclaimerFooter` across patient portal UI.

---

## [3.0] — 2026-10 (current deployed version, Confirmed in docker-compose.yml)

### Added
- Multimodal Gemini vision: `SEND_IMAGE_TO_LLM = True` — image bytes sent alongside OCR lines so Gemini can visually transcribe handwriting.
- Image resolution raised to 2048px max long side in `preprocess_image()`.
- Extended `MODEL_CANDIDATES` cascade list (9 model candidates) with fast-fail on 404/429/503.
- Extended `STARTER` medicine list with oncology and specialty drugs (Dexa, Ondem, Ultracet, Xgeva, Cloxen, HMW, Folvite, Dytor, Levolin, Meftal-P).
- Updated `SYSTEM_PROMPT` with hybrid visual + OCR extraction instructions and explicit handwriting transcription rules.
- `api_ocr_direct()` endpoint (`POST /api/ocr`) for frontend compatibility — returns bounding-box list without requiring `patient_id`.
- `/extractions` list endpoint with optional `patient_id` filter.
- Background thread for `load_med_index()` — server starts immediately while DB loads.
- Docker healthcheck on `/health` with 300s start period for PaddleOCR model download time.

### Changed
- FastAPI app version bumped to `3.0`.
- `sanitize_database_url()` now handles special characters in Supabase passwords without double-encoding.

---

## [2.x] — Prior versions

No formal changelog was maintained. History available via `git log`.
