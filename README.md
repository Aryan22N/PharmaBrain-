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
| Patient dashboard / timeline | **Working** |
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
- A Supabase PostgreSQL connection string (or use SQLite for local dev)

### Option A — Docker (recommended)

```powershell
# 1. Copy and fill environment variables
copy .env.example .env   # fill GEMINI_API_KEY and DATABASE_URL

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

| File | Purpose |
|---|---|
| [docs/01_PROJECT_BRIEF.md](docs/01_PROJECT_BRIEF.md) | Problem, scope, success criteria |
| [docs/02_ARCHITECTURE.md](docs/02_ARCHITECTURE.md) | System and component diagrams |
| [docs/03_PIPELINE_SPEC.md](docs/03_PIPELINE_SPEC.md) | Every pipeline stage in detail |
| [docs/04_DATA_MODEL.md](docs/04_DATA_MODEL.md) | All database tables and schemas |
| [docs/05_API_SPEC.md](docs/05_API_SPEC.md) | Every API endpoint with curl examples |
| [docs/06_MEDICINE_KNOWLEDGE_BASE.md](docs/06_MEDICINE_KNOWLEDGE_BASE.md) | Medicine DB, matching logic |
| [docs/07_EVALUATION.md](docs/07_EVALUATION.md) | Metrics and test results |
| [docs/08_SECURITY_PRIVACY.md](docs/08_SECURITY_PRIVACY.md) | Data classification, PII, compliance |
| [docs/09_RUNBOOK.md](docs/09_RUNBOOK.md) | Setup, run, troubleshoot, recipes |
| [docs/10_PROMPT_REGISTRY.md](docs/10_PROMPT_REGISTRY.md) | All LLM prompts as versioned registry |
| [docs/11_DECISIONS.md](docs/11_DECISIONS.md) | Architecture Decision Records |
| [docs/12_ROADMAP.md](docs/12_ROADMAP.md) | Phased roadmap with status |
| [docs/13_KNOWN_ISSUES.md](docs/13_KNOWN_ISSUES.md) | Bugs, risks, tech debt |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | Domain terms and acronyms |
| [AGENTS.md](AGENTS.md) | AI agent instructions (read first) |
| [CHANGELOG.md](CHANGELOG.md) | Change log |
