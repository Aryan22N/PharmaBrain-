---
Title: API Specification
Purpose: Every endpoint with methods, auth, request/response, status codes, and curl examples
Last verified against code: 2026-10-08
Code version: a100256
Owner: TBD
---

# 05 — API Specification

## Overview

**Python FastAPI base URL:** `http://localhost:8000` (local) | `http://python-ocr:8000` (Docker)  
**Authentication:** `X-API-Key: <API_TOKEN>` header required on all endpoints except `GET /health` and `GET /` and `GET /api/ocr`.  
**API_TOKEN:** Set via `model/.env`. Auto-generated per session if not set. Default dev value: `rx_local_dev_token_2026_secure`.

**Max upload:** 10 MB. **Allowed types:** `image/jpeg`, `image/png`, `image/webp`.

---

## Extraction Status Values

```
PENDING_USER_CONFIRMATION → CONFIRMED
                          ↘ DISCARDED
```

See state diagram in [docs/api-data/04_DATA_MODEL.md](04_DATA_MODEL.md).

---

## Endpoints

### `GET /health`

Health check. No authentication required.

```bash
curl http://localhost:8000/health
```

**Response 200:**
```json
{
  "ok": true,
  "ocr": "PaddleOCR",
  "medicine_names_indexed": 253313,
  "time": "2026-10-07T17:00:00+00:00"
}
```

> `medicine_names_indexed` will be 0 during startup while `load_med_index()` runs in background.

---

### `GET /`

Informational root endpoint.

```bash
curl http://localhost:8000/
```

**Response 200:**
```json
{
  "status": "online",
  "service": "PaddleOCR Prescription API Server",
  "version": "3.0",
  "endpoints": {"health": "/health", "direct_ocr": "/api/ocr", "structured_ocr": "/ocr", "docs": "/docs"}
}
```

---

### `POST /ocr` ⭐ Primary pipeline endpoint

Full pipeline: preprocess → OCR → LLM → drug lookup → draft stored.

**Auth required:** Yes (`X-API-Key`)  
**Content-Type:** `multipart/form-data`  
**Form fields:** `file` (required), `patient_id` (required), `patient_name` (optional)

```bash
curl -X POST http://localhost:8000/ocr \
  -H "X-API-Key: rx_local_dev_token_2026_secure" \
  -F "file=@prescription.jpg" \
  -F "patient_id=483027156" \
  -F "patient_name=Rahul Sharma"
```

**Response 200:**
```json
{
  "ocr_id": 14,
  "extraction_id": 28,
  "status": "PENDING_USER_CONFIRMATION",
  "llm_model": "gemini-2.5-flash",
  "duplicate": false,
  "gate": {
    "status": "NEEDS_CHECK",
    "reasons": ["Paracetamol: CHECK unreadable frequency '1-O-1'"]
  },
  "warnings": ["date read as day/month/year -> 2026-10-07"],
  "record": {
    "patient": {"name": "Rahul Sharma", "uhid": "483027156", "age": "45", "sex": "M", "ward_bed": null, "name_conf": 0.985},
    "hospital": "City Care Hospital",
    "doctor": {"name": "Dr. A. K. Gupta", "reg_no": "MCI-48219"},
    "date_raw": "07/10/2026",
    "date_iso": "2026-10-07",
    "vitals": [
      {"name": "BP", "value": "130/80 mmHg", "conf": 0.96, "flag": "ok", "kind": "bp",
       "parsed": {"ok": true, "systolic": 130.0, "diastolic": 80.0, "unit": "mmHg"}}
    ],
    "diagnosis": ["Essential Hypertension"],
    "allergies": ["NKDA"],
    "medicines": [
      {
        "name": "Metformin", "form": "Tab", "strength": "500 mg",
        "dose": "1 tab", "frequency": "1-0-1", "timing": "after food", "duration": "30 days", "route": "oral",
        "fields": {
          "name": {"read": "Metformin", "conf": 0.98, "flag": "ok"},
          "strength": {"read": "500 mg", "conf": 0.97, "flag": "ok"},
          "frequency": {"read": "1-0-1", "conf": 0.96, "flag": "ok"}
        },
        "status": "OK", "min_conf": 0.94, "issues": [], "warnings": [], "corrected": [],
        "ambiguity_note": null,
        "db": {"verified": true, "db_name": "metformin", "generic": "metformin",
               "composition": "Metformin hydrochloride", "uses": "Type 2 diabetes (lowers blood glucose)", "score": 100}
      }
    ],
    "advice": ["Low salt diet"],
    "follow_up": "After 1 month"
  }
}
```

**Error responses:**

| Code | Meaning |
|---|---|
| 400 | Image not readable or preprocessing failed |
| 401 | Missing or invalid X-API-Key |
| 413 | File larger than 10 MB |
| 415 | Unsupported file type |
| 422 | No text found in image |
| 500 | OCR inference failed |
| 502 | All Gemini models failed |

---

### `POST /api/ocr` — Direct OCR (no auth, no LLM)

Simpler OCR endpoint for frontend compatibility. Returns raw bounding boxes only — no LLM structuring, no database write required. `patient_id` is optional.

```bash
curl -X POST http://localhost:8000/api/ocr \
  -F "file=@prescription.jpg"
```

**Response 200:**
```json
{
  "success": true,
  "filename": "prescription.jpg",
  "predictions_count": 24,
  "results": [
    {"box": [[120.0, 30.0], [400.0, 30.0], [400.0, 55.0], [120.0, 55.0]], "text": "City Care Hospital", "confidence": 0.992}
  ]
}
```

---

### `POST /structure/{ocr_id}`

Re-run LLM structuring on already-stored raw OCR (e.g. after a 502 failure). Does not re-run OCR.

**Auth required:** Yes  
**Route param:** `ocr_id` (integer, from `raw_ocr.id`)  
**Query param:** `patient_name` (optional string)

```bash
curl -X POST "http://localhost:8000/structure/14?patient_name=Rahul%20Sharma" \
  -H "X-API-Key: rx_local_dev_token_2026_secure"
```

**Response:** Same shape as `POST /ocr`.  
**Errors:** 404 if `ocr_id` not found; 502 if all Gemini models fail.

---

### `GET /extractions`

List recent extractions, newest first.

**Auth required:** Yes  
**Query params:** `limit` (int, default 20), `patient_id` (optional string filter)

```bash
curl "http://localhost:8000/extractions?patient_id=483027156&limit=5" \
  -H "X-API-Key: rx_local_dev_token_2026_secure"
```

**Response 200:** Array of extraction summary objects with `extraction_id`, `ocr_id`, `status`, `patient_id`, `filename`, `avg_conf`, `gate`, `record`.

---

### `GET /extractions/{extraction_id}`

Fetch a single extraction by ID.

**Auth required:** Yes

```bash
curl http://localhost:8000/extractions/28 \
  -H "X-API-Key: rx_local_dev_token_2026_secure"
```

**Response 200:** Full `ExtractionPayload` (same shape as `POST /ocr`).  
**Error:** 404 if not found.

---

### `GET /raw_ocr/{ocr_id}`

Fetch raw OCR lines for a specific upload.

**Auth required:** Yes

```bash
curl http://localhost:8000/raw_ocr/14 \
  -H "X-API-Key: rx_local_dev_token_2026_secure"
```

**Response 200:**
```json
{
  "id": 14, "image_sha256": "a3f2...", "patient_id": "483027156",
  "filename": "rx.jpg", "ocr_engine": "PaddleOCR",
  "image_w": 1200, "image_h": 1600, "avg_conf": 0.94,
  "lines": [
    {"id": "L01", "row": 1, "text": "City Care Hospital", "conf": 0.992, "x": 0.15, "y": 0.08}
  ],
  "created_at": "2026-10-07T17:00:00+00:00"
}
```

---

### `POST /confirm/{extraction_id}`

Confirm a draft extraction, saving it to the patient record.

**Auth required:** Yes  
**Content-Type:** `application/json`

```bash
curl -X POST http://localhost:8000/confirm/28 \
  -H "X-API-Key: rx_local_dev_token_2026_secure" \
  -H "Content-Type: application/json" \
  -d '{
    "record": {
      "patient": {"name": "Rahul Sharma", "uhid": "483027156", "age": "45", "sex": "M"},
      "hospital": "City Care Hospital",
      "doctor": {"name": "Dr. A. K. Gupta", "reg_no": "MCI-48219"},
      "date_raw": "07/10/2026", "date_iso": "2026-10-07",
      "vitals": [{"name": "BP", "value": "130/80 mmHg"}],
      "diagnosis": ["Essential Hypertension"],
      "allergies": ["NKDA"],
      "medicines": [{"name": "Metformin", "form": "Tab", "strength": "500 mg", "frequency": "1-0-1", "duration": "30 days"}],
      "advice": ["Low salt diet"],
      "follow_up": "After 1 month"
    },
    "confirmed_by": "Dr. Clinician",
    "allow_duplicate": false
  }'
```

**Response 200:**
```json
{
  "prescription_id": 12,
  "patient_id": "483027156",
  "rx_date": "2026-10-07",
  "edits": [],
  "observations_saved": 1,
  "observations_skipped": []
}
```

**Error responses:**

| Code | Meaning |
|---|---|
| 404 | Extraction not found |
| 409 | Already confirmed; or duplicate detected (send `allow_duplicate: true` to override) |
| 422 | No medicines in record |

---

### `POST /discard/{extraction_id}`

Discard a pending draft.

**Auth required:** Yes

```bash
curl -X POST http://localhost:8000/discard/28 \
  -H "X-API-Key: rx_local_dev_token_2026_secure"
```

**Response 200:** `{"ok": true}`  
**Errors:** 404 not found; 409 already confirmed.

---

### `GET /patients/{patient_id}/prescriptions`

Full prescription history for a patient, ordered by `rx_date` ascending.

**Auth required:** Yes

```bash
curl "http://localhost:8000/patients/483027156/prescriptions" \
  -H "X-API-Key: rx_local_dev_token_2026_secure"
```

**Response 200:** Array of `confirmed_prescriptions` rows with `data` (parsed JSON) and `edits` (parsed JSON).

---

### `GET /patients/{patient_id}/observations`

Vital sign time-series for trend charts.

**Auth required:** Yes  
**Query param:** `kind` (optional: `bp`, `sugar_fasting`, `sugar_post_meal`, `sugar_random`, `hba1c`, `pulse`, `temp`, `spo2`, `weight`)

```bash
curl "http://localhost:8000/patients/483027156/observations?kind=bp" \
  -H "X-API-Key: rx_local_dev_token_2026_secure"
```

**Response 200:** Array of `observations` rows ordered by `obs_date, id`.

---

### `POST /patients/{patient_id}/trends_summary`

Generates empathetic, patient-facing longitudinal AI narrative using Google Gemini and deterministic clinical guidelines.

**Auth required:** Yes  
**Body:** JSON `{ trends: object, patient_name: string }`

**Response 200:**
```json
{
  "narrative": "Your longitudinal health trajectory tracks physiological markers across clinical visits...",
  "keyHighlights": ["Latest BP: 124/80 mmHg (Normal)", "HbA1c glycemic control improved to 6.4%"],
  "questionsForDoctor": [
    "How do my blood pressure readings align with our long-term cardiovascular goals?",
    "Are there any adjustments needed for my daily nutrition?",
    "When should we schedule my next biomarker check?"
  ],
  "safetyDisclaimer": "Informational health analysis only. All clinical treatment decisions, drug dosages, and diagnosis must be confirmed directly with your licensed physician."
}
```

---

## Next.js API Routes (frontend proxy)

The frontend's API routes are in `frontend/app/api/`. They enforce JWT auth, then proxy to the Python service. Full list:

| Route | Method | Proxies to Python | Notes |
|---|---|---|---|
| `/api/ocr` | POST | `POST /ocr` | Uploads image to Supabase Storage Bucket (`OCR_Images/uploads/`), checks SHA256 duplicate image hash, creates `Document` & `Analysis` records, returns `image_url` |
| `/api/confirm/[id]` | POST | `POST /confirm/{id}` | Confirms prescription, preserves public `image_url` on `Document.storedFilename` & `Analysis.structuredResult`, mirrors vitals to `observations` table |
| `/api/discard/[id]` | POST | `POST /discard/{id}` | Discards draft extraction and marks `Document.status = 'DISCARDED'` |
| `/api/extractions/[id]` | GET | `GET /extractions/{id}` | Fetches pending extraction draft |
| `/api/extractions` | GET | `GET /extractions` | Lists recent extractions |
| `/api/raw-ocr/[id]` | GET | `GET /raw_ocr/{id}` | Fetches raw bounding boxes and line coordinates |
| `/api/structure/[id]` | POST | `POST /structure/{id}` | Re-triggers LLM structuring on stored raw OCR |
| `/api/patients/[id]/prescriptions` | GET | `GET /patients/{id}/prescriptions` | Fetches confirmed prescriptions for patient |
| `/api/patients/[id]/observations` | GET | `GET /patients/{id}/observations` | Fetches vital observations time-series |
| `/api/patient/trends` | GET | `POST /patients/{patient_id}/trends_summary` | Evaluates longitudinal statistical trends (AHA/ACC BP, ADA glucose), deltas, and Gemini AI patient narrative |
| `/api/patient/medicines` | GET, POST | — | Longitudinal medication lifecycle management. GET returns `{ current, history, needsReview, all, stats }` with resolved high-res prescription scan URLs. POST creates new manual course. |
| `/api/patient/medicines/[id]` | PATCH, PUT | — | PATCH transitions lifecycle status (`COMPLETED`, `ON_HOLD`, `DISCONTINUED`, `ACTIVE`) with mandatory clinical reason. PUT resolves review conflicts. Writes audit log. |
| `/uploads/[...slug]` | GET | — | Dynamic high-res image serving route for prescription scans; checks `/public/uploads/` with transparent fallback to `/sample_prescription.png`. |
| `/api/health` | GET | `GET /health` | Health check proxy |
| `/api/auth` | POST | — | Login/register, returns JWT cookie |
| `/api/user` | GET | — | Current user info from DB |
| `/api/user/onboarding` | POST, GET | — | Saves & retrieves patient initial profile context (`patient_onboarding` table) |
| `/api/user/dashboard` | GET | — | Returns patient profile, timeline, vitals trends, and confirmed/pending documents with resolved public Supabase Storage `imageUrl` |
| `/api/user/save-ocr` | POST | — | Direct helper to persist confirmed OCR payload into `Document` and `Analysis` tables |

---

### Medication Lifecycle Endpoints

#### `GET /api/patient/medicines`
Aggregates all medications from confirmed prescriptions and `patient_medications`, executes the generalized reconciliation engine, and returns partitioned courses:
- **`current`**: Medications currently ongoing (`ACTIVE`, `ON_HOLD`).
- **`history`**: Terminated regimens (`COMPLETED`, `DISCONTINUED`).
- **`needsReview`**: Regimens requiring clinical attention (`NEEDS_REVIEW`, conflicting instructions, or changed strength).
- **`imageUrl`**: Resolved high-resolution scan URL for each course anchored to originating physical prescription scans.

#### `PATCH /api/patient/medicines/[id]`
Applies a patient or clinician lifecycle transition:
- **Body**: `{ "status": "COMPLETED" | "ON_HOLD" | "DISCONTINUED" | "ACTIVE", "reason": "Mandatory explanation string" }`
- **Validation**: Enforces non-empty reason for discontinuations and holds (returns HTTP 422 if empty).
- **Audit Logging**: Appends record into `patient_medication_audit`.

#### `PUT /api/patient/medicines/[id]`
Confirms a reviewed conflict or dosage change:
- **Body**: `{ "confirmKeep": true }`
- **Action**: Moves course from `NEEDS_REVIEW` to `ACTIVE`, clears `is_conflicting`, and logs audit entry.

> Next.js API timeout: 360,000 ms (6 minutes) to accommodate CPU PaddleOCR inference time. Confirmed in `frontend/lib/api.ts` → `pythonBackendFetch()`.

### Image Storage & Public CDN URLs

- Prescription images are stored in Supabase Cloud Storage:
  - Bucket: `OCR_Images` (configured with `public: true`)
  - Folder: `uploads/`
  - URL format: `https://<supabase-ref>.supabase.co/storage/v1/object/public/OCR_Images/uploads/<clean_filename>_<timestamp>.<ext>`
- `/api/ocr` returns `image_url` containing the direct public CDN URL.
- `/api/user/dashboard` resolves `imageUrl` for each prescription card. If a full Supabase URL is present, it is served directly without prepending `/uploads/`.
- Dual-engine fallback: If Supabase JS client fails, `frontend/lib/supabaseStorage.ts` attempts native HTTP REST API, and falls back to containerized disk `/app/public/uploads` with Next.js user permissions.

