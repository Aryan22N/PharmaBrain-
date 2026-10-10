# KRISHNA.md — Vitals Analysis, Longitudinal Trends & Risk Prediction Plan

> **Branch:** `feature/Krishna` (All work for this feature is strictly maintained on this branch; `main` branch will remain untouched).  
> **Status:** Draft / Active Plan  
> **Date:** 2026-10-10  

---

## 1. Executive Summary & Objective

The goal of this initiative is to leverage all physiological vital readings extracted from patient-uploaded prescriptions (via PaddleOCR line extraction and multimodal Google Gemini AI structuring) to:
1. **Store & Align Chronologically**: Maintain a continuous longitudinal timeline of all vitals per patient across multiple prescription visits.
2. **Compute Statistical Trends**: Track changes ($\Delta$), trajectory slope, moving averages, and fluctuation velocities between encounters.
3. **Predict & Stratify Clinical Risks**: Evaluate vitals against deterministic, evidence-based clinical guidelines (AHA/ACC for Blood Pressure, ADA for Glycemia/HbA1c) rather than black-box ML models.
4. **Render Interactive Graphical Plots**: Display time-series charts with color-coded safety/risk zones on the patient dashboard (`/patient/trends`).
5. **Generate AI Patient Summaries**: Use Google Gemini to generate empathetic, plain-language summaries explaining trajectory patterns and actionable questions for their doctor.
6. **Scope Boundary**: Focused strictly on the **Patient Portal** experience. The doctor dashboard view is reserved for future phases.

---

## 2. Why Statistical & Clinical Rules (Not Black-Box ML)?

| Concern | Machine Learning Model (LSTM / XGBoost) | Statistical & Clinical Guidelines (Recommended) |
|---|---|---|
| **Data Density** | Requires dense, high-frequency time series (e.g., continuous daily/hourly telemetry). Prescriptions are sparse (2–10 readings over months/years). High risk of severe overfitting. | Robust on sparse, irregular data intervals. No overfitting. |
| **Medical Safety & Hallucination** | Black-box models can predict arbitrary or hallucinated risk percentages with no clinical validation. | Strict alignment with peer-reviewed medical standards (AHA/ACC, ADA, JNC-8, WHO). Defensible and transparent. |
| **Interpretability** | Difficult for patients or clinicians to understand why an ML score changed. | Highly interpretable: clear target ranges (e.g., *"BP 142/90 mmHg is classified as Stage 2 Hypertension"*). |

---

## 3. Data Pipeline & Architecture

```mermaid
flowchart TD
    subgraph Input["1. Data Ingestion"]
        RxUpload["Patient Prescription Upload"] --> OCR["PaddleOCR Line & Box Extraction"]
        OCR --> Gemini["Google Gemini Multimodal Structuring"]
        Gemini --> Confirmation["Clinician / Patient Review & Confirm"]
    end

    subgraph Storage["2. Longitudinal Storage"]
        Confirmation --> ObsTable[("Supabase observations Table\n(patient_id, obs_date, kind, value, systolic, diastolic, unit)")]
    end

    subgraph Engine["3. Analysis & Risk Engine"]
        ObsTable --> Stats["Statistical Trajectory Engine\n- Delta (Change from previous visit)\n- Velocity (Rate of increase/decrease)\n- Variability / Stability"]
        Stats --> RiskStrat["Clinical Guideline Staging\n- AHA/ACC BP Stages (Normal / Elevated / Stage 1 / Stage 2)\n- ADA Glycemic Control (Normal / Pre-diabetes / Diabetes)"]
    end

    subgraph Presentation["4. Patient Dashboard Presentation"]
        RiskStrat --> Charts["Interactive Graphical Trends (/patient/trends)\n- Time-series plots\n- Shaded target zones (Green / Amber / Red)\n- Direct links to source prescription scans"]
        RiskStrat --> AISummary["Gemini Patient-Friendly Narrative\n- Plain-English explanation\n- Warning flags & positive milestones\n- Suggested discussion topics for their doctor"]
    end
```

---

## 4. Clinical Guidelines & Risk Rules Matrix

### A. Blood Pressure (Cardiovascular Trajectory) — AHA / ACC Guidelines
- **Normal (🟢 Green)**: Systolic $< 120$ AND Diastolic $< 80\text{ mmHg}$
- **Elevated (🟡 Yellow)**: Systolic $120\text{--}129$ AND Diastolic $< 80\text{ mmHg}$
- **Stage 1 Hypertension (🟠 Orange)**: Systolic $130\text{--}139$ OR Diastolic $80\text{--}89\text{ mmHg}$
- **Stage 2 Hypertension (🔴 Red)**: Systolic $\ge 140$ OR Diastolic $\ge 90\text{ mmHg}$
- **Hypertensive Crisis (🚨 Alert)**: Systolic $> 180$ and/or Diastolic $> 120\text{ mmHg}$
- **Trajectory Risk Warning**:
  - Sustained rise: $\ge 2$ consecutive visits showing increased systolic BP ($\Delta \ge +10\text{ mmHg}$).

### B. Blood Glucose & HbA1c (Glycemic Trajectory) — ADA Guidelines
- **Fasting Blood Sugar (FBS)**:
  - *Normal*: $70\text{--}99\text{ mg/dL}$
  - *Prediabetes*: $100\text{--}125\text{ mg/dL}$
  - *Diabetic / Uncontrolled*: $\ge 126\text{ mg/dL}$
- **Post-Prandial Blood Sugar (PPBS / RBS)**:
  - *Normal*: $< 140\text{ mg/dL}$
  - *Elevated*: $140\text{--}199\text{ mg/dL}$
  - *High*: $\ge 200\text{ mg/dL}$
- **HbA1c**:
  - *Normal*: $< 5.7\%$
  - *Prediabetes*: $5.7\%\text{--}6.4\%$
  - *Diabetes*: $\ge 6.5\%$

### C. Secondary Biomarkers
- **Pulse / Heart Rate**: Normal ($60\text{--}100\text{ bpm}$), Bradycardia ($< 60\text{ bpm}$), Tachycardia ($> 100\text{ bpm}$).
- **SpO2**: Normal ($\ge 95\%$), Mild Hypoxia ($90\text{--}94\%$), Critical Hypoxia ($< 90\%$).
- **Weight & BMI**: Longitudinal weight change trends ($\Delta\text{ kg}$).

---

## 5. Implementation Roadmap

### Phase 1: Database & API Aggregation Layer
- [x] Verify that all confirmed prescription vitals populate the PostgreSQL `observations` table cleanly.
- [x] Build `/api/patient/trends` endpoint (or Next.js API route) to query, group, and order observations by `patient_id` and `obs_date`.
- [x] Implement statistical calculation utility:
  - Chronological sort.
  - Pairwise delta computation ($\Delta$).
  - Clinical category tagging (Normal / Elevated / Stage 1 / Stage 2).

### Phase 2: Graphical Trend Visualisation (`/patient/trends`)
- [x] Upgrade the patient trends interface (`frontend/app/patient/trends/page.tsx`).
- [x] Integrate modern interactive graphical charts (line/area charts with reference background bands for safe, borderline, and high-risk zones).
- [x] Add metric toggle tabs (Blood Pressure, Glucose/HbA1c, Heart Rate, SpO2, Weight).
- [x] Tooltip displaying date, exact values, delta from previous visit, and matching prescription link.

### Phase 3: AI Narrative & Risk Summary (Gemini)
- [x] Design a dedicated prompt in the backend / API to generate a patient-level health review based on the computed metrics.
- [x] Enforce healthcare safety disclaimers and strictly non-diagnostic, informational phrasing.
- [x] Render the AI Summary card with actionable highlights at the top of the `/patient/trends` page.

### Phase 4: Verification & Docker Validation
- [x] End-to-end testing with sample prescriptions containing multi-visit vitals.
- [x] Verification on branch `feature/Krishna`.
- [x] Full Next.js production build verification (`npm run build` succeeded cleanly with 0 errors).

---

## 6. Diagnosis: Docker Build & Startup Failure

### Observed Error in Terminal:
```
prescription-ocr-backend | Traceback (most recent call last):
prescription-ocr-backend |   File "/app/service.py", line 52, in <module>
prescription-ocr-backend |     raise RuntimeError(
prescription-ocr-backend | RuntimeError: GEMINI_API_KEY is missing or empty. Please configure GEMINI_API_KEY in model/.env
prescription-ocr-backend exited with code 1 (restarting)
...
Container prescription-ocr-backend Error dependency python-ocr failed to start
dependency failed to start: container prescription-ocr-backend is unhealthy
```

### Root Cause Analysis:
1. **Both images built successfully**: Both `pharmabrain-python-ocr` and `pharmabrain-frontend` compiled and built without syntax or package errors.
2. **Missing Environment Variable**: When Docker Compose runs `container prescription-ocr-backend`, it maps `GEMINI_API_KEY=${GEMINI_API_KEY}` from the host environment or a root `.env` file.
3. Because no `.env` file exists in the workspace root or `model/.env`, `${GEMINI_API_KEY}` evaluates to empty (`""`).
4. At startup, `final_prescription_ocr_service_windows.py` (copied as `/app/service.py`) executes:
   ```python
   if not GEMINI_API_KEY:
       raise RuntimeError("GEMINI_API_KEY is missing or empty. Please configure GEMINI_API_KEY in model/.env")
   ```
5. This raises an unhandled exception, causing the backend container to crash and exit with code 1.
6. The container healthcheck fails (`http://localhost:8000/health`), which prevents the `frontend` container from starting as well (due to `depends_on: python-ocr: condition: service_healthy`).

### Resolution:
Create a `.env` file in the project root (or `model/.env`) with valid credentials:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
DATABASE_URL=postgresql+psycopg2://user:password@host:5432/postgres
API_TOKEN=rx_local_dev_token_2026_secure
PYTHON_API_TOKEN=rx_local_dev_token_2026_secure
```
Once the `.env` file is present, `docker-compose up --build` will pass the environment variable into the container, allowing the backend to start and pass its healthcheck.
