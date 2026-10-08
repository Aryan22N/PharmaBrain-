---
Title: Medicine Knowledge Base
Purpose: Contents, schema, matching logic, and update process for medicine_master
Last verified against code: 2026-10-07
Code version: no git
Owner: TBD
---

# 06 — Medicine Knowledge Base

## Current Contents

| Property | Value | Source |
|---|---|---|
| Starter set size | 27 rows (as defined in `STARTER` constant) | Confirmed — `model/final_prescription_ocr_service_windows.py` → `STARTER` list |
| Production DB size | 253,313 records (`load_med_index()` log message) | The log message says "250k+" and "253,313"; this number is from the previous import session. `UNVERIFIED` — actual row count depends on what has been imported into Supabase `medicine_master`. |
| In-memory index size | Number of index keys loaded by `load_med_index()` | Reported at startup in `medicine_names_indexed` in `/health` response |

### Starter Set (27 drugs — Confirmed)

| Name (key) | Generic | Composition | Strengths |
|---|---|---|---|
| metformin | metformin | Metformin hydrochloride | 250,500,850,1000 |
| atorvastatin | atorvastatin | Atorvastatin calcium | 5,10,20,40,80 |
| pantoprazole / pan | pantoprazole | Pantoprazole sodium | 20,40 |
| vitamin d3 / cholecalciferol | cholecalciferol | Cholecalciferol (vitamin D3) | — |
| paracetamol / pacimol / calpol | paracetamol | Paracetamol | 250,500,650,1000 |
| amlodipine | amlodipine | Amlodipine besylate | 2.5,5,10 |
| telmisartan | telmisartan | Telmisartan | 20,40,80 |
| ondansetron / emset / ondem | ondansetron | Ondansetron | 4,8 |
| levofloxacin | levofloxacin | Levofloxacin | 250,500,750 |
| febuxostat | febuxostat | Febuxostat | 40,80 |
| folvite | folic acid | Folic acid | — |
| dytor | torsemide | Torsemide | — |
| levolin | levosalbutamol | Levosalbutamol | — |
| meftal-p | mefenamic acid + paracetamol | Mefenamic acid + Paracetamol | — |
| dexamethasone / dexa | dexamethasone | Dexamethasone | 0.5,1,2,4,8 |
| ultracet | tramadol + paracetamol | Tramadol + Paracetamol | — |
| xgeva / denosumab | denosumab | Denosumab | 120 |
| cloxen | cloxacillin | Cloxacillin | 250,500 |
| hmw | heparin / low molecular weight heparin | LMWH | — |

---

## Data Sources

| Source | License | Coverage | Last Verified |
|---|---|---|---|
| Starter seed (hardcoded in `STARTER`) | Internal | 27 common drugs | Confirmed in code |
| Bulk CSV import via `import_medicines_bulk.py` | `UNVERIFIED` — depends on source dataset | `UNVERIFIED` | `UNVERIFIED` |
| CDSCO / Jan Aushadhi catalogue | Government open data — `UNVERIFIED` before production use | High for Indian generics | `UNVERIFIED` |
| WHO ATC / RxNorm | WHO / US NLM open access — `UNVERIFIED` before production use | High for generics, low for Indian brands | `UNVERIFIED` |
| Kaggle / GitHub Indian medicine datasets | Varies — `UNVERIFIED` before production use | High for Indian brands | `UNVERIFIED` |

> A licensed pharmacist must verify the medicine dataset before production deployment. See [docs/architecture/01_PROJECT_BRIEF.md](../architecture/01_PROJECT_BRIEF.md).

---

## Database Schema

The `medicine_master` table schema is defined in `model/final_prescription_ocr_service_windows.py`. See [docs/api-data/04_DATA_MODEL.md](../api-data/04_DATA_MODEL.md) for the full column table.

The `load_med_index()` function also handles an extended column schema (`brand_name`, `generic_name`, `composition_raw`, `active_ingredients`, `strength_text`, `therapeutic_class`) used when importing bulk datasets with different column names.

---

## Matching Approach (Current — Confirmed)

### Step 1: Name normalisation

Input medicine name from LLM → lowercase → collapse whitespace → strip all non-alphanumeric except space and hyphen.

```python
q = re.sub(r"[^a-z0-9 \-]", "", re.sub(r"\s+", " ", name.lower())).strip()
```

### Step 2: Exact match

Look up `q` directly in `MED_INDEX` dict (O(1) hash lookup).  
→ If found: `{status: "exact", score: 100, row: {...}}`

### Step 3: Fuzzy match (only if name length ≥ 5)

Short brand names (e.g. `pan`, `emset`) are explicitly excluded from fuzzy matching to avoid cross-drug confusion.

Uses `rapidfuzz.process.extractOne(q, MED_INDEX.keys(), scorer=fuzz.ratio)`.  
Threshold: score ≥ 85 → `{status: "near", score: N}`.

### Step 4: No match

→ `{status: "none"}` — generates a `warnings` entry: `"'<name>' not found in medicine database (unverified)"`.

### Safety rules

1. **Near matches are never auto-accepted.** They generate a `near_match` issue that surfaces in the review UI for clinician confirmation.
2. **Strength check:** For exact matches with known `strengths_mg`, if the extracted strength does not match any known value, an `unusual_strength` issue is generated.
3. **No hallucination:** When a medicine is not found, `verified: false` is returned and no composition or uses data is generated. The LLM is explicitly instructed not to invent medicine data.
4. **Form check:** Not implemented in the current code. `PLANNED` — strength and form should agree with the database record before auto-verification.

---

## In-Memory Index (`MED_INDEX`)

Built by `load_med_index()` in a background daemon thread at startup.

For each row: both the brand name (`brand_name` / `name`) and the generic name (`generic_name` / `generic`) are added as separate keys. Additionally, a "simple brand" (brand name without trailing strength digits) is added if ≥ 3 characters and not already present.

Example: brand `"Metformin 500mg"` → keys `"metformin 500mg"`, `"metformin"`.

---

## How to Ingest or Update Data

### Option A: CSV import (Confirmed)

```python
# CSV must have columns: name, generic, composition, uses, strengths_mg
from model.final_prescription_ocr_service_windows import import_medicine_csv
import_medicine_csv("path/to/medicines.csv", source="my_dataset_v1")
```

Or using the bulk importer (handles 250k+ rows efficiently):

```bash
python model/import_medicines_bulk.py
```

### Option B: Direct SQL

```sql
INSERT INTO medicine_master (name, generic, composition, uses, strengths_mg, source)
VALUES ('amoxicillin', 'amoxicillin', 'Amoxicillin trihydrate', 'Bacterial infections', '250,500', 'manual')
ON CONFLICT (name) DO UPDATE SET generic=EXCLUDED.generic, composition=EXCLUDED.composition;
```

### Pharmacist verification process (PLANNED)

Currently there is no built-in pharmacist sign-off workflow. Required before production:
1. Export candidate rows (`source != 'verified'`).
2. Pharmacist reviews and marks verified rows.
3. Update `source = 'pharmacist_verified_YYYY-MM-DD'` for approved rows.

---

## PLANNED — Target Medicine Database Design

A normalised multi-table schema to replace the flat `medicine_master`:

| Table | Purpose |
|---|---|
| `medicines` | One row per brand product: `brand_name`, `form`, `manufacturer`, `market_status` |
| `ingredients` | Active salts: `salt_name`, `atc_code`, `iupac_name` |
| `medicine_aliases` | OCR error aliases and brand variants |
| `medicine_ingredients` | Many-to-many: links medicines to ingredient salts with `strength_mg` |

Matching algorithm: SQL trigram (`pg_trgm`) for candidate retrieval + `pgvector` for embedding-based fallback + relational SQL as sole fact source. See [docs/architecture/11_DECISIONS.md](../architecture/11_DECISIONS.md) for the full ADR.
