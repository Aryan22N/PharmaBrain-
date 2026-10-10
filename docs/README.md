# Single-Hospital-Pro Documentation Directory

Welcome to the documentation suite for **Single-Hospital-Pro** — a clinical prescription intelligence system that converts prescription photographs into structured, human-verified patient medical records.

The documentation is organized into domain-specific module directories for enhanced clarity and modular navigation:

---

## 📁 Documentation Modules

| Module Directory | Topic | Key Documents |
|---|---|---|
| [**`architecture/`**](architecture/README.md) | High-level system design & decisions | • [01_PROJECT_BRIEF.md](architecture/01_PROJECT_BRIEF.md)<br>• [02_ARCHITECTURE.md](architecture/02_ARCHITECTURE.md)<br>• [11_DECISIONS.md](architecture/11_DECISIONS.md)<br>• [12_ROADMAP.md](architecture/12_ROADMAP.md)<br>• [GLOSSARY.md](architecture/GLOSSARY.md) |
| [**`ocr/`**](ocr/README.md) | Computer vision & text extraction | • [14_OCR_DOCUMENTATION.md](ocr/14_OCR_DOCUMENTATION.md) |
| [**`model/`**](model/README.md) | AI models, prompts & drug database | • [06_MEDICINE_KNOWLEDGE_BASE.md](model/06_MEDICINE_KNOWLEDGE_BASE.md)<br>• [07_EVALUATION.md](model/07_EVALUATION.md)<br>• [10_PROMPT_REGISTRY.md](model/10_PROMPT_REGISTRY.md) |
| [**`pipeline/`**](pipeline/README.md) | Prescription extraction pipeline & timeline AI | • [03_PIPELINE_SPEC.md](pipeline/03_PIPELINE_SPEC.md)<br>• [15_MEDICAL_TIMELINE_AND_AI_ANALYSIS.md](pipeline/15_MEDICAL_TIMELINE_AND_AI_ANALYSIS.md) |
| [**`api-data/`**](api-data/README.md) | Schemas, ORM & REST APIs | • [04_DATA_MODEL.md](api-data/04_DATA_MODEL.md)<br>• [05_API_SPEC.md](api-data/05_API_SPEC.md) |
| [**`operations/`**](operations/README.md) | Operations, runbook & security | • [08_SECURITY_PRIVACY.md](operations/08_SECURITY_PRIVACY.md)<br>• [09_RUNBOOK.md](operations/09_RUNBOOK.md)<br>• [13_KNOWN_ISSUES.md](operations/13_KNOWN_ISSUES.md) |

---

## 🗺 Documentation Map

```
docs/
├── README.md                      # Main Docs Portal (This File)
├── architecture/                  # System Architecture & Core Concepts
│   ├── README.md
│   ├── 01_PROJECT_BRIEF.md
│   ├── 02_ARCHITECTURE.md
│   ├── 11_DECISIONS.md
│   ├── 12_ROADMAP.md
│   └── GLOSSARY.md
├── ocr/                           # Vision & OCR Engine
│   ├── README.md
│   └── 14_OCR_DOCUMENTATION.md
├── model/                         # AI LLM, Prompts, Knowledge Base & Evaluation
│   ├── README.md
│   ├── 06_MEDICINE_KNOWLEDGE_BASE.md
│   ├── 07_EVALUATION.md
│   └── 10_PROMPT_REGISTRY.md
├── pipeline/                      # Extraction Pipeline Specification
│   ├── README.md
│   ├── 03_PIPELINE_SPEC.md
│   └── 15_MEDICAL_TIMELINE_AND_AI_ANALYSIS.md
├── api-data/                      # Database Schemas & REST APIs
│   ├── README.md
│   ├── 04_DATA_MODEL.md
│   └── 05_API_SPEC.md
└── operations/                    # Runbook, Security, Privacy & Issues
    ├── README.md
    ├── 08_SECURITY_PRIVACY.md
    ├── 09_RUNBOOK.md
    └── 13_KNOWN_ISSUES.md
```
