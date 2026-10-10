# Single-Hospital-Pro

A clinical prescription intelligence system that converts a photo of a medical prescription into a structured, human-verified patient medical record.

**Pipeline:** Image → Preprocessing → PaddleOCR (with confidence scores) → Google Gemini LLM (schema-constrained JSON) → Raw OCR storage → Medicine mapping against `medicine_master` → Draft extraction → Human clinician review → Confirmed patient medical profile.

> ⚠️ **Healthcare safety notice:** All system outputs are clinical-support *drafts*. They must be reviewed and confirmed by a licensed clinician before any clinical use. The system does not dispense, prescribe, or make autonomous medical decisions.

---

## Current Status

| Feature | Status |
|---|---|
| Image upload, preprocessing, EXIF rotation | **Working** |
| PaddleOCR line extraction with confidence scores | **Working** |
| Google Gemini multimodal structuring (cascade fallback) | **Working** |
| Medicine master matching (exact + fuzzy via RapidFuzz) | **Working** (starter set of ~27 drugs; production DB via bulk import) |
| Human-in-the-loop review UI | **Working** |
| Prescription confirmation + audit log | **Working** |
| Vitals time-series (BP, sugar, pulse, weight) | **Working** |
| Longitudinal Trend Analysis Engine (5-date gating & dual-tier cache) | **Working** |
| Generalized Medication Lifecycle Engine & Audit Trail | **Working** |
| Prescription scan inspector with high-res zoom | **Working** |
| Patient dashboard / timeline | **Working** |
| Prescription image cloud storage (Supabase Bucket `OCR_Images`) | **Working** |
| Docker multi-container deployment | **Working** |
| GPU acceleration | **PLANNED** |
| PDF / multi-page support | **PLANNED** |
| Full Indian medicine database (NLEM / Jan Aushadhi) | **PLANNED** |
| Trigram + vector hybrid matching | **PLANNED** |

---

## Quick Start

### Prerequisites
- Python 3.11+  
- Node.js 20+  
- Docker + Docker Compose (for containerised run)  
- A Google Gemini API key  
- A Supabase project (PostgreSQL + Cloud Storage bucket `OCR_Images`)

### Option A — Docker (recommended)

```powershell
# 1. Copy and fill environment variables
copy .env.example .env   # fill GEMINI_API_KEY, DATABASE_URL, and Supabase keys

# 2. Build and start both services
docker-compose up --build
```

- Frontend: http://localhost:3000  
- Python API: http://localhost:8000/health

### Option B — Local development

```powershell
# Terminal 1: Python OCR & AI service
python model/final_prescription_ocr_service_windows.py

# Terminal 2: Next.js frontend
cd frontend
npm install
npm run dev
```

### Environment variables (names only — never commit values)

| Variable | Where | Required |
|---|---|---|
| `GEMINI_API_KEY` | `model/.env` or root `.env` | Yes |
| `DATABASE_URL` | `model/.env` or root `.env` | Yes (SQLite fallback: `sqlite:///rx_local.db`) |
| `API_TOKEN` | `model/.env` or root `.env` | No (auto-generated) |
| `PYTHON_API_TOKEN` | root `.env` | No (matches `API_TOKEN`) |
| `FRONTEND_ORIGIN` | `model/.env` | No (default `*`) |
| `JWT_SECRET` | `frontend/.env.local` | No (default fallback exists but insecure for production) |
| `PYTHON_API_URL` | Docker compose env | No (default `http://python-ocr:8000`) |
| `NEXT_PUBLIC_SUPABASE_URL` | `frontend/.env.local` or root `.env` | Yes (for Supabase Storage) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `frontend/.env.local` or root `.env` | Yes (for Supabase Storage) |
| `SUPABASE_SERVICE_ROLE_KEY` | `frontend/.env.local` or root `.env` | Optional (recommended for backend storage bypass) |
| `SUPABASE_STORAGE_BUCKET` | `frontend/.env.local` or root `.env` | No (default `OCR_Images`) |
| `SUPABASE_STORAGE_FOLDER` | `frontend/.env.local` or root `.env` | No (default `uploads`) |


---

## Folder Overview

| Path | Purpose |
|---|---|
| `model/` | Python FastAPI service — OCR, LLM, validation, DB |
| `frontend/` | Next.js 16 web application |
| `scratch/` | Migration scripts, seed scripts, ad-hoc experiments |
| `app.py` | Minimal standalone OCR server (not the main service) |
| `docs/` | All project documentation |

---

## Documentation Index

| File | Module | Purpose |
|---|---|---|
| [docs/architecture/01_PROJECT_BRIEF.md](docs/architecture/01_PROJECT_BRIEF.md) | `architecture/` | Problem, scope, success criteria |
| [docs/architecture/02_ARCHITECTURE.md](docs/architecture/02_ARCHITECTURE.md) | `architecture/` | System and component diagrams |
| [docs/architecture/11_DECISIONS.md](docs/architecture/11_DECISIONS.md) | `architecture/` | Architecture Decision Records |
| [docs/architecture/12_ROADMAP.md](docs/architecture/12_ROADMAP.md) | `architecture/` | Phased roadmap with status |
| [docs/architecture/GLOSSARY.md](docs/architecture/GLOSSARY.md) | `architecture/` | Domain terms and acronyms |
| [docs/ocr/14_OCR_DOCUMENTATION.md](docs/ocr/14_OCR_DOCUMENTATION.md) | `ocr/` | PaddleOCR engine & text line extraction |
| [docs/model/06_MEDICINE_KNOWLEDGE_BASE.md](docs/model/06_MEDICINE_KNOWLEDGE_BASE.md) | `model/` | Medicine DB, matching logic |
| [docs/model/07_EVALUATION.md](docs/model/07_EVALUATION.md) | `model/` | Metrics and test results |
| [docs/model/10_PROMPT_REGISTRY.md](docs/model/10_PROMPT_REGISTRY.md) | `model/` | All LLM prompts as versioned registry |
| [docs/pipeline/03_PIPELINE_SPEC.md](docs/pipeline/03_PIPELINE_SPEC.md) | `pipeline/` | Every pipeline stage in detail |
| [docs/pipeline/15_MEDICAL_TIMELINE_AND_AI_ANALYSIS.md](docs/pipeline/15_MEDICAL_TIMELINE_AND_AI_ANALYSIS.md) | `pipeline/` | Medical timeline architecture, tables & Gemini AI summary engine |
| [docs/api-data/04_DATA_MODEL.md](docs/api-data/04_DATA_MODEL.md) | `api-data/` | All database tables and schemas |
| [docs/api-data/05_API_SPEC.md](docs/api-data/05_API_SPEC.md) | `api-data/` | Every API endpoint with curl examples |
| [docs/Medication-Lifecycle/README.md](docs/Medication-Lifecycle/README.md) | `Medication-Lifecycle/` | Generalized medication lifecycle engine, audit trail & prescription image inspection |
| [docs/Trend-Analysis/README.md](docs/Trend-Analysis/README.md) | `Trend-Analysis/` | Longitudinal vitals trend analysis engine, 5-date gating & dual-tier cache |
| [docs/operations/08_SECURITY_PRIVACY.md](docs/operations/08_SECURITY_PRIVACY.md) | `operations/` | Data classification, PII, compliance |
| [docs/operations/09_RUNBOOK.md](docs/operations/09_RUNBOOK.md) | `operations/` | Setup, run, troubleshoot, recipes |
| [docs/operations/13_KNOWN_ISSUES.md](docs/operations/13_KNOWN_ISSUES.md) | `operations/` | Bugs, risks, tech debt |
| [AGENTS.md](AGENTS.md) | — | AI agent instructions (read first) |
| [CHANGELOG.md](CHANGELOG.md) | — | Change log |
