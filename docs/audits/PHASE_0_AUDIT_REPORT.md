# PHASE 0 — AUDIT REPORT: AI-ASSISTED DIGITAL PATIENT RECORD & CLINICAL DECISION SUPPORT SYSTEM

**Date:** October 10, 2026  
**Auditor:** Senior Software Engineer & Healthcare Systems Architect  
**Repository Branch:** `main` (commit `897925f docs: add comprehensive project documentation and roadmap structure`)  
**Working Tree:** Clean (no pending modifications)  
**Target Goal:** Implement patient-specific longitudinal health trend analysis displaying real database-backed trends in both the Patient UI and Doctor UI.

---

## A. Actual Project Architecture and Service Flow

The system operates as a hybrid microservice architecture connecting a Next.js 16 frontend and a Python FastAPI OCR & clinical extraction service, backed by a managed Supabase PostgreSQL database and Supabase Cloud Storage.

```mermaid
flowchart TD
    subgraph Client["Client Tier"]
        PatientBrowser["Patient Browser\n(/patient/*, Port 3000)"]
        DoctorBrowser["Doctor Browser\n(/patients/[id], Port 3000)"]
    end

    subgraph FrontendTier["Next.js 16 Tier (Node 22 / Port 3000)"]
        AppRouter["App Router\nPages & Layouts"]
        ProxyRoutes["API Proxy Routes\n(/api/ocr, /api/confirm, /api/patients/...)"]
        DBPool["lib/db.ts\n(pg Pool Connection)"]
        AuthLib["lib/auth.ts\n(JWT & bcrypt)"]
    end

    subgraph BackendTier["Python OCR Tier (FastAPI / Port 8000)"]
        FastAPIServer["final_prescription_ocr_service_windows.py\n(service.py in Docker)"]
        PaddleEngine["PaddleOCR Engine\n(CPU Inference)"]
        GeminiClient["Google Gemini API\n(google-genai SDK)"]
        DrugMasterIndex["In-Memory MED_INDEX\n(250k+ records + RapidFuzz)"]
        SQLAlchemyORM["SQLAlchemy Engine\n(psycopg2-binary)"]
    end

    subgraph DataTier["Data Tier"]
        PostgreSQL[("Supabase PostgreSQL\n(User, Document, raw_ocr, extractions,\nconfirmed_prescriptions, observations)")]
        StorageBucket[("Supabase Storage Bucket\n(OCR_Images/uploads/)")]
    end

    PatientBrowser --> AppRouter
    DoctorBrowser --> AppRouter
    AppRouter --> ProxyRoutes
    ProxyRoutes --> AuthLib
    ProxyRoutes --> DBPool
    DBPool --> PostgreSQL
    ProxyRoutes -->|"HTTP + X-API-Key\n(pythonBackendFetch)"| FastAPIServer
    ProxyRoutes --> StorageBucket

    FastAPIServer --> PaddleEngine
    FastAPIServer --> GeminiClient
    FastAPIServer --> DrugMasterIndex
    FastAPIServer --> SQLAlchemyORM
    SQLAlchemyORM --> PostgreSQL
```

### Complete End-to-End Service Flow

1. **Upload & Ingestion:**
   - The user submits a prescription image via [frontend/app/upload/page.tsx](file:///d:/single_hospital/Single-Hospital-Pro/frontend/app/upload/page.tsx) or [frontend/app/patient/documents/page.tsx](file:///d:/single_hospital/Single-Hospital-Pro/frontend/app/patient/documents/page.tsx).
   - [frontend/app/api/ocr/route.ts](file:///d:/single_hospital/Single-Hospital-Pro/frontend/app/api/ocr/route.ts) validates MIME type (JPEG/PNG/WebP) and file size ($\le 10$ MB), computes the SHA-256 image checksum, and checks the `"Document"` table to reject duplicates.
   - The image is uploaded to the Supabase Cloud Storage bucket `OCR_Images/uploads/` via [frontend/lib/supabaseStorage.ts](file:///d:/single_hospital/Single-Hospital-Pro/frontend/lib/supabaseStorage.ts) (falling back to `public/uploads` on the local disk if storage keys are unconfigured).
   - An initial draft entry is recorded in `"Document"` with `status = 'NOT CONFIRMED'` and in `"Analysis"`.

2. **OCR Inference & LLM Structuring:**
   - The Next.js API route forwards the multipart form data to the Python FastAPI backend (`POST /ocr`) via [pythonBackendFetch](file:///d:/single_hospital/Single-Hospital-Pro/frontend/lib/api.ts#L16-L101) with an `X-API-Key` header (5–6 minute timeout for CPU inference).
   - In [model/final_prescription_ocr_service_windows.py](file:///d:/single_hospital/Single-Hospital-Pro/model/final_prescription_ocr_service_windows.py):
     - `preprocess_image()` transposes EXIF orientation, applies autocontrast, and resizes between 1000px and 2048px.
     - `run_ocr()` executes PaddleOCR (CPU mode).
     - `build_lines()` computes geometric rows and reading order.
     - Raw OCR text lines and bounding boxes are saved to the `raw_ocr` table.
     - `call_gemini()` masks patient PII (emails, phone numbers via `mask_pii()`), attaches the image bytes, and prompts Google Gemini using the strict Pydantic `Prescription` schema.
     - `analyze_prescription()` auto-corrects OCR digit confusions, executes clinical vital validation via `parse_vital()`, and cross-references extracted drug names against 250,000+ records in `medicine_master` via `MED_INDEX` and RapidFuzz token matching.
     - A draft payload is saved to `extractions` with `status = 'PENDING_USER_CONFIRMATION'`.

3. **Clinician / Patient Review & Confirmation:**
   - The user opens [frontend/app/patient/documents/[id]/page.tsx](file:///d:/single_hospital/Single-Hospital-Pro/frontend/app/patient/documents/[id]/page.tsx) to inspect extracted vitals, medicine dosages, frequencies, and OCR confidence scores.
   - The user edits any misread fields in [frontend/components/MedicineEditor.tsx](file:///d:/single_hospital/Single-Hospital-Pro/frontend/components/MedicineEditor.tsx) and clicks **Confirm & Save to Record**.

4. **Database Persistence & Observation Ingestion:**
   - The client invokes `POST /api/confirm/[id]`, which dispatches to Python FastAPI `POST /confirm/{extraction_id}`.
   - The Python backend:
     - Computes a structural diff (`diff()`) between the original machine extraction and the confirmed clinician record.
     - Inserts the final record into `confirmed_prescriptions`.
     - Iterates through `rec.vitals`, executes `parse_vital()`, and for every valid clinical vital sign, executes:
       ```sql
       INSERT INTO observations (patient_id, prescription_id, obs_date, kind, systolic, diastolic, value, unit, raw_text, created_at)
       ```
     - Updates `extractions.status = 'CONFIRMED'`.
     - Records the event in `audit_log`.
   - The Next.js route handler then mirrors the state into Next.js EHR tables:
     - Updates `"Document"` status to `'CONFIRMED'`.
     - Updates `"Analysis"` with the confirmed summary and structured result JSONB.
     - Inserts an encounter into `patient_timeline_events`.
     - Inserts active medications into `patient_medications`.

---

## B. Relevant Files and Their Responsibilities

| File Path | Role | Key Responsibilities |
|---|---|---|
| [docker-compose.yml](file:///d:/single_hospital/Single-Hospital-Pro/docker-compose.yml) | Orchestration | Defines `python-ocr` (FastAPI backend, port 8000) and `frontend` (Next.js web, port 3000), internal networks, health checks, environment propagation. |
| [model/Dockerfile](file:///d:/single_hospital/Single-Hospital-Pro/model/Dockerfile) | Backend Build | Python 3.11-slim container installing OpenCV/GL dependencies, PaddlePaddle 2.6.2, PaddleOCR 2.8.1, FastAPI, SQLAlchemy, and Google GenAI. |
| [model/requirements.txt](file:///d:/single_hospital/Single-Hospital-Pro/model/requirements.txt) | Backend Deps | Explicit pinned dependencies for OCR, server, database (`psycopg2-binary`, `SQLAlchemy`), and AI SDKs. |
| [model/final_prescription_ocr_service_windows.py](file:///d:/single_hospital/Single-Hospital-Pro/model/final_prescription_ocr_service_windows.py) | Python Engine | Core FastAPI service: image preprocessing, PaddleOCR inference, Gemini structuring, drug matching, database tables, and `GET /patients/{id}/observations`. |
| [frontend/Dockerfile](file:///d:/single_hospital/Single-Hospital-Pro/frontend/Dockerfile) | Frontend Build | Node 22-alpine multi-stage build creating a standalone Next.js production bundle. |
| [frontend/package.json](file:///d:/single_hospital/Single-Hospital-Pro/frontend/package.json) | Frontend Deps | Defines React 19, Next.js 16, `@supabase/supabase-js`, `pg`, `lucide-react`, TailwindCSS 4. **No charting library is present.** |
| [frontend/lib/db.ts](file:///d:/single_hospital/Single-Hospital-Pro/frontend/lib/db.ts) | Database Pool | Singleton `pg.Pool` instance connected to Supabase PostgreSQL with SSL support and error handlers. |
| [frontend/lib/api.ts](file:///d:/single_hospital/Single-Hospital-Pro/frontend/lib/api.ts) | API Transport | `pythonBackendFetch()` for authenticated server-to-server proxying; `clientApi` methods for client-side fetches. |
| [frontend/lib/types.ts](file:///d:/single_hospital/Single-Hospital-Pro/frontend/lib/types.ts) | Type Definitions | TypeScript interfaces including [ObservationRecord](file:///d:/single_hospital/Single-Hospital-Pro/frontend/lib/types.ts#L163-L175), `ConfirmedPrescription`, `VitalRecord`, and `ExtractionPayload`. |
| [frontend/lib/auth.ts](file:///d:/single_hospital/Single-Hospital-Pro/frontend/lib/auth.ts) | Authentication | JWT signing and verification, bcrypt hashing, and 9-digit non-sequential Patient ID generator (`generate9DigitPatientId()`). |
| [frontend/app/api/patients/[patientId]/observations/route.ts](file:///d:/single_hospital/Single-Hospital-Pro/frontend/app/api/patients/[patientId]/observations/route.ts) | Observation Proxy | Proxies observation queries to Python backend `GET /patients/{id}/observations`. |
| [frontend/app/api/user/dashboard/route.ts](file:///d:/single_hospital/Single-Hospital-Pro/frontend/app/api/user/dashboard/route.ts) | User Dashboard API | Authenticates patient JWT; directly queries `observations` table for latest `bp` and `hba1c` metrics. |
| [frontend/app/patient/trends/page.tsx](file:///d:/single_hospital/Single-Hospital-Pro/frontend/app/patient/trends/page.tsx) | Patient Trends UI | Current trends screen. Filters text timeline events from React context; does not currently query observation time series. |
| [frontend/app/patients/[id]/page.tsx](file:///d:/single_hospital/Single-Hospital-Pro/frontend/app/patients/[id]/page.tsx) | Doctor Patient Record | Doctor-facing record page. Fetches `clientApi.getPatientObservations()` and renders a flat tabular list of rows without graphical charts. |
| [frontend/app/patient/layout.tsx](file:///d:/single_hospital/Single-Hospital-Pro/frontend/app/patient/layout.tsx) | Patient Layout | Common sidebar and header navigation for all patient portal routes. |
| [scratch/supabase_schema.sql](file:///d:/single_hospital/Single-Hospital-Pro/scratch/supabase_schema.sql) | DDL Schema | Master DDL creating `"User"`, `"Document"`, `"Analysis"`, `raw_ocr`, `extractions`, `confirmed_prescriptions`, `observations`, and RLS policies. |

---

## C. Existing Observation Schema and Supported Measurement Types

The `observations` table definition is actively maintained in both SQLAlchemy ([model/final_prescription_ocr_service_windows.py#L206-L214](file:///d:/single_hospital/Single-Hospital-Pro/model/final_prescription_ocr_service_windows.py#L206-L214)) and PostgreSQL DDL ([scratch/supabase_schema.sql#L112-L127](file:///d:/single_hospital/Single-Hospital-Pro/scratch/supabase_schema.sql#L112-L127)).

### Table Definition: `observations`

```sql
CREATE TABLE IF NOT EXISTS observations (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(64) NOT NULL,       -- 9-digit Patient ID (e.g., '483027156') or legacy UHID
    prescription_id INTEGER,               -- FK referencing confirmed_prescriptions.id
    obs_date VARCHAR(10) NOT NULL,         -- Date in ISO format 'YYYY-MM-DD'
    kind VARCHAR(24) NOT NULL,             -- Biomarker category key (see table below)
    systolic FLOAT,                        -- Numeric systolic pressure (BP only)
    diastolic FLOAT,                       -- Numeric diastolic pressure (BP only)
    value FLOAT,                           -- Numeric reading (for non-BP biomarkers)
    unit VARCHAR(16),                      -- Unit string: mmHg, mg/dL, mmol/L, %, /min, F, C, kg
    raw_text VARCHAR(120),                 -- Original text extracted by OCR before normalization
    created_at VARCHAR(32)                 -- ISO 8601 UTC timestamp
);

CREATE INDEX IF NOT EXISTS idx_observations_patient ON observations(patient_id);
CREATE INDEX IF NOT EXISTS idx_observations_kind_date ON observations(kind, obs_date);
```

### Supported Measurement Types & Validation Matrix

The parser function `parse_vital()` ([model/final_prescription_ocr_service_windows.py#L943-L988](file:///d:/single_hospital/Single-Hospital-Pro/model/final_prescription_ocr_service_windows.py#L943-L988)) strictly validates and range-checks each biomarker before allowing database insertion:

| `kind` Key | Biomarker Description | Target / Therapeutic Reference | Unit | Allowed Plausible Range | Schema Storage Columns |
|---|---|---|---|---|---|
| `bp` | Blood Pressure (Cardiovascular) | Normal: $\le 120/80$ mmHg | `mmHg` | Systolic: 60–260<br>Diastolic: 30–160<br>(Requires `systolic > diastolic`) | `systolic`, `diastolic`, `unit` (`value` is null) |
| `hba1c` | Glycated Hemoglobin | Normal: $< 5.7\%$<br>Diabetic Goal: $< 6.5\%$ | `%` | 3.0–20.0 | `value`, `unit` (`systolic`/`diastolic` null) |
| `sugar_fasting` | Fasting Blood Sugar (FBS / FBG) | Normal: 70–99 mg/dL | `mg/dL` or `mmol/L` | 20–800 mg/dL (or 1–45 mmol/L) | `value`, `unit` |
| `sugar_post_meal`| Post-Prandial Blood Sugar (PPBS / PPG) | Normal: $< 140$ mg/dL | `mg/dL` or `mmol/L` | 20–800 mg/dL (or 1–45 mmol/L) | `value`, `unit` |
| `sugar_random` | Random Blood Sugar (RBS / RBG) | Normal: $< 140$ mg/dL | `mg/dL` or `mmol/L` | 20–800 mg/dL (or 1–45 mmol/L) | `value`, `unit` |
| `sugar_unspecified` | Blood Glucose (Unspecified timing) | Normal: 70–140 mg/dL | `mg/dL` or `mmol/L` | 20–800 mg/dL (or 1–45 mmol/L) | `value`, `unit` |
| `pulse` | Pulse / Heart Rate (PR / HR) | Resting: 60–100 bpm | `/min` | 30–220 | `value`, `unit` |
| `temp` | Body Temperature | Normal: 98.6°F / 37°C | `F` or `C` | 90–110°F or 30–43°C | `value`, `unit` |
| `spo2` | Pulse Oximetry (Oxygen Saturation) | Normal: 95–100% | `%` | 50–100 | `value`, `unit` |
| `weight` | Body Weight | Patient-specific | `kg` | 1–300 | `value`, `unit` |

---

## D. Current Patient and Doctor Access-Control Mechanisms

### 1. Patient Portal Authentication & Isolation
- **Authentication Method:** JWT stored in an HTTP-only cookie (`auth_token`) or passed via HTTP header (`Authorization: Bearer <token>`).
- **Token Secret:** Verified using `JWT_SECRET` in [frontend/lib/auth.ts](file:///d:/single_hospital/Single-Hospital-Pro/frontend/lib/auth.ts).
- **Patient Identifier:** Each patient has a unique 9-digit non-sequential ID (`patientId`, e.g., `483027156`) and an optional `legacyPatientId` (e.g., `CCM12578`).
- **Enforcement:** In [frontend/app/api/user/dashboard/route.ts](file:///d:/single_hospital/Single-Hospital-Pro/frontend/app/api/user/dashboard/route.ts), the session token is decoded, `payload.userId` is looked up in the `"User"` table, and queries are strictly bound to `WHERE (userId = $1 OR patientId = $2)`.

### 2. Doctor / Clinician Portal Access
- **Doctor Route:** [frontend/app/patients/[id]/page.tsx](file:///d:/single_hospital/Single-Hospital-Pro/frontend/app/patients/[id]/page.tsx).
- **Access Flow:** Patients generate a shareable URL or QR code from [frontend/app/patient/share/page.tsx](file:///d:/single_hospital/Single-Hospital-Pro/frontend/app/patient/share/page.tsx) pointing to `/patients/{patientCode}`.
- **Current Authorization Gap:** The `/patients/[id]` route loads data by calling `clientApi.getPatientPrescriptions(patientId)` and `clientApi.getPatientObservations(patientId)`. These Next.js proxy endpoints currently **do not validate JWT session tokens or clinician access tokens**. Any user with a patient ID can query the underlying proxy endpoint directly.

### 3. Backend Service-to-Service Security
- **Python FastAPI Protection:** Secured by `require_key()` requiring header `X-API-Key: <API_TOKEN>`.
- **Default Token:** Defaults to `rx_local_dev_token_2026_secure`.
- **Public Routes on Python Backend:** `GET /health`, `GET /`, and `GET /api/ocr` (direct unauthenticated OCR). All other endpoints (`/ocr`, `/confirm/*`, `/extractions/*`, `/patients/*`) reject requests without a valid `X-API-Key`.

---

## E. Current Docker Workflow and Identified Build/Runtime Risks

### Service Definitions & Networking
In [docker-compose.yml](file:///d:/single_hospital/Single-Hospital-Pro/docker-compose.yml):
- **Service `python-ocr`:**
  - Build context: `./model`
  - Container name: `prescription-ocr-backend`
  - Port binding: `8000:8000`
  - Health check: `curl -f http://localhost:8000/health` (start period: 300s, interval: 30s)
  - Volumes: `paddlex-cache` (caches PaddleX weights in `/root/.paddlex`), `db-data` (local SQLite volume `/app/data`).
- **Service `frontend`:**
  - Build context: `./frontend`
  - Container name: `prescription-intelligence-web`
  - Port binding: `3000:3000`
  - Depends on: `python-ocr` (condition: `service_healthy`)
  - Environment: `PYTHON_API_URL=http://python-ocr:8000`, `DATABASE_URL=${DATABASE_URL}`.

### Identified Build and Runtime Risks

1. **Environment Variable Name Inconsistency (`API_TOKEN` vs. `PYTHON_API_TOKEN`):**
   - In `docker-compose.yml` line 14: `python-ocr` uses `API_TOKEN=${API_TOKEN:-rx_local_dev_token_2026_secure}`.
   - In `docker-compose.yml` line 46: `frontend` uses `PYTHON_API_TOKEN=${PYTHON_API_TOKEN:-rx_local_dev_token_2026_secure}`.
   - In `.env`: Only `API_TOKEN` is defined; `PYTHON_API_TOKEN` is missing.
   - **Risk:** If a user configures a custom `API_TOKEN` in `.env`, the frontend container falls back to `rx_local_dev_token_2026_secure`. All proxy requests from Next.js to FastAPI fail with `HTTP 401 Unauthorized`.
2. **Missing Supabase Storage Variables in Frontend Docker Service:**
   - In [docker-compose.yml#L43-L49](file:///d:/single_hospital/Single-Hospital-Pro/docker-compose.yml#L43-L49), the `frontend` container is passed `NODE_ENV`, `PYTHON_API_URL`, `PYTHON_API_TOKEN`, `DATABASE_URL`, and `NODE_TLS_REJECT_UNAUTHORIZED`.
   - It is **missing**: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, and `SUPABASE_STORAGE_FOLDER`.
   - **Risk:** In Docker production, image uploads fail to reach Supabase Cloud Storage and fall back to `/public/uploads` on the container's ephemeral file system, which is lost on restart.
3. **Database URL Fallback Divergence:**
   - If `DATABASE_URL` is omitted, `python-ocr` falls back to `sqlite:////app/data/rx_local.db`, while `frontend` falls back to `postgresql://postgres:postgres@localhost:5432/postgres`.
   - **Risk:** The frontend and backend would attempt to write to completely different databases.
4. **Standalone Next.js Build Requirements:**
   - `frontend/Dockerfile` uses multi-stage builds copying `.next/standalone`. Any `NEXT_PUBLIC_*` variable needed on the client must be injected at build time if referenced directly in browser bundles.

---

## F. Exact Files to Modify, Reuse, and Schema Assessment

### 1. Database Schema Changes: NONE REQUIRED
- The `observations` table is already defined in both PostgreSQL DDL and SQLAlchemy.
- It contains all required columns: `id`, `patient_id`, `prescription_id`, `obs_date`, `kind`, `systolic`, `diastolic`, `value`, `unit`, `raw_text`, `created_at`.
- Indices on `(patient_id)` and `(kind, obs_date)` are already in place.
- **No SQL migration is required.**

### 2. Files that Can Be Reused As-Is

| File | Reusability Rationale |
|---|---|
| [model/final_prescription_ocr_service_windows.py](file:///d:/single_hospital/Single-Hospital-Pro/model/final_prescription_ocr_service_windows.py) | `GET /patients/{patient_id}/observations?kind=` and confirmation vital persistence are already implemented and working. |
| [frontend/lib/db.ts](file:///d:/single_hospital/Single-Hospital-Pro/frontend/lib/db.ts) | Established `pg.Pool` connection pooler for parameterized database queries. |
| [frontend/lib/types.ts](file:///d:/single_hospital/Single-Hospital-Pro/frontend/lib/types.ts) | `ObservationRecord` interface already accurately reflects the schema. |
| [frontend/lib/api.ts](file:///d:/single_hospital/Single-Hospital-Pro/frontend/lib/api.ts) | `clientApi.getPatientObservations()` is already written and correctly typed. |
| [frontend/app/api/confirm/[id]/route.ts](file:///d:/single_hospital/Single-Hospital-Pro/frontend/app/api/confirm/[id]/route.ts) | Successfully triggers observation insertion via Python backend confirmation. |
| [frontend/components/VitalsDisplay.tsx](file:///d:/single_hospital/Single-Hospital-Pro/frontend/components/VitalsDisplay.tsx) | Established clinical icons, ranges, and status badges. |

### 3. Exact Files that Need to Change

| Target File | Required Modification | Rationale |
|---|---|---|
| [frontend/app/patient/trends/page.tsx](file:///d:/single_hospital/Single-Hospital-Pro/frontend/app/patient/trends/page.tsx) | Replace mock timeline string matching with real observation data fetching (`clientApi.getPatientObservations()` or direct query). Add time-series visualization. | Currently displays only placeholder timeline text and single scalar values instead of longitudinal history. |
| [frontend/app/patients/[id]/page.tsx](file:///d:/single_hospital/Single-Hospital-Pro/frontend/app/patients/[id]/page.tsx) | Upgrade the raw observation table to include interactive longitudinal trend charts and metric filtering (BP, HbA1c, Glucose, Vitals). | Currently renders a flat text table; lacks graphical trend analysis for doctors. |
| [frontend/app/api/patients/[patientId]/observations/route.ts](file:///d:/single_hospital/Single-Hospital-Pro/frontend/app/api/patients/[patientId]/observations/route.ts) | Add session verification (JWT validation or doctor referral access check). | Currently completely unauthenticated. |
| [docker-compose.yml](file:///d:/single_hospital/Single-Hospital-Pro/docker-compose.yml) | Synchronize `PYTHON_API_TOKEN` / `API_TOKEN` and inject missing Supabase Storage environment variables into `frontend`. | Eliminates 401 proxy failures and storage upload fallbacks. |

### 4. New Component to Create (Zero External Dependencies)
- **`frontend/components/trends/LongitudinalTrendChart.tsx`**: A responsive, SVG-based clinical time-series visualization component supporting:
  - Dual-line cardiovascular charts (Systolic / Diastolic with therapeutic band shading $\le 120/80$ mmHg).
  - Glycemic progression charts (HbA1c with target line at $6.5\%$, and Fasting/PPBS glucose).
  - Physiological vitals (Pulse, SpO2, Temperature, Weight).
  - Dark mode (Doctor portal `#090d16` / cyan) and Light mode (Patient portal `#ffffff` / teal) support.
  - Zero external npm chart dependencies (avoids React 19 compatibility conflicts).

---

## G. Proposed Implementation Sequence & Acceptance Criteria

```mermaid
sequenceDiagram
    participant P as Phase 1: Security & API Hardening
    participant Q as Phase 2: Shared SVG Trend Engine
    participant R as Phase 3: Patient UI Integration
    participant S as Phase 4: Doctor UI Integration
    participant T as Phase 5: Verification & Docker Validation

    P->>Q: Validated & Authorized API Endpoints
    Q->>R: Dual-Theme SVG Visualization Engine
    Q->>S: Dual-Theme SVG Visualization Engine
    R->>T: Live Patient Longitudinal Trends
    S->>T: Live Doctor Clinical Decision Support
```

### Phase 1: Security & API Hardening
- **Tasks:**
  - Secure [frontend/app/api/patients/[patientId]/observations/route.ts](file:///d:/single_hospital/Single-Hospital-Pro/frontend/app/api/patients/[patientId]/observations/route.ts) with JWT authentication and patient boundary checks.
  - Fix `PYTHON_API_TOKEN` alignment and Supabase Storage variables in [docker-compose.yml](file:///d:/single_hospital/Single-Hospital-Pro/docker-compose.yml).
- **Acceptance Criteria:**
  - Unauthenticated requests to `/api/patients/[id]/observations` return HTTP 401.
  - Authenticated patients can query their own observations.
  - `docker-compose.yml` correctly binds `PYTHON_API_TOKEN=${API_TOKEN}`.

### Phase 2: Zero-Dependency Clinical Trend Visualization Engine
- **Tasks:**
  - Build `frontend/components/trends/LongitudinalTrendChart.tsx` using SVG, TailwindCSS, and React 19.
  - Support date-scaled X-axis, value Y-axis, reference range zones (e.g., normal BP 120/80, normal HbA1c $<6.5\%$), hover tooltips with raw text and date, and empty states.
- **Acceptance Criteria:**
  - Renders properly without installing any third-party npm charting packages.
  - Adapts to both light mode (patient portal) and dark mode (doctor portal).

### Phase 3: Patient Portal Trends Integration
- **Tasks:**
  - Update [frontend/app/patient/trends/page.tsx](file:///d:/single_hospital/Single-Hospital-Pro/frontend/app/patient/trends/page.tsx) to fetch real patient observations via `clientApi.getPatientObservations()`.
  - Group observations by biomarker category (`bp`, `hba1c`, `sugar_*`, other vitals).
  - Display interactive trend cards with time-series charts, latest status badges, and source prescription links.
- **Acceptance Criteria:**
  - Patient trends page displays real database observations across multiple encounter dates.
  - Displays empty state guidance when no records are present for a biomarker.

### Phase 4: Doctor Portal Clinical Decision Support Integration
- **Tasks:**
  - Update [frontend/app/patients/[id]/page.tsx](file:///d:/single_hospital/Single-Hospital-Pro/frontend/app/patients/[id]/page.tsx) to include longitudinal trend charts above the raw observations table.
  - Add biomarker selector tabs (`All Vitals`, `Blood Pressure`, `Glycemic Panel (HbA1c & Sugars)`, `Vitals & Weight`).
- **Acceptance Criteria:**
  - Consulting physician sees multi-year physiological tracking aligned with confirmed prescriptions.
  - Hovering points reveals source prescription ID and recorded raw text.

### Phase 5: Containerized Validation & Regression Testing
- **Tasks:**
  - Execute end-to-end confirmation lifecycle test inside the Docker container.
  - Verify that confirming a new prescription with vitals immediately reflects on both the Patient Trends page and Doctor History page.
- **Acceptance Criteria:**
  - Uploading a prescription with vitals $\rightarrow$ confirming extraction $\rightarrow$ observation is immediately charted on both patient and doctor interfaces.
  - No errors in Docker logs.

---

## H. Blockers and Prerequisites

1. **Docker Compose Environment Alignment:**
   - In [docker-compose.yml#L46](file:///d:/single_hospital/Single-Hospital-Pro/docker-compose.yml#L46), `PYTHON_API_TOKEN` must be matched with `API_TOKEN`.
   - Storage bucket variables must be included in the frontend service environment in Docker Compose to prevent local disk fallback in containerized environments.
2. **Chart Library Compatibility:**
   - The project uses **React 19.2.8** (`react@19.2.8`). Popular libraries like `recharts` have unresolved peer dependency issues with React 19. **The custom SVG engine recommended in Phase 2 completely bypasses this risk without adding any dependencies.**
3. **Separate ML Project Isolation:**
   - The separate Random Forest Patient Risk Prediction model remains completely isolated and is not imported or referenced in this workflow.

---
