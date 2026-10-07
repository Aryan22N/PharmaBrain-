---
Title: Glossary
Purpose: Plain-language definitions for every acronym and domain term used in this project
Last verified against code: 2026-10-07
Code version: no git
Owner: TBD
---

# Glossary

| Term | Definition |
|---|---|
| **ATC code** | Anatomical Therapeutic Chemical classification code — WHO standard for classifying drugs by the organ system they act on and their pharmacological properties. |
| **autocontrast** | PIL image operation that stretches the brightness histogram so the darkest pixels become black and the brightest become white. Used in preprocessing to enhance faded ink. |
| **BCrypt** | Password hashing algorithm with a configurable cost factor. Used in this project at factor 10 (`frontend/lib/auth.ts`). |
| **bounding box** | The rectangle `[x0, y0, x1, y1]` that surrounds a detected word or text region in an image. |
| **bp** | Blood pressure. Stored in `observations.kind = "bp"` with `systolic` and `diastolic` columns. |
| **CDSCO** | Central Drugs Standard Control Organisation — the national regulatory authority for drugs and medical devices in India. A source of official medicine lists. |
| **CER** | Character Error Rate — `(substitutions + deletions + insertions) / total_chars`. Measures OCR text accuracy. Lower is better. |
| **confirmed_prescriptions** | The PostgreSQL table storing final clinician-approved prescription records. These are the authoritative patient history records. |
| **CORS** | Cross-Origin Resource Sharing — browser security mechanism restricting which websites can call an API. |
| **dev token** | The hardcoded development API token `rx_local_dev_token_2026_secure`. Must not be used in production. |
| **DPDPA 2023** | Digital Personal Data Protection Act, 2023 — India's primary data protection legislation governing how personal data (including health data) is collected, stored, and processed. |
| **duplicate** | In this system: the same prescription image uploaded again for the same patient. Detected by SHA-256 hash match. Returns `duplicate: true` without re-processing. |
| **EXIF** | Exchangeable Image File Format — metadata embedded in JPEG images from cameras, including orientation. `ImageOps.exif_transpose()` corrects orientation from EXIF data. |
| **extraction** | One row in the `extractions` table — the LLM-structured draft prescription awaiting human confirmation. Status: `PENDING_USER_CONFIRMATION`, `CONFIRMED`, or `DISCARDED`. |
| **extractions** | The PostgreSQL table storing LLM draft extractions and quality gate results before human confirmation. |
| **F1 score** | `2 × Precision × Recall / (Precision + Recall)` — a combined measure of extraction accuracy. |
| **FastAPI** | Python web framework for building REST APIs. Used for the Python OCR and LLM service. |
| **FBS** | Fasting Blood Sugar — blood glucose measured after fasting. Stored as `kind="sugar_fasting"`. |
| **fuzzy match** | Approximate string matching that tolerates minor differences (spelling errors, OCR confusions). In this project: RapidFuzz `fuzz.ratio` scorer with threshold ≥ 85. |
| **gate** | Short for "quality gate" — the automated assessment that assigns one of `HIGH_CONFIDENCE`, `NEEDS_CHECK`, or `LOW_QUALITY` to each extraction. |
| **Gemini** | Google's multimodal large language model family. Used in this project via the `google-genai` SDK. |
| **HIPAA** | Health Insurance Portability and Accountability Act — US federal law regulating health data. Not directly applicable in India, but referenced in old docs as a general privacy standard. |
| **human-in-the-loop** | Design principle that requires a human to review and approve automated system output before it is committed. Implemented via the `PENDING_USER_CONFIRMATION` status. |
| **IUPAC** | International Union of Pure and Applied Chemistry — the body that defines standard chemical nomenclature for drug active ingredients. |
| **Jan Aushadhi** | Pradhan Mantri Bhartiya Janaushadhi Pariyojana — Indian government programme selling generic medicines at reduced prices. Their product list is a candidate data source for the medicine database. |
| **JWT** | JSON Web Token — a signed, self-contained token used to authenticate user sessions. Stored in HTTP cookies in this project. Expires in 7 days. |
| **LLM** | Large Language Model — an AI model (like Google Gemini) that can understand and generate text and structured data. Used in this project for clinical entity extraction. |
| **load_med_index** | Python function that loads `medicine_master` from the database into an in-memory dict (`MED_INDEX`) in a background thread at startup. |
| **LMWH** | Low Molecular Weight Heparin — anticoagulant drug. Listed in the starter set as `hmw`. |
| **mask_pii** | Python function that replaces email addresses and phone numbers in OCR text with `[EMAIL]` and `[PHONE]` before the text is sent to the Gemini API. |
| **MED_INDEX** | In-memory Python dict mapping lowercase drug names (brand and generic) to their `medicine_master` row data. Built by `load_med_index()`. |
| **medicine_master** | The PostgreSQL table containing the drug knowledge base. Used for medicine name verification and lookup. |
| **MKL-DNN** | Intel Math Kernel Library for Deep Neural Networks — a performance library included in PaddlePaddle. Disabled in this project due to a bug in PaddlePaddle 3.x. |
| **MR No** | Medical Record Number — a unique identifier assigned to a patient in a hospital (equivalent to UHID). |
| **near match** | A medicine lookup result where RapidFuzz similarity is ≥ 85% but not 100%. Near matches are flagged for human review and are never auto-accepted. |
| **Next.js** | React-based web framework supporting server-side rendering and serverless API routes. Used for the frontend. |
| **NKDA** | No Known Drug Allergies — clinical notation used in prescriptions. |
| **NLEM** | National List of Essential Medicines — a list of medicines considered essential for healthcare in India, published by the Ministry of Health. |
| **observations** | The PostgreSQL table storing numeric vital sign time-series rows (BP, sugar, pulse, etc.) extracted at confirmation time. |
| **OCR** | Optical Character Recognition — software that converts an image of text into machine-readable characters. |
| **OCR_LOCK** | A `threading.Lock` that serialises all PaddleOCR calls. PaddleOCR is not thread-safe; only one inference runs at a time. |
| **PaddleOCR** | An open-source OCR engine built on the PaddlePaddle deep learning framework. Used for text detection and recognition in this project. |
| **PaddleOCR-VL** | A visual-language variant of PaddleOCR with different input/output API. Selectable via `OCR_ENGINE_TYPE=PaddleOCR-VL`. |
| **PaddlePaddle** | The deep learning framework developed by Baidu, on which PaddleOCR is built. |
| **patient_id** | In this system: the 9-digit non-sequential numeric ID assigned to each patient at registration (e.g. `483027156`). Also called UHID in some parts of the codebase. |
| **PENDING_USER_CONFIRMATION** | The initial status of every extraction. The record is not committed to patient history until a clinician explicitly confirms it. |
| **pg** | `pg` npm package — PostgreSQL client for Node.js. Used in `frontend/lib/db.ts`. |
| **pg_trgm** | PostgreSQL trigram extension — enables fast similarity-based text search using GIN/GiST indexes. Planned for medicine matching. |
| **pgvector** | PostgreSQL extension for vector (embedding) similarity search. Planned as a fallback for medicine matching. |
| **PII** | Personally Identifiable Information — data that can identify a specific individual. In this project: patient names, UHID, emails, phone numbers. |
| **PIR** | Program IR — PaddlePaddle's intermediate representation compiler. Disabled in this project due to bugs (`FLAGS_enable_pir_api=0`). |
| **Pydantic** | Python data validation library. Used to define the `Prescription`, `Medicine`, `Val` schemas and enforce schema-constrained JSON output from Gemini. |
| **quality gate** | See `gate`. |
| **rapidfuzz** | Python library for fast string similarity using various fuzzy matching algorithms. Used in `lookup_medicine()` with `fuzz.ratio`. |
| **raw_ocr** | The PostgreSQL table storing the raw PaddleOCR line extraction output, before any LLM processing. |
| **RBS** | Random Blood Sugar — blood glucose measured at a random time. Stored as `kind="sugar_random"`. |
| **RLS** | Row-Level Security — a PostgreSQL feature that restricts which rows a database user can see. Enabled in Supabase. |
| **RxNorm** | A US NLM standardised nomenclature for clinical drugs. A candidate data source for the medicine database. |
| **SHA-256** | Secure Hash Algorithm — produces a 256-bit fingerprint of data. Used to deduplicate prescription image uploads. |
| **SpO2** | Peripheral oxygen saturation — measured by pulse oximetry, expressed as a percentage. Stored as `kind="spo2"`. |
| **src** | In the `Val` Pydantic model: the list of OCR line IDs (e.g. `["L04", "L05"]`) that the field value was sourced from. Enables traceability from extracted field back to the original image line. |
| **SQLAlchemy** | Python SQL toolkit and ORM (only Core is used in this project — no ORM layer). |
| **SQLite** | A file-based SQL database. Supported as a fallback when `DATABASE_URL=sqlite:///path`. |
| **starter seed** | The 27 drug entries hardcoded in the `STARTER` list, seeded into `medicine_master` on first startup if the table is empty. Not suitable for production use alone. |
| **Supabase** | Open-source Firebase alternative providing PostgreSQL database hosting, storage, and authentication. Used as the production database in this project. |
| **TLS** | Transport Layer Security — cryptographic protocol for encrypted network communication. Required for production deployments to protect patient data in transit. |
| **UHID** | Unique Health Identifier / Unique Hospital ID — the identifier assigned to a patient in a hospital system. Used interchangeably with `patient_id` in this codebase. |
| **unwarping** | Perspective correction for curved or photographed prescription pages. Controlled by `USE_UNWARPING = False` — not implemented yet. |
| **UNVERIFIED** | A label in this documentation set meaning: a claim that could not be confirmed by reading the current code. These items need owner verification. |
| **Val** | Pydantic model class representing a single extracted field value with its source OCR line IDs. |
| **verified** | In this system: a medicine lookup result where the name exactly matched a record in `medicine_master`. `db.verified = true`. |
| **vitals** | Numeric clinical measurements: blood pressure, blood sugar, pulse rate, temperature, SpO2, weight. Extracted at confirmation and stored in `observations`. |
