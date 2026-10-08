---
Title: Security & Privacy
Purpose: Data classification, PII handling, auth, encryption, compliance, and gaps
Last verified against code: 2026-10-07
Code version: no git
Owner: TBD
---

# 08 — Security & Privacy

> ⚠️ **Healthcare safety:** All patient data handled by this system is sensitive. Never log, expose, or commit patient names, UHID, diagnoses, or prescription content. Never commit `.env` files or API keys.

---

## Data Classification

| Data | Classification | Where Stored |
|---|---|---|
| Patient name, UHID | Personal health data | `raw_ocr.lines_json`, `extractions.analysis_json`, `confirmed_prescriptions.data_json` |
| Prescription image | Personal health data | Supabase Storage Cloud Bucket (`OCR_Images/uploads/`) with public CDN URLs |
| Diagnosis, medicines, vitals | Personal health data | `extractions.analysis_json`, `confirmed_prescriptions.data_json`, `observations` |
| Doctor name, registration number | Professional personal data | `confirmed_prescriptions` |
| Email and phone numbers (from clinic headers) | Personal data | **Masked before LLM call** by `mask_pii()` |
| Patient account password | Credential | Stored as bcrypt hash in `"User".passwordHash` (salt factor 10) |
| JWT token | Session credential | HTTP-only cookie; expires in 7 days |
| `GEMINI_API_KEY` | Secret | `model/.env` — never committed |
| `DATABASE_URL` | Secret | `model/.env` — never committed |
| `API_TOKEN` | Secret | `model/.env` — never committed |
| `JWT_SECRET` | Secret | `frontend/.env.local` — never committed |

---

## Data Flow to Third Parties

| Third party | What is sent | Masked first? | Basis |
|---|---|---|---|
| **Google Gemini API** | Prescription image bytes (when `SEND_IMAGE_TO_LLM=True`) + OCR line text including patient names, UHID, diagnosis, medicines | Emails and phone numbers masked by `mask_pii()`. Patient names and clinical data are **not** masked. | Confirmed — `call_gemini()` in `model/final_prescription_ocr_service_windows.py` |
| **Supabase** (if used) | All structured data, images not stored in Supabase | N/A — Supabase is the database | Confirmed — `DATABASE_URL` in `model/.env` |

> **Material privacy consideration:** Patient names, UHID, diagnosis, and medicine data are sent to Google Gemini's API. Operators must ensure this is covered by appropriate data processing agreements and patient consent, and must verify compliance with the Digital Personal Data Protection Act, 2023 (India) before deploying this system. **Confirm with legal counsel.**

---

## PII Masking (Confirmed)

`mask_pii()` in `model/final_prescription_ocr_service_windows.py`:
- Replaces email addresses with `[EMAIL]` using regex `[\w.+-]+@[\w-]+\.[\w.]+`.
- Replaces Indian and international phone numbers with `[PHONE]` using regex for 8–13 digit numbers.

**What is NOT masked before sending to Gemini:** patient names, UHID/MR numbers, dates, diagnosis text, medicine names, doctor names.

---

## Authentication and Authorisation

### Python API (Confirmed)

- All endpoints except `GET /health`, `GET /`, and `GET /api/ocr` require the `X-API-Key` header.
- Validated in `require_key()` using `secrets.compare_digest()` — constant-time comparison to prevent timing attacks.
- Dev token (`rx_local_dev_token_2026_secure`) is accepted when `API_TOKEN` is not set or equals the dev token. This must not be used in production.

### Next.js Frontend (Confirmed)

- JWT-based session: `generateToken()` signs `{userId, email, name, patientId}` with `JWT_SECRET`.
- Token stored in an HTTP cookie named `auth_token`, `expires: 7d`.
- Verified on every API route via `verifyToken()`.
- Patient data isolation: `patient_id` is taken from the verified JWT payload, not from user-supplied form fields — prevents cross-patient data access.

### Password Security (Confirmed)

- Passwords hashed with `bcryptjs`, salt factor 10 (`frontend/lib/auth.ts` → `hashPassword()`).

---

## Encryption

| Layer | Status |
|---|---|
| Data in transit (Python ↔ Gemini) | HTTPS enforced by the `google-genai` SDK |
| Data in transit (Next.js ↔ Python) | HTTP (plain) in local/Docker deployment — no TLS between services within Docker network |
| Data in transit (Browser ↔ Next.js) | Depends on deployment configuration — not enforced by the application code |
| Data in transit (Python ↔ Supabase) | TLS enforced by Supabase connection string (default requires SSL) |
| Data at rest (PostgreSQL) | Supabase encrypts at rest by default for cloud deployments. Local SQLite: no encryption. |
| Prescription images (local disk) | No encryption at rest — images stored as plain files in `public/uploads/` and `model/preprocessed/` |

---

## User Data Isolation

- Row-Level Security (RLS) is enabled in Supabase on `"User"`, `"Document"`, `"Analysis"`, `confirmed_prescriptions`, `observations`, `raw_ocr`, `extractions`. Policies grant full access via service role (backend). Direct user-level RLS policies are not implemented — application-level isolation via JWT `patient_id` is the current control.
- End-to-end auth isolation is tested in `scratch/test_e2e_auth_isolation.py`.

---

## Legal and Compliance

This system stores and processes personal health data. The following applies:

**India — Digital Personal Data Protection Act (DPDPA), 2023:**
- Patients must consent to collection and processing of their health data.
- Data must be used only for the stated purpose (medical record management).
- Data principals have rights to access and erase their data.
- Cross-border transfer of data (to Google Gemini's API, which may process data outside India) requires compliance with transfer provisions.

> All compliance statements above are general interpretations. **Confirm with legal counsel before deploying this system in a clinical setting.**

---

## Security Gaps and Required Fixes

Ranked by severity:

| Severity | Gap | Evidence | Suggested Fix |
|---|---|---|---|
| 🔴 Critical | Patient names and clinical data sent to Google Gemini without masking | `call_gemini()` — only emails/phones masked | Assess with legal counsel; obtain DPA/consent; consider de-identification before LLM call |
| 🔴 Critical | JWT fallback secret hardcoded in `frontend/lib/auth.ts` | `JWT_SECRET || 'pharma_brain...'` | Always set `JWT_SECRET` in production environment |
| 🔴 Critical | Dev API token accepted in production if `API_TOKEN` is not set | `require_key()` allows dev token when `API_TOKEN == DEV_API_TOKEN` | Always set a strong `API_TOKEN` in production `.env` |
| 🟠 High | No TLS between Next.js and Python service in Docker | `docker-compose.yml` — HTTP plain | Use a reverse proxy (nginx/traefik) with TLS termination for production |
| 🟠 High | Prescription images stored unencrypted on local disk | `public/uploads/`, `model/preprocessed/` | Move to encrypted object storage (S3 with server-side encryption) |
| 🟡 Medium | CORS set to `allow_origins=["*"]` in Python service | `app.add_middleware(CORSMiddleware, allow_origins=["*"])` | Restrict to specific frontend origin in production |
| 🟡 Medium | No rate limiting on OCR endpoint | `api_ocr()` — no rate limit | Add FastAPI middleware or API gateway rate limiting |
| 🟡 Medium | `edits_json` stores exact field diffs including patient data | `confirmed_prescriptions.edits_json` | Acceptable for clinical audit; ensure DB-level access control |
