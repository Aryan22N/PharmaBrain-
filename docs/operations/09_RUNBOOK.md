---
Title: Runbook
Purpose: Environment setup, run commands, troubleshooting, and operational recipes
Last verified against code: 2026-10-07
Code version: no git
Owner: TBD
---

# 09 — Runbook

## Environment Variables

| Variable | Service | Purpose | Format | Required |
|---|---|---|---|---|
| `GEMINI_API_KEY` | Python backend | Google Gemini API authentication | `AIza...` | **Yes** |
| `DATABASE_URL` | Python backend, frontend | PostgreSQL connection string | `postgresql://user:pass@host:port/db` or `sqlite:///path.db` | **Yes** |
| `API_TOKEN` | Python backend | Shared secret for `X-API-Key` header | Any strong random string | No (auto-generated per session if absent) |
| `PYTHON_API_TOKEN` | Docker / frontend | Must match `API_TOKEN` in Python service | Same value as `API_TOKEN` | No (dev default used if absent) |
| `PYTHON_API_URL` | Docker frontend | URL to reach Python service | `http://python-ocr:8000` (Docker) or `http://localhost:8000` (local) | No (default `http://localhost:8000`) |
| `FRONTEND_ORIGIN` | Python backend | CORS allowed origin | `http://localhost:3000` | No (default `*`) |
| `JWT_SECRET` | Frontend | JWT signing secret | Any strong random string ≥ 32 chars | No (insecure fallback exists — do NOT use in production) |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend | Supabase project URL | `https://[REF].supabase.co` | **Yes** |
| `SUPABASE_URL` | Frontend | Supabase project URL | `https://[REF].supabase.co` | **Yes** |
| `SUPABASE_STORAGE_BUCKET` | Frontend | Supabase Storage bucket for prescription scans | `OCR_Images` | No (default `OCR_Images`) |
| `SUPABASE_STORAGE_FOLDER` | Frontend | Storage subfolder within bucket | `uploads` | No (default `uploads`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Supabase public anonymous API key | `sb_publishable_...` | **Yes** |
| `SUPABASE_ANON_KEY` | Frontend | Supabase anonymous API key | `sb_publishable_...` | **Yes** |
| `SUPABASE_SERVICE_ROLE_KEY` | Frontend | Supabase service role secret for bucket uploads | `sb_secret_...` | **Yes** |
| `OCR_ENGINE_TYPE` | Python backend | OCR backend selector | `PaddleOCR` or `PaddleOCR-VL` | No (default `PaddleOCR`) |
| `PADDLEOCR_LANG` | Python backend | PaddleOCR language | `en` | No (default `en`) |
| `PADDLEOCR_DEVICE` | Docker | Compute device | `cpu` | No (default `cpu`) |
| `HOST` | Python backend | FastAPI bind host | `0.0.0.0` | No (default `0.0.0.0`) |
| `PORT` | Python backend | FastAPI port | `8000` | No (default `8000`) |

---

## Setup from a Clean Machine

### Prerequisites

- Python 3.11+ (`python --version`)
- Node.js 20+ (`node --version`)
- Docker + Docker Compose (for containerised setup)
- Git

### Step 1 — Clone the repository

```powershell
git clone <repo_url>
cd Single-Hospital-Pro
```

### Step 2 — Configure environment variables

Create `model/.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
API_TOKEN=your_strong_random_token_here
FRONTEND_ORIGIN=http://localhost:3000
```

For local SQLite development (no Supabase needed):
```env
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=sqlite:///rx_local.db
```

Create `frontend/.env.local`:
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
PYTHON_API_URL=http://localhost:8000
PYTHON_API_TOKEN=your_strong_random_token_here
JWT_SECRET=your_strong_jwt_secret_here
```

### Step 3 — Apply the database schema (Supabase)

```bash
# Run the schema SQL against your Supabase project
# From the Supabase dashboard SQL editor or psql:
psql $DATABASE_URL -f scratch/supabase_schema.sql
```

For local SQLite: the Python service creates all tables automatically on first startup via `md_.create_all(engine)`.

---

## Run Commands

### Option A — Docker (recommended for clean environments)

```powershell
# Build and start both services
docker-compose up --build

# Start without rebuild (faster)
docker-compose up

# Stop
docker-compose down

# View logs
docker-compose logs -f

# Restart only the Python service (e.g. after code change)
docker-compose restart python-ocr
```

- Frontend: http://localhost:3000
- Python API health: http://localhost:8000/health
- Python API docs (Swagger): http://localhost:8000/docs

> **Note:** First Docker start takes 5–15 minutes — PaddleOCR downloads model weights (~200 MB). The frontend will wait because of the `service_healthy` condition with a 300s start period.

### Option B — Local development

```powershell
# Terminal 1: Python service
python model/final_prescription_ocr_service_windows.py

# Terminal 2: Next.js frontend
cd frontend
npm install
npm run dev
```

### Run tests

```powershell
# Python connection test
python scratch/test_db_conn.py

# API endpoint test
python scratch/test_api_endpoints.py

# Document lifecycle test (end-to-end)
python scratch/test_document_lifecycle.py

# Auth isolation test
python scratch/test_e2e_auth_isolation.py
```

### Import medicines

```powershell
# Import from CSV (columns: name,generic,composition,uses,strengths_mg)
python model/import_medicines_bulk.py
```

---

## Common Errors and Fixes

| Error | Likely Cause | Fix |
|---|---|---|
| `GEMINI_API_KEY is missing or empty` | `.env` not configured or not found | Create `model/.env` with `GEMINI_API_KEY=...` |
| `DATABASE_URL is missing or empty` | `.env` not configured | Set `DATABASE_URL` in `model/.env` |
| `Could not connect to database` | Wrong credentials, network issue, Supabase project paused | Check credentials; verify Supabase project is active; try `ping db.[REF].supabase.co` |
| `All Gemini models failed` | API key invalid, rate limit, or all model names in `MODEL_CANDIDATES` are deprecated | Check API key; check Gemini API console; update `MODEL_CANDIDATES` |
| `No text found in the image` | Image too dark, blurry, or not a prescription | Ask user to re-upload a clearer photo |
| `medicine_names_indexed: 0` in `/health` | `load_med_index()` still loading in background | Wait a few seconds; check Python service logs for "Successfully loaded" message |
| Frontend says `Gateway Timeout` | Python service took > 6 minutes (CPU OCR + Gemini) | Normal on first request after cold start. If persistent, check Python logs for PaddleOCR init errors. |
| `409 looks like a duplicate` | Same patient + date + medicines already confirmed | Send `allow_duplicate: true` in confirm request if intentional |
| `Invalid or missing X-API-Key` | `API_TOKEN` mismatch between frontend and backend | Ensure `PYTHON_API_TOKEN` in frontend env matches `API_TOKEN` in Python env |
| `Invalid DATABASE_URL configuration` | Special characters in Supabase password not encoded | `sanitize_database_url()` handles this automatically — check password contains no structural issues |
| Prescription image shows sample placeholder (`/sample_prescription.png`) | Supabase Storage bucket `OCR_Images` set to `public: false`, missing container env keys, or `/uploads/` prefix issue | Verify `public: true` on `OCR_Images` bucket in Supabase; check `SUPABASE_SERVICE_ROLE_KEY` in `docker-compose.yml`; check `/api/user/dashboard` response |

---

## Monitoring and Logs

**Python service:** All events logged to stdout via `log_stage(stage, msg, elapsed)` with UTC timestamp.

```
[2026-10-07 17:00:01 UTC] [OCR_INFERENCE] PaddleOCR inference completed (24 text boxes detected) | elapsed=3.21s
[2026-10-07 17:00:04 UTC] [LLM_STRUCTURING] Gemini structuring succeeded using model 'gemini-2.5-flash' | elapsed=2.87s
[2026-10-07 17:00:04 UTC] [CONFIRM] Prescription #12 successfully confirmed and saved (edits=2, vitals=1) | elapsed=0.15s
```

**Audit log:** All pipeline events are written to the `audit_log` table with event type and JSON detail.

**Docker logs:** `docker-compose logs -f python-ocr` or `docker-compose logs -f frontend`.

**Backups:** No automated backup is configured. Use Supabase's built-in PITR or configure `pg_dump` on a schedule.

---

## Operational Recipes

### Add a new medicine to the starter set

1. Add a tuple to `STARTER` in `model/final_prescription_ocr_service_windows.py`.
2. The next service restart will seed it if the table was empty, OR insert it manually:

```sql
INSERT INTO medicine_master (name, generic, composition, uses, strengths_mg, source)
VALUES ('new_drug', 'generic_name', 'Full composition', 'Indication', '10,20', 'manual')
ON CONFLICT (name) DO NOTHING;
```

3. Call `load_med_index()` to refresh the in-memory index (or restart the service).

### Add a new OCR engine

1. The service supports `PaddleOCR` and `PaddleOCR-VL` via `OCR_ENGINE_TYPE` env var.
2. To add a third engine: add an `elif` branch in the OCR init block and handle its output format in `run_ocr()`.
3. Update `docs/architecture/02_ARCHITECTURE.md` and `docs/pipeline/03_PIPELINE_SPEC.md`.

### Add a new Gemini model

1. Add the model name to `MODEL_CANDIDATES` list in `model/final_prescription_ocr_service_windows.py`.
2. Test it manually via `POST /ocr`.
3. Update `docs/model/10_PROMPT_REGISTRY.md` if the model requires different configuration.
4. Add a `CHANGELOG.md` entry.

### Run a database migration

1. Write the migration SQL (e.g. `ALTER TABLE ... ADD COLUMN ...`).
2. Apply it to your Supabase instance via the dashboard SQL editor or `psql`.
3. Update the SQLAlchemy `Table(...)` definition in `model/final_prescription_ocr_service_windows.py`.
4. Update `scratch/supabase_schema.sql` for reference.
5. Update `docs/api-data/04_DATA_MODEL.md`.
