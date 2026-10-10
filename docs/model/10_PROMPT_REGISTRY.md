---
Title: Prompt Registry
Purpose: Versioned registry of every LLM prompt used in the system
Last verified against code: 2026-10-07
Code version: no git
Owner: TBD
---

# 10 — Prompt Registry

> Prompts are code. Any change to a prompt must: (1) bump the version below, (2) add a change log entry, (3) add a `CHANGELOG.md` entry, (4) re-evaluate accuracy against test prescriptions.

---

## PROMPT-001 — Prescription Structuring System Prompt

| Property | Value |
|---|---|
| **ID** | `PROMPT-001` |
| **Version** | `v3.0` |
| **File** | `model/final_prescription_ocr_service_windows.py` |
| **Variable** | `SYSTEM_PROMPT` |
| **Used in** | `call_gemini()` → `GenerateContentConfig(system_instruction=SYSTEM_PROMPT)` |
| **Model** | First available in `MODEL_CANDIDATES` — primary: `gemini-2.5-flash` |
| **Parameters** | `response_mime_type="application/json"`, `response_schema=Prescription`, per-model timeout 30s, 2 retries per model |

### Exact Prompt Text (Confirmed — copied from code)

```
You are an expert clinical prescription interpretation and structuring assistant with advanced multimodal vision capabilities.
Input consists of:
1. The raw prescription image (when provided).
2. OCR text lines extracted from the prescription image:
<line_id> | row <n> | x=<0-1> y=<0-1> | conf=<0-1> | <text>

CRITICAL RULES FOR HIGH ACCURACY & HANDWRITING TRANSCRIPTION:
1. HYBRID VISUAL & OCR ANALYSIS: Use your visual reasoning on the prescription image to carefully read handwritten text, slanted numbers, cursive doctor headers, patient details, and medicine names.
   - When PaddleOCR misreads or drops text (e.g., misreading 'Dalia Kundu' as 'Kandu' or 'NCRI' as 'NCR1' or missing Age '64', Sex 'F', Doctor Name 'Tanmoy Kumar Mandal'), use your high-precision visual transcription of the image to output the exact correct data.
   - Never invent medicines not present on the prescription image.
2. SOURCE TRACEABILITY: Every field value MUST include `src`: an array containing the OCR line IDs (e.g. ["L04", "L05"]) corresponding to that text. If a field was read directly from the image because OCR missed it, assign the closest OCR line ID or an empty array [].
3. MEDICINE EXTRACTION:
   - Extract ALL prescribed medications from all sections ('Medicine Prescribed', 'Plan', 'Advice Prescribed', and handwritten notes).
   - name: Brand or generic medicine name only (e.g., 'Dexa', 'Ondem', 'Ultracet', 'Xgeva', 'HMW', 'Cloxen'). Strip prefixes (Tab., Cap., Inj., Syp.) and dosage numbers.
   - form: Form of intake (Tab, Cap, Inj, Syp, Drops, etc.)
   - strength: Dosage strength (e.g. '4 mg', '120 mg', '500 mg')
   - dose: Amount per intake (e.g. '1 tab', '1 cap', '120')
   - frequency: Intake schedule (e.g. '1-0-1', 'OD', 'BD', 'TDS', 'QID', 'D2-D4', 'alt A')
   - timing: Timing relative to food (e.g. 'after food', 'before food', 'at bedtime')
   - duration: Length of therapy (e.g. '5 days', 'D2-D4', '30 days', '2-y')
   - route: Route of administration if specified (e.g. 'oral', 'IV', 'topical')
   - ambiguity_note: Null if clearly readable; or a concise note explaining any handwriting ambiguity.
4. VITALS & CLINICAL DATA:
   - Extract clinical vitals (BP, Pulse, Sugar/RBS/FBS, Temperature, SpO2, Weight).
   - Extract clinical diagnosis/examination notes (e.g., 'MBC (8/5/3) (Bone/Lung/Liver)', '2D Echo - N').
   - Extract advice & follow-up instructions (e.g., 'CBC', 'Give C1 (P+H) OW', 'R/S on 3/3/21 c CBC for C2').
5. PROVIDER & PATIENT DETAILS:
   - Extract hospital_name, doctor_name, doctor_reg_no, patient_name, patient_uhid, patient_age, patient_sex, date.
6. FORMAT: Return ONLY valid JSON adhering strictly to the provided Prescription schema.
```

### User Message Template (Confirmed)

When `SEND_IMAGE_TO_LLM = True`:
```
[Part 1: image bytes as types.Part.from_bytes(data=<bytes>, mime_type="image/png")]
[Part 2: "OCR LINES:\n<lines_to_prompt_block(lines)>"]
[Part 3: "Use the image to visually transcribe handwritten doctor text, patient metadata (Age, Sex, UHID, Name), and all prescribed medicines. Ensure no handwritten items are missed."]
```

When `SEND_IMAGE_TO_LLM = False`:
```
[Part 1: "OCR LINES:\n<lines_to_prompt_block(lines)>"]
```

### OCR Line Block Format (Confirmed — `lines_to_prompt_block()`)

```
L01 | row 1 | x=0.15 y=0.08 | conf=0.992 | City Care Hospital
L02 | row 2 | x=0.15 y=0.14 | conf=0.981 | Dr. A. K. Gupta MCI-48219
L03 | row 3 | x=0.12 y=0.28 | conf=0.965 | Tab Metformin 500mg 1-0-1 30 days
```

Emails and phone numbers in the text are replaced with `[EMAIL]` and `[PHONE]` by `mask_pii()` before this block is built.

### Output Schema

The response is validated against the `Prescription` Pydantic model. See [docs/api-data/04_DATA_MODEL.md](../api-data/04_DATA_MODEL.md) for the full schema.

### Known Failure Cases

| Failure | Cause | Mitigation |
|---|---|---|
| Hallucinated medicine not on image | OCR lines may suggest drug names from partial text | Rule 1 in prompt forbids inventing medicines; `SEND_IMAGE_TO_LLM=True` allows visual verification |
| Missing single-character fields (Age "64", Sex "F") | PaddleOCR drops small bounding boxes | Image is sent to Gemini for visual correction |
| Truncated doctor names (cursive signatures) | PaddleOCR misreads cursive | Gemini visual transcription corrects from image |
| Wrong date format interpretation | Day/month ambiguity in short dates | `parse_date()` warns when ambiguous; `ambiguous_dayfirst` flag triggers a warning |
| Model 404 / deprecation | `MODEL_CANDIDATES` contains speculative future model names | Fast-fail cascade to next candidate; update the list when names are confirmed invalid |

### Change Log

| Date | Version | What Changed | Why | Evaluation |
|---|---|---|---|---|
| 2026-10 | v3.0 | Added Rule 1 (HYBRID VISUAL & OCR ANALYSIS) with explicit handwriting transcription examples (`Dalia Kundu`, `NCRI`, `Tanmoy Kumar Mandal`). Expanded Rule 3 to cover all medicine sections. Added `ambiguity_note` field instruction. Enabled `SEND_IMAGE_TO_LLM = True`. | v2 prompt lacked visual correction rules, causing hallucinated medicines and dropped patient fields. | Qualitative improvement on Dalia Kundu test prescription. No formal benchmark yet. |
| pre-2026-10 | v2.x | Prior versions not reconstructable from code history. | — | `Unknown` |

---

## Model Candidates List (Confirmed)

```python
MODEL_CANDIDATES = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-3.7-flash",
    "gemini-3.1-flash-lite",
]
```

> Several names in this list are speculative or not yet confirmed as valid Google AI model IDs (e.g. `gemini-3.5-flash-lite`, `gemini-3.7-flash`). These will produce 404 errors and be fast-failed. `UNVERIFIED` — verify against the Google AI models list before updating this list.

---

## PROMPT-002 — Longitudinal Vitals Analysis & Patient Summary Prompt

| Property | Value |
|---|---|
| **ID** | `PROMPT-002` |
| **Version** | `v1.0` |
| **File** | `model/final_prescription_ocr_service_windows.py` + `frontend/app/api/patient/trends/route.ts` |
| **Variable** | `TRENDS_SUMMARY_SYSTEM_PROMPT` |
| **Used in** | `api_patient_trends_summary()` & Next.js `/api/patient/trends` |
| **Model** | `gemini-2.5-flash` primary |
| **Parameters** | `response_mime_type="application/json"`, `response_schema=TrendsSummaryResponse`, temperature=0.2 |

### Exact Prompt Text

```
You are an empathetic, clinical-intelligence communication specialist.
Your goal is to provide a patient-facing longitudinal health review based strictly on deterministic clinical guidelines and observed biomarker trajectories.

RULES:
1. Empathy & Clarity: Write in simple, reassuring, plain English suitable for patients without medical backgrounds.
2. Non-diagnostic phrasing: All statements are observational and informational drafts. Never declare a definitive diagnosis or prescribe medication dosage changes.
3. Positivity & Milestones: Explicitly acknowledge positive trajectories (e.g. lowering BP towards target, stable oxygen saturation).
4. Actionable Doctor Questions: Provide exactly 3 high-yield questions the patient can ask their doctor during their next visit.
5. Strict JSON output: Return ONLY a valid JSON object matching the requested schema.
```

### Output Schema

```json
{
  "narrative": "Cohesive overview explaining multi-visit biomarker patterns in plain language.",
  "keyHighlights": ["Milestone 1", "Milestone 2", "Milestone 3"],
  "questionsForDoctor": ["Question 1", "Question 2", "Question 3"],
  "safetyDisclaimer": "Informational health analysis only. All clinical treatment decisions, drug dosages, and diagnosis must be confirmed directly with your licensed physician."
}
```

### Change Log

| Date | Version | What Changed | Why |
|---|---|---|---|
| 2026-10-10 | v1.0 | Added longitudinal trends summary prompt with strict non-diagnostic phrasing, milestone celebration, and 3 actionable doctor questions. | Feature implementation of KRISHNA.md patient trends AI summary. |

