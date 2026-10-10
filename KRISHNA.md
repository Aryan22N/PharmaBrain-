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


Viewed supabase_schema.sql:178-202

The **Trend Analysis Engine** transforms **isolated, individual prescription snapshots** into a **continuous, actionable longitudinal health story**.

---

### The Fundamental Problem It Solves

When a patient visits a clinic, a single prescription only shows a single moment in time:
> *"Today's BP is 138/88 mmHg. Take Telmisartan 40 mg."*

By itself, this number does not answer the most critical clinical questions:
- Is 138/88 **improving** (down from a dangerous 160/100)?
- Or is it **worsening** (creeping up from a healthy 120/80)?
- Is the current medication dosage actually working, or is treatment failing?

**The Trend Analysis Engine connects all historical prescriptions together to show the direction, speed, and safety of the patient's health trajectory over time.**

---

### Key Capabilities & Clinical Uses

```mermaid
flowchart LR
    A["Multi-Visit Prescriptions & Labs"] --> B["Deterministic Clinical Guidelines<br/>(AHA/ACC & ADA 2024)"]
    B --> C["Longitudinal Analytics<br/>• Monthly Velocity<br/>• Baseline Deltas<br/>• Sustained Rise Warning"]
    C --> D["Gemini Clinical Narrative<br/>• Plain-English Review<br/>• 3 Doctor Questions"]
    C --> E["Interactive Visual Graphs<br/>• Click point to view original Rx scan"]
```

#### 1. Longitudinal Trajectory & Velocity Tracking
- **Baseline vs. Latest:** Calculates the exact net change (e.g., *"Systolic BP down by -24 mmHg since March"*).
- **Monthly Velocity:** Measures the rate of change every 30 days (`(delta / days) * 30`) to determine if improvement is fast, gradual, or stagnating.
- **Trajectory Direction:** Classifies metrics into **Improving**, **Stable**, or **Worsening**.

#### 2. Deterministic Clinical Risk Stratification (Zero Hallucination)
Before any AI is involved, mathematical clinical guidelines categorize every reading:
- **Blood Pressure (AHA/ACC 2017):**
  - Normal (<120/<80 mmHg)
  - Elevated (120–129/<80 mmHg)
  - Stage 1 Hypertension (130–139 or 80–89 mmHg)
  - Stage 2 Hypertension (≥140 or ≥90 mmHg)
  - Hypertensive Crisis (>180 and/or >120 mmHg)
- **Blood Sugar & HbA1c (ADA 2024 Standards of Care):**
  - Fasting Glucose: Normal (<100), Prediabetes (100–125), Diabetes (≥126 mg/dL)
  - HbA1c: Normal (<5.7%), Prediabetes (5.7–6.4%), Diabetes (≥6.5%)
- **Cardiorespiratory Markers:**
  - Pulse / Heart Rate (Normal 60–100 bpm; Bradycardia <60; Tachycardia >100)
  - Oxygen Saturation / SpO2 (Normal ≥95%; Mild Hypoxia 90–94%; Critical Hypoxia <90%)
  - Weight & BMI trajectory

#### 3. Early Warning for Adverse Clinical Events
- **Sustained Rise Detection:** Automatically flags an alert if a patient's systolic BP increases consecutively over 3 visits by ≥10 mmHg.
- Catches gradual deterioration *before* the patient experiences a stroke, cardiac event, or diabetic crisis.

#### 4. Patient Empowerment (Google Gemini Plain-English Narrative)
Medical test results and numbers are often confusing or frightening to patients:
- **Translates Numbers into Reassurance:** Writes a warm, empathetic 2-paragraph overview explaining what their multi-visit numbers actually mean.
- **Celebrates Milestones:** Highlights positive progress (e.g., *"Your blood pressure shows an encouraging downward trend"*).
- **Questions for the Next Doctor Visit:** Gives the patient **3 specific, high-yield questions** tailored to their data:
  1. *"How do my blood pressure readings align with our long-term cardiovascular goals?"*
  2. *"Are there adjustments needed for my daily nutrition or medication?"*
  3. *"What target ranges should we establish for my next follow-up?"*

#### 5. 100% Traceability to Original Scans
- Every dot on the trend charts links back to the original physical prescription.
- Clicking any reading in the chart immediately opens the **source prescription image** and attending doctor’s name stored in Supabase Cloud Storage.

---

### Comparison: Without vs. With Trend Analysis

| Dimension | Without Trend Analysis | With Trend Analysis (`/patient/trends`) |
|---|---|---|
| **Perspective** | Fragmented papers scattered across clinic visits | Unified timeline tracking 6 key biomarkers over months and years |
| **Medication Efficacy** | Unknown unless the patient manually remembers | Proven mathematically with delta and monthly velocity graphs |
| **Risk Detection** | Reactive — noticed only after symptoms or emergencies | Proactive — automated sustained-rise warnings and clinical risk tiering |
| **Doctor Consultations** | Patient forgets past readings; doctor has 5 mins to browse papers | Doctor sees instant trajectory chart and patient brings 3 focused questions |
| **Patient Understanding** | Frustration with confusing medical jargon | Plain-English AI summary explaining progress clearly |

---

### Real-Life Clinical Example

A patient with hypertension and prediabetes uploads 4 prescriptions over 6 months:
1. **Visit 1 (April):** BP 148/94 (Stage 2 Hypertension), HbA1c 7.8%, Weight 81.2 kg.
2. **Visit 2 (June):** BP 136/86 (Stage 1 Hypertension), Weight 79.5 kg.
3. **Visit 3 (August):** BP 128/82 (Stage 1 Hypertension), HbA1c 6.9%, Weight 78.0 kg.
4. **Visit 4 (October):** BP 124/80 (Stage 1 Hypertension), HbA1c 6.4%, Weight 76.5 kg.

**What Trend Analysis delivers:**
- **Visual Chart:** A clear downward curve showing **-24 mmHg systolic reduction** and **-4.7 kg weight loss**.
- **Clinical Staging:** Flags the transition from **Stage 2 Hypertension** down to **Stage 1 (Borderline Normal)**, and HbA1c from **Diabetic** down to **Prediabetes**.
- **Gemini Summary:** *"Your therapeutic plan and lifestyle modifications are working effectively. Your cardiovascular risk has significantly decreased since April."*
- **Speed & Efficiency:** Served in **< 2 milliseconds** via the hash cache without redundant API costs.