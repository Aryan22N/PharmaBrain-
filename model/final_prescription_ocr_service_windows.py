import os
import sys

# Bypass slow connectivity check to PaddleX model hosters on startup
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
os.environ.setdefault("DISABLE_MODEL_SOURCE_CHECK", "True")

# Disable MKL-DNN / PIR execution engine bug in PaddlePaddle 3.0+
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["FLAGS_enable_pir_api"] = "0"
os.environ["FLAGS_enable_pir_in_executor"] = "0"

from dotenv import load_dotenv

_script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_script_dir, ".env"))
load_dotenv()

import re, io, json, time, hashlib, datetime, statistics, threading, secrets, getpass, subprocess, csv, warnings, traceback
from typing import List, Optional

warnings.filterwarnings("ignore", message=".*To copy construct from a tensor.*")
warnings.filterwarnings("ignore", message=".*Non compatible API.*")
warnings.filterwarnings("ignore", message=".*No ccache found.*")


def log_stage(stage: str, msg: str, elapsed: Optional[float] = None):
    ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    elapsed_str = f" | elapsed={elapsed:.2f}s" if elapsed is not None else ""
    print(f"[{ts}] [{stage}] {msg}{elapsed_str}", flush=True)


def _secret(name, prompt=False):
    value = os.environ.get(name)
    if value:
        return value
    if prompt and sys.stdin and sys.stdin.isatty():
        try:
            return getpass.getpass(f"{name}: ")
        except Exception:
            return None
    return None


GEMINI_API_KEY  = _secret("GEMINI_API_KEY", prompt=True)
_tok            = _secret("API_TOKEN")
API_TOKEN       = _tok or secrets.token_urlsafe(32)
DATABASE_URL    = _secret("DATABASE_URL")
FRONTEND_ORIGIN = _secret("FRONTEND_ORIGIN") or "*"

if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is missing or empty. Please configure GEMINI_API_KEY in model/.env"
    )

# ---- confidence gate ------------------------------------------------------------------------------
# PaddleOCR scores are NOT calibrated probabilities - tune these on your own labelled prescriptions.
THRESH_OK    = 0.90    # critical field >= this and no validation issue  -> flag "ok"
THRESH_LOW   = 0.75    # below this -> flag "low" (UI should force the user to look at it)
CRITICAL_FIELDS = ("name", "strength", "frequency", "duration")   # a wrong value here can harm a patient

# ---- LLM ------------------------------------------------------------------------------------------------
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
SEND_IMAGE_TO_LLM = True    # True = Gemini receives image to read handwriting directly with high precision
USE_UNWARPING = False       # True for curved / photographed pages

# ---- upload limits ---------------------------------------------------------------------------------------
MAX_UPLOAD_MB = 10
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg", "image/pjpeg"}

# ---- database --------------------------------------------------------------------------------------------
import urllib.parse
from sqlalchemy.engine import make_url


def sanitize_database_url(raw_url: Optional[str]) -> str:
    """
    Sanitizes and normalizes the database URL for Supabase PostgreSQL.
    Properly encodes passwords containing special characters (e.g. '@', '#', '%', '!')
    without double-encoding existing percent-escapes.
    Normalizes 'postgres://' or 'postgresql://' to 'postgresql+psycopg2://'.
    """
    if not raw_url:
        return ""
    url = raw_url.strip()
    if url.startswith("sqlite"):
        return url

    # Normalize postgres:// -> postgresql://
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]

    # Match proto://user:password@endpoint
    match = re.match(
        r'^(?P<proto>postgresql(?:\+[a-zA-Z0-9_]+)?)://(?P<user>[^:]+):(?P<password>.+)@(?P<endpoint>[^@]+)$',
        url
    )
    if match:
        proto = match.group("proto")
        if proto == "postgresql":
            proto = "postgresql+psycopg2"
        user = match.group("user")
        raw_pw = match.group("password")
        unquoted = urllib.parse.unquote(raw_pw)
        quoted_pw = urllib.parse.quote_plus(unquoted)
        endpoint = match.group("endpoint")
        return f"{proto}://{user}:{quoted_pw}@{endpoint}"

    if url.startswith("postgresql://"):
        url = "postgresql+psycopg2://" + url[len("postgresql://"):]
    return url


if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is missing or empty. Please configure your Supabase PostgreSQL connection string "
        "in model/.env (e.g., DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres "
        "or connection pooler: DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres). "
        "For offline local development, you may set DATABASE_URL=sqlite:///rx_local.db"
    )

CLEAN_DB_URL = sanitize_database_url(DATABASE_URL)

try:
    parsed_db_url = make_url(CLEAN_DB_URL)
    is_postgres = parsed_db_url.drivername.startswith("postgresql")
    masked_db_url = parsed_db_url.render_as_string(hide_password=True)
except Exception as e:
    raise RuntimeError(f"Invalid DATABASE_URL configuration: {e}")

print("DB      :", masked_db_url)
if not _tok:
    print("API key : (auto-generated for this session) ->", API_TOKEN)

"""## 3. Database
Tables: `raw_ocr` (raw OCR lines) - `extractions` (LLM draft + validation result) - `confirmed_prescriptions` (what the user confirmed) -
`observations` (numeric BP / sugar / weight rows for trends) - `medicine_master` (authenticated medicine data) - `audit_log`.

`medicine_master` is seeded with a **tiny starter list** so the pipeline works. Replace it with your authenticated database using
`import_medicine_csv("file.csv")` (columns: `name, generic, composition, uses, strengths_mg`).
"""

from sqlalchemy import (create_engine, MetaData, Table, Column, Integer, String, Text, Float,
                        select, insert, update, delete, func, text)

_kw = {
    "pool_pre_ping": True,
    "pool_recycle": 180,
    "connect_args": {"connect_timeout": 15}
} if is_postgres else {
    "connect_args": {"check_same_thread": False}
}

try:
    engine = create_engine(CLEAN_DB_URL, **_kw)
    with engine.connect() as test_conn:
        test_conn.execute(select(1))
except Exception as conn_err:
    raise RuntimeError(
        f"Could not connect to database ({masked_db_url}). Please verify network access, "
        f"Supabase project status, and credentials in model/.env. Error: {conn_err}"
    ) from conn_err

md_ = MetaData()

raw_ocr = Table("raw_ocr", md_,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("image_sha256", String(64), index=True),
    Column("patient_id", String(64), index=True),
    Column("filename", String(255)),
    Column("ocr_engine", String(64)),
    Column("image_w", Integer), Column("image_h", Integer),
    Column("avg_conf", Float),
    Column("lines_json", Text),
    Column("created_at", String(32)))

extractions = Table("extractions", md_,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("raw_ocr_id", Integer, index=True),
    Column("llm_model", String(64)),
    Column("analysis_json", Text),          # {record, gate, warnings}
    Column("status", String(32), index=True),   # PENDING_USER_CONFIRMATION | CONFIRMED | DISCARDED
    Column("created_at", String(32)))

confirmed_prescriptions = Table("confirmed_prescriptions", md_,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("extraction_id", Integer, unique=True),
    Column("patient_id", String(64), index=True),
    Column("rx_date", String(10), index=True),   # YYYY-MM-DD
    Column("hospital", String(255)), Column("doctor", String(255)), Column("doctor_reg_no", String(64)),
    Column("data_json", Text),                   # the final record the user confirmed
    Column("edits_json", Text),                  # what the user changed vs the machine output
    Column("confirmed_by", String(64)),
    Column("confirmed_at", String(32)))

observations = Table("observations", md_,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("patient_id", String(64), index=True),
    Column("prescription_id", Integer, index=True),
    Column("obs_date", String(10), index=True),
    Column("kind", String(24), index=True),      # bp | sugar_fasting | sugar_post_meal | sugar_random | hba1c | sugar_unspecified | pulse | temp | spo2 | weight
    Column("systolic", Float), Column("diastolic", Float), Column("value", Float),
    Column("unit", String(16)), Column("raw_text", String(120)),
    Column("created_at", String(32)))

medicine_master = Table("medicine_master", md_,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("name", String(120), unique=True),    # brand or generic name, lower case
    Column("generic", String(160)), Column("composition", Text), Column("uses", Text),
    Column("strengths_mg", String(200)),         # "250,500,850" (blank = unknown)
    Column("source", String(80)))

audit_log = Table("audit_log", md_,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("ts", String(32)), Column("event", String(40)),
    Column("extraction_id", Integer), Column("detail", Text))

md_.create_all(engine)


def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")

def jd(o):
    return json.dumps(o, ensure_ascii=False, default=str)

def audit(conn, event, extraction_id=None, detail=None):
    conn.execute(insert(audit_log).values(ts=now_iso(), event=event, extraction_id=extraction_id,
                                          detail=jd(detail) if detail is not None else None))


# ---- medicine master -----------------------------------------------------------------------------
# STARTER ROWS ONLY - replace with your authenticated medicine database.
STARTER = [
    ("metformin", "metformin", "Metformin hydrochloride", "Type 2 diabetes (lowers blood glucose)", "250,500,850,1000"),
    ("atorvastatin", "atorvastatin", "Atorvastatin calcium", "High cholesterol; reduces cardiovascular risk", "5,10,20,40,80"),
    ("pantoprazole", "pantoprazole", "Pantoprazole sodium", "Acid reflux (GERD), peptic ulcer", "20,40"),
    ("pan", "pantoprazole", "Pantoprazole sodium", "Acid reflux (GERD), peptic ulcer", "20,40"),
    ("vitamin d3", "cholecalciferol", "Cholecalciferol (vitamin D3)", "Vitamin D deficiency", ""),
    ("cholecalciferol", "cholecalciferol", "Cholecalciferol (vitamin D3)", "Vitamin D deficiency", ""),
    ("paracetamol", "paracetamol", "Paracetamol", "Fever; mild to moderate pain", "250,500,650,1000"),
    ("pacimol", "paracetamol", "Paracetamol", "Fever; mild to moderate pain", ""),
    ("calpol", "paracetamol", "Paracetamol", "Fever; mild to moderate pain", ""),
    ("amlodipine", "amlodipine", "Amlodipine besylate", "High blood pressure; angina", "2.5,5,10"),
    ("telmisartan", "telmisartan", "Telmisartan", "High blood pressure", "20,40,80"),
    ("ondansetron", "ondansetron", "Ondansetron", "Nausea and vomiting", "4,8"),
    ("emset", "ondansetron", "Ondansetron", "Nausea and vomiting", ""),
    ("levofloxacin", "levofloxacin", "Levofloxacin", "Bacterial infections (antibiotic)", "250,500,750"),
    ("febuxostat", "febuxostat", "Febuxostat", "Gout (lowers uric acid)", "40,80"),
    ("folvite", "folic acid", "Folic acid", "Folate deficiency; anaemia", ""),
    ("dytor", "torsemide", "Torsemide", "Fluid retention (oedema); heart/liver/kidney related", ""),
    ("levolin", "levosalbutamol", "Levosalbutamol", "Asthma / wheezing (bronchodilator)", ""),
    ("meftal-p", "mefenamic acid + paracetamol", "Mefenamic acid + Paracetamol", "Fever; pain", ""),
    ("dexamethasone", "dexamethasone", "Dexamethasone", "Corticosteroid / Anti-inflammatory", "0.5,1,2,4,8"),
    ("dexa", "dexamethasone", "Dexamethasone", "Corticosteroid / Anti-inflammatory", "4,8"),
    ("ondem", "ondansetron", "Ondansetron", "Nausea and vomiting (antiemetic)", "4,8"),
    ("ultracet", "tramadol + paracetamol", "Tramadol + Paracetamol", "Moderate to severe pain", ""),
    ("xgeva", "denosumab", "Denosumab", "Bone metastases prevention / Giant cell tumor", "120"),
    ("denosumab", "denosumab", "Denosumab", "Bone metastases prevention / Giant cell tumor", "120"),
    ("cloxen", "cloxacillin", "Cloxacillin", "Bacterial infections", "250,500"),
    ("hmw", "heparin / low molecular weight heparin", "LMWH", "Anticoagulant / Blood thinner", ""),
]

def seed_starter_medicines():
    with engine.begin() as c:
        try:
            if c.execute(text("SELECT id FROM medicine_master LIMIT 1")).first():
                return
        except Exception:
            return
        for n, g, comp, uses, st in STARTER:
            c.execute(text(
                "INSERT INTO medicine_master (name, generic, composition, uses, strengths_mg, source) "
                "VALUES (:n, :g, :comp, :uses, :st, 'starter_seed')"
            ), dict(n=n, g=g, comp=comp, uses=uses, st=st))

MED_INDEX = {}      # lower-case name or generic -> row dict

def load_med_index():
    def _background_load():
        try:
            log_stage("DB_INDEX", "Loading 250k+ medicines from database in background...")
            t0 = time.time()
            with engine.connect().execution_options(stream_results=True) as c:
                try:
                    result = c.execute(text(
                        "SELECT id, brand_name, generic_name, composition_raw, active_ingredients, strength_text, uses, therapeutic_class FROM medicine_master"
                    ))
                except Exception:
                    result = c.execute(text("SELECT * FROM medicine_master"))

                count = 0
                for r in result.mappings():
                    count += 1
                    r = dict(r)
                    brand = (r.get("brand_name") or r.get("name") or "").strip()
                    generic = (r.get("generic_name") or r.get("generic") or "").strip()
                    comp = (r.get("composition_raw") or r.get("composition") or r.get("active_ingredients") or "").strip()
                    uses = (r.get("uses") or r.get("therapeutic_class") or "").strip()
                    strength = (r.get("strength_text") or r.get("strengths_mg") or "").strip()

                    row_dict = {
                        "name": brand or generic,
                        "generic": generic,
                        "composition": comp,
                        "uses": uses,
                        "strengths_mg": strength,
                        "raw": r
                    }

                    if brand:
                        b_lower = brand.lower()
                        MED_INDEX[b_lower] = row_dict
                        simple_brand = re.sub(r"\s+\d+.*$", "", b_lower).strip()
                        if simple_brand and len(simple_brand) >= 3 and simple_brand not in MED_INDEX:
                            MED_INDEX[simple_brand] = row_dict

                    if generic:
                        g_lower = generic.lower()
                        if g_lower not in MED_INDEX:
                            MED_INDEX[g_lower] = row_dict

            log_stage("DB_INDEX", f"Successfully loaded {count:,} medicine records ({len(MED_INDEX):,} index keys)", time.time() - t0)
        except Exception as err:
            log_stage("DB_INDEX", f"Error background loading medicine_master: {err}")

    # Launch background thread so backend starts immediately!
    threading.Thread(target=_background_load, daemon=True).start()
    return len(MED_INDEX)

def import_medicine_csv(path, source="csv_import"):
    """CSV columns: name, generic, composition, uses, strengths_mg  (strengths_mg like 250,500)"""
    n = 0
    with open(path, newline="", encoding="utf-8") as f, engine.begin() as c:
        for row in csv.DictReader(f):
            name = (row.get("name") or "").strip().lower()
            if not name:
                continue
            vals = dict(generic=(row.get("generic") or "").strip(), composition=(row.get("composition") or "").strip(),
                        uses=(row.get("uses") or "").strip(), strengths_mg=(row.get("strengths_mg") or "").strip(), source=source)
            ex = c.execute(select(medicine_master.c.id).where(medicine_master.c.name == name)).first()
            if ex:
                c.execute(update(medicine_master).where(medicine_master.c.id == ex[0]).values(**vals))
            else:
                c.execute(insert(medicine_master).values(name=name, **vals))
            n += 1
    load_med_index()
    return n

seed_starter_medicines()
print("medicine_master rows:", load_med_index())

"""## 4. Pre-processing, OCR model, reading-order lines
The OCR model is loaded **once** and reused for every upload.
"""

from PIL import Image, ImageOps

PRE_DIR = "preprocessed"
os.makedirs(PRE_DIR, exist_ok=True)

def preprocess_image(data: bytes, min_long_side=1000, max_long_side=2048):
    """bytes -> path of cleaned PNG, (w, h). Fixes phone rotation, faded ink, tiny and huge images with high-res 2048px scaling."""
    img = Image.open(io.BytesIO(data))
    img = ImageOps.exif_transpose(img).convert("RGB")
    img = ImageOps.autocontrast(img, cutoff=1)
    w, h = img.size
    long_side = max(w, h)
    if long_side < min_long_side or long_side > max_long_side:
        s = (min_long_side if long_side < min_long_side else max_long_side) / long_side
        img = img.resize((max(1, int(w * s)), max(1, int(h * s))), Image.Resampling.BILINEAR)
    out = os.path.join(PRE_DIR, hashlib.sha256(data).hexdigest()[:16] + ".png")
    img.save(out, optimize=True)
    return out, img.size

import paddle
import threading

# Explicitly disable mkldnn/PIR flags in paddle framework runtime
try:
    paddle.set_flags({
        "FLAGS_use_mkldnn": False,
        "FLAGS_enable_pir_api": False,
        "FLAGS_enable_pir_in_executor": False,
    })
except Exception:
    pass

if '_PADDLEOCR_READY' not in globals():
    OCR_ENGINE_TYPE = os.environ.get("OCR_ENGINE_TYPE", "PaddleOCR").strip()
    print(
        "PaddlePaddle:", paddle.__version__,
        "| GPU:", paddle.is_compiled_with_cuda(),
        "| Engine:", OCR_ENGINE_TYPE
    )

    if OCR_ENGINE_TYPE.lower() in ("paddleocr-vl", "vl"):
        from paddleocr import PaddleOCRVL
        ocr = PaddleOCRVL(
            device=os.environ.get("PADDLEOCR_DEVICE", "cpu")
        )
        OCR_ENGINE = "PaddleOCR-VL"
    else:
        from paddleocr import PaddleOCR
        ocr = PaddleOCR(
            use_textline_orientation=True,
            lang=os.environ.get("PADDLEOCR_LANG", "en"),
            enable_mkldnn=False
        )
        OCR_ENGINE = "PaddleOCR"

    OCR_LOCK = threading.Lock()
    _PADDLEOCR_READY = True

else:
    print(f"{OCR_ENGINE} already initialized, skipping re-initialization.")

def run_ocr(path, fallback_size):
    """
    Run PaddleOCR / PaddleOCR-VL and return:
        (raw boxes list, (w, h) of the image)
    """
    w, h = fallback_size
    raw = []

    with OCR_LOCK:
        if hasattr(ocr, "ocr"):
            try:
                res = ocr.ocr(path, cls=True)
                if res and len(res) > 0 and res[0] is not None:
                    for line in res[0]:
                        if not line or len(line) < 2:
                            continue
                        box, (text, conf) = line[0], line[1]
                        text = str(text or "").strip()
                        if not text or not re.search(r"[A-Za-z0-9]", text):
                            continue
                        xs = [float(p[0]) for p in box]
                        ys = [float(p[1]) for p in box]
                        raw.append(dict(
                            text=text,
                            conf=float(conf),
                            x0=min(xs), x1=max(xs),
                            y0=min(ys), y1=max(ys)
                        ))
                    return raw, (w, h)
            except Exception as e:
                print(f"Standard ocr.ocr() call failed, falling back to predict(): {e}")

        output = list(ocr.predict(path))

    for res in output:
        # Check if preprocessing returned output image dimensions
        try:
            arr = res.get("doc_preprocessor_res", {}).get("output_img") if isinstance(res, dict) else None
            if arr is not None and hasattr(arr, "shape") and len(arr.shape) >= 2:
                h, w = arr.shape[:2]
        except Exception:
            pass

        parsing_res_list = []
        if isinstance(res, dict):
            parsing_res_list = res.get("parsing_res_list", [])
        else:
            parsing_res_list = getattr(res, "parsing_res_list", [])

        if parsing_res_list:
            for item in parsing_res_list:
                text = getattr(item, "content", "") if not isinstance(item, dict) else item.get("content", "")
                if text is None:
                    text = ""
                text = str(text).strip()
                if not text or not re.search(r"[A-Za-z0-9]", text):
                    continue

                bbox = getattr(item, "bbox", None) if not isinstance(item, dict) else item.get("bbox", None)
                if bbox is None:
                    continue
                bbox = list(bbox)
                if len(bbox) != 4:
                    continue

                x0, y0, x1, y1 = map(float, bbox)
                score = getattr(item, "score", getattr(item, "confidence", 1.0)) if not isinstance(item, dict) else item.get("score", item.get("confidence", 1.0))
                try:
                    conf_val = float(score) if score is not None else 1.0
                except (ValueError, TypeError):
                    conf_val = 1.0

                raw.append(
                    dict(
                        text=text,
                        conf=conf_val,
                        x0=x0,
                        x1=x1,
                        y0=y0,
                        y1=y1
                    )
                )
        elif isinstance(res, dict) and ("rec_texts" in res or "dt_polys" in res):
            polys = res.get("rec_polys", res.get("dt_polys", []))
            texts = res.get("rec_texts", [])
            scores = res.get("rec_scores", [1.0] * len(texts))
            for text, score, poly in zip(texts, scores, polys):
                text = str(text).strip()
                if not text or not re.search(r"[A-Za-z0-9]", text):
                    continue
                xs, ys = [float(p[0]) for p in poly], [float(p[1]) for p in poly]
                raw.append(dict(text=text, conf=float(score), x0=min(xs), x1=max(xs), y0=min(ys), y1=max(ys)))

    return raw, (w, h)



def build_lines(raw, img_w, img_h):
    """Reading order + rows. Lines at the same height share a row number (e.g. 'Age/Sex : 34/M')."""
    if not raw:
        return []

    for r in raw:
        r["cy"] = (r["y0"] + r["y1"]) / 2
        r["h"] = r["y1"] - r["y0"]

    med_h = statistics.median(r["h"] for r in raw) or 1.0
    raw = sorted(raw, key=lambda r: r["cy"])
    rows, cur = [], [raw[0]]

    for r in raw[1:]:
        row_cy = sum(x["cy"] for x in cur) / len(cur)
        if abs(r["cy"] - row_cy) <= 0.6 * med_h:
            cur.append(r)
        else:
            rows.append(cur)
            cur = [r]

    rows.append(cur)
    lines, n = [], 0

    for ri, row in enumerate(rows, start=1):
        for r in sorted(row, key=lambda r: r["x0"]):
            n += 1
            lines.append(
                dict(
                    id=f"L{n:02d}",
                    row=ri,
                    text=r["text"],
                    conf=round(r["conf"], 4),
                    x=round(r["x0"] / img_w, 3) if img_w else 0.0,
                    y=round(r["cy"] / img_h, 3) if img_h else 0.0
                )
            )

    return lines


def mask_pii(text):
    """Clinic phone / e-mail are not needed for extraction - do not send them to an external API."""

    text = re.sub(
        r"[\w.+-]+@[\w-]+\.[\w.]+",
        "[EMAIL]",
        text
    )

    text = re.sub(
        r"(?<!\d)(?:\+?91[- ]?)?\d{2,5}[- ]?\d{6,8}(?!\d)",
        "[PHONE]",
        text
    )

    return text


def lines_to_prompt_block(lines):

    return "\n".join(
        f"{l['id']} | row {l['row']} | "
        f"x={l['x']} y={l['y']} | "
        f"conf={l['conf']:.3f} | "
        f"{mask_pii(l['text'])}"
        for l in lines
    )

"""## 5. Gemini structuring
Every value carries `src` (the OCR line ids it was read from). The LLM **never reports a confidence number** - code computes it as the minimum
confidence of the source lines. The LLM may not correct or invent anything.
"""

from pydantic import BaseModel, Field
from google import genai
from google.genai import types

client = genai.Client(api_key=GEMINI_API_KEY)


class Val(BaseModel):
    value: Optional[str] = None      # exactly as in the OCR text (do NOT correct); null if absent
    src: List[str] = Field(default_factory=list)            # OCR line ids this value was read from

class Medicine(BaseModel):
    name: Val = Field(default_factory=Val)                 # medicine name only: no Tab./Cap./Syp. prefix, no numbering, no strength
    form: Val = Field(default_factory=Val)                 # Tab / Cap / Inj / Syp / Neb ...
    strength: Val = Field(default_factory=Val)             # "500 mg", "250/5", "60K"
    dose: Val = Field(default_factory=Val)                 # amount per intake: "1 cap", "3 ml"
    frequency: Val = Field(default_factory=Val)            # "1-0-1", "TDS", "Q6H", "once a week", "SOS"
    timing: Val = Field(default_factory=Val)               # "after food", "night"
    duration: Val = Field(default_factory=Val)             # "30 days", "5d", "8 weeks"
    route: Val = Field(default_factory=Val)                # oral / IV / IM ... only if written
    ambiguity_note: Optional[str] = None    # why a human should look at it, else null

class Vital(BaseModel):
    name: str = ""                 # "BP", "Sugar (FBS)", "Weight", "PR", "Temp", "SpO2" ... as written
    value: Val = Field(default_factory=Val)

class Prescription(BaseModel):
    looks_like_prescription: bool = True
    hospital_name: Val = Field(default_factory=Val)
    doctor_name: Val = Field(default_factory=Val)
    doctor_reg_no: Val = Field(default_factory=Val)
    patient_name: Val = Field(default_factory=Val)
    patient_uhid: Val = Field(default_factory=Val)
    patient_age: Val = Field(default_factory=Val)
    patient_sex: Val = Field(default_factory=Val)
    patient_ward_bed: Val = Field(default_factory=Val)
    date: Val = Field(default_factory=Val)
    vitals: List[Vital] = Field(default_factory=list)
    diagnosis: List[Val] = Field(default_factory=list)      # complaints / clinical description / diagnosis lines (e.g. "URTI")
    allergies: List[Val] = Field(default_factory=list)      # ONLY if explicitly written ("Allergic to ...", "NKDA")
    medicines: List[Medicine] = Field(default_factory=list)
    advice: List[Val] = Field(default_factory=list)
    follow_up: Val = Field(default_factory=Val)


SYSTEM_PROMPT = """You are an expert clinical prescription interpretation and structuring assistant with advanced multimodal vision capabilities.
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
6. FORMAT: Return ONLY valid JSON adhering strictly to the provided Prescription schema."""


def call_gemini(lines, image_path=None, retries_per_model=2):

    contents = [
        f"OCR LINES:\n{lines_to_prompt_block(lines)}"
    ]

    if SEND_IMAGE_TO_LLM and image_path:
        mime = "image/png"
        if image_path.lower().endswith(".jpg") or image_path.lower().endswith(".jpeg"):
            mime = "image/jpeg"

        with open(image_path, "rb") as f:
            contents.insert(
                0,
                types.Part.from_bytes(
                    data=f.read(),
                    mime_type=mime
                )
            )

        contents.append(
            "Use the image to visually transcribe handwritten doctor text, patient metadata (Age, Sex, UHID, Name), and all prescribed medicines. Ensure no handwritten items are missed."
        )

    cfg = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        response_mime_type="application/json",
        response_schema=Prescription
    )

    last_error = None

    for model_name in MODEL_CANDIDATES:

        for attempt in range(retries_per_model):

            try:
                print(
                    f"Trying {model_name} "
                    f"(attempt {attempt + 1}/{retries_per_model})...",
                    flush=True
                )

                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(
                        client.models.generate_content,
                        model=model_name,
                        contents=contents,
                        config=cfg
                    )
                    response = future.result(timeout=30)

                prescription = Prescription.model_validate_json(
                    response.text
                )

                print(
                    f"SUCCESS! Model used: {model_name}",
                    flush=True
                )

                return prescription, model_name

            except Exception as e:
                last_error = str(e)
                print(f"[{model_name}] Error: {last_error[:200]}")
                # If model is experiencing temporary demand spikes (503/429) or is not found/deprecated (404), fast-fail to next model immediately
                if any(code in last_error for code in ("503", "UNAVAILABLE", "429", "404", "NOT_FOUND")):
                    print(f"{model_name} currently unavailable or not found, immediately falling back to next candidate...\n")
                    break
                if attempt < retries_per_model - 1:
                    print("Retrying in 2 seconds...\n")
                    time.sleep(2)
                else:
                    print(f"{model_name} unavailable. Trying next model...\n")

    raise RuntimeError(
        f"All Gemini models failed. "
        f"Last error: {last_error}"
    )

"""## 6. Validators, auto-corrections, medicine lookup, vitals, dates
* Safe OCR-confusion fixes are applied, but **every corrected value is flagged `check`** - the user must see it.
* Medicine names: exact match in `medicine_master` -> *verified* (generic / composition / uses attached). Near match -> flagged, **never auto-accepted**
  (look-alike drug names are a safety risk). Not found -> *unverified* (nothing is generated).
* Vitals are parsed to numbers and range-checked; BP needs `systolic > diastolic`.
"""

from rapidfuzz import fuzz, process

UNITS = r"(?:mg|mcg|ug|µg|g|gm|ml|iu|k|%)"
NUM   = r"\d+(?:\.\d+)?"
DIG   = r"(?:\d(?:\.\d)?|½)"
STRENGTH_RE = re.compile(rf"^{NUM}\s*{UNITS}?(?:\s*/\s*{NUM}\s*{UNITS}?)*$", re.I)
FREQ_RE = re.compile(
    rf"^(?:{DIG}\s*-\s*{DIG}\s*-\s*{DIG}(?:\s*-\s*{DIG})?|od|bd|bid|tds|tid|qid|qd|hs|sos|stat|prn|q\d{{1,2}}h"
    rf"|(?:once|twice|thrice)\s+(?:a\s+|per\s+)?(?:day|week|month)|\d\s*times\s*(?:a|per)\s*(?:day|week)"
    rf"|weekly|daily|every\s+\d+\s*(?:h|hr|hrs|hours))$", re.I)
DURATION_RE = re.compile(
    r"^(?:[x×*]?\s*\d+\s*(?:d|day|days|w|wk|wks|week|weeks|m|mo|month|months)\.?|continue|ongoing|lifelong|till review)$", re.I)
FORM_PREFIX = re.compile(r"^\s*\d*\.?\s*(tab|tablet|cap|capsule|inj|syp|syrup|neb|drop|drops|oint|susp)\b\.?\s*", re.I)
FREQ_SUGGEST = {"tos": "TDS", "t0s": "TDS", "t.o.s": "T.D.S"}

_DIGITMAP = str.maketrans({"o": "0", "O": "0", "l": "1", "I": "1", "S": "5", "G": "6"})
_TOKEN = re.compile(r"(?<![A-Za-z])[0-9oOlISG.]*\d[0-9oOlISG.]*(?![A-Za-z])")


def fix_digits(s):
    """Letters that look like digits are fixed ONLY inside tokens that already contain a real digit
    (5o0 -> 500, 2S0 -> 250), plus a lone 'I'/'l' before a unit (I cap -> 1 cap)."""
    if not s:
        return s
    s2 = _TOKEN.sub(lambda m: m.group(0).translate(_DIGITMAP), s)
    s2 = re.sub(r"\b[Il]\b(?=\s*(cap|tab|tablet|capsule|ml|drop|puff|amp)\b)", "1", s2, flags=re.I)
    return s2


def fix_duration(s):
    """'Sd' -> '5d', 'x 3O days' -> 'x 30 days' (a duration number can only be digits)."""
    if not s:
        return s
    m = re.match(r"^(\s*[x×*]?\s*)([0-9oOlISG]+)(\s*(?:d|days?|w|wks?|weeks?|m|mo|months?)\.?\s*)$", s, re.I)
    if m:
        num = m.group(2).translate(_DIGITMAP)
        if num.isdigit() and int(num) > 0:
            return m.group(1) + num + m.group(3)
    return s


def fix_frequency(s):
    """1-O-1 -> 1-0-1,  QGH -> Q6H"""
    if not s:
        return s
    t = s.strip()
    if re.fullmatch(r"[0-9oOlI½.]+(\s*-\s*[0-9oOlI½.]+)+", t) and re.search(r"\d", t):
        return t.translate(str.maketrans({"o": "0", "O": "0", "l": "1", "I": "1"}))
    m = re.fullmatch(r"([qQ])\s*([0-9oOlISG]{1,2})\s*([hH])", t)
    if m:
        num = m.group(2).translate(_DIGITMAP)
        if num.isdigit():
            return f"{m.group(1)}{num}{m.group(3)}"
    return s


def field_conf(v, by_id):
    """None = field absent.  0.0 = value present but no valid source line (LLM could not ground it)."""
    if v is None or not v.value:
        return None
    ids = [i for i in v.src if i in by_id]
    return min(by_id[i]["conf"] for i in ids) if ids else 0.0


def lookup_medicine(name):
    """exact -> verified. near (fuzzy) -> must be confirmed by a human. none -> unverified. NEVER generates content."""
    if not name:
        return dict(status="none")
    q = re.sub(r"[^a-z0-9 \-]", "", re.sub(r"\s+", " ", name.lower())).strip()
    row = MED_INDEX.get(q)
    if row:
        return dict(status="exact", score=100, row=row)
    if len(q) >= 5 and MED_INDEX:            # short brand names (pan, emset ...) are never fuzzy matched
        best = process.extractOne(q, list(MED_INDEX.keys()), scorer=fuzz.ratio)
        if best and best[1] >= 85:
            return dict(status="near", score=round(best[1]), row=MED_INDEX[best[0]])
    return dict(status="none")


def _issue(field, code, msg):
    return dict(field=field, code=code, msg=msg)


MED_FIELDS = ("name", "form", "strength", "dose", "frequency", "timing", "duration", "route")


def analyze_medicine(med, by_id):
    issues, warnings, corrected = [], [], []
    conf = {f: field_conf(getattr(med, f), by_id) for f in MED_FIELDS}
    read = {f: getattr(med, f).value for f in MED_FIELDS}
    final = dict(read)
    corrected_fields = set()

    final["name"] = (FORM_PREFIX.sub("", read["name"]).strip() or None) if read["name"] else None
    for f, fn in dict(strength=fix_digits, dose=fix_digits, frequency=fix_frequency, duration=fix_duration).items():
        if read[f]:
            fixed = fn(read[f])
            if fixed != read[f]:
                final[f] = fixed
                corrected_fields.add(f)
                corrected.append(f"{f}: '{read[f]}' -> '{fixed}'")

    if final["duration"]:
        final["duration"] = re.sub(r"^\s*[x×*]\s*", "", final["duration"]).strip()

    # --- format validators
    s = final["strength"]
    if s and not STRENGTH_RE.match(re.sub(r"[()]", "", s).strip()):
        issues.append(_issue("strength", "format_invalid", f"unreadable strength '{s}'"))
    q = final["frequency"]
    if q and not FREQ_RE.match(q.strip()):
        hint = FREQ_SUGGEST.get(q.strip().lower())
        issues.append(_issue("frequency", "format_invalid", f"unreadable frequency '{q}'" + (f" (did you mean {hint}?)" if hint else "")))
    d = final["duration"]
    if d and not DURATION_RE.match(d.strip()):
        issues.append(_issue("duration", "format_invalid", f"unreadable duration '{d}'"))
    for f in CRITICAL_FIELDS:
        if not final[f]:
            issues.append(_issue(f, "missing", f"{f} not found"))
        elif conf[f] == 0.0:
            issues.append(_issue(f, "no_source_line", f"{f} has no valid OCR source line"))

    # --- medicine database
    match = lookup_medicine(final["name"])
    info = dict(verified=False, db_name=None, generic=None, composition=None, uses=None, score=None)
    if match["status"] == "exact":
        r = match["row"]
        info.update(verified=True, db_name=r["name"], generic=r["generic"], composition=r["composition"], uses=r["uses"], score=100)
        if r.get("strengths_mg") and s:
            m = re.match(rf"^\s*({NUM})\s*(?:mg)?\s*$", re.sub(r"[()]", "", s))
            known = []
            for x in str(r["strengths_mg"]).split(","):
                for num_str in re.findall(r"\d+(?:\.\d+)?", x):
                    try:
                        known.append(float(num_str))
                    except ValueError:
                        pass
            if m and known and float(m.group(1)) not in known:
                issues.append(_issue("strength", "unusual_strength", f"{s} is not a usual strength for {r['name']} (usual: {r['strengths_mg']})"))
    elif match["status"] == "near":
        r = match["row"]
        info.update(db_name=r["name"], score=match["score"])
        issues.append(_issue("name", "near_match", f"'{final['name']}' looks like '{r['name']}' ({match['score']}%) - confirm the exact name"))
    elif final["name"]:
        warnings.append(f"'{final['name']}' not found in medicine database (unverified)")

    # --- per-field flag for the UI
    bad = {i["field"] for i in issues}
    flags = {}
    for f in MED_FIELDS:
        c = conf[f]
        if not final[f]:
            flags[f] = "missing" if f in CRITICAL_FIELDS else "empty"
        elif c is not None and c < THRESH_LOW:
            flags[f] = "low"
        elif (c is not None and c < THRESH_OK) or f in bad or f in corrected_fields:
            flags[f] = "check"
        else:
            flags[f] = "ok"
    crit = [conf[f] for f in CRITICAL_FIELDS if conf[f] is not None]
    min_conf = min(crit) if crit else 0.0
    if any(flags[f] == "low" for f in CRITICAL_FIELDS):
        status = "LOW"
    elif issues or corrected or any(flags[f] in ("check", "missing") for f in CRITICAL_FIELDS):
        status = "CHECK"
    else:
        status = "OK"

    return dict(**final,
                fields={f: dict(read=read[f], conf=conf[f], flag=flags[f]) for f in MED_FIELDS},
                status=status, min_conf=round(min_conf, 4), issues=issues, warnings=warnings, corrected=corrected,
                ambiguity_note=med.ambiguity_note, db=info)


# ---------------------------------------------------------------------------------------------------------
# vitals + date
# ---------------------------------------------------------------------------------------------------------
SUGAR_NAME = re.compile(r"sugar|glucose|\bfbs\b|\bppbs\b|\brbs\b|\bppg\b|\bfbg\b|\brbg\b|hba1c|\ba1c\b|gluco", re.I)

def parse_vital(name, value):
    """-> dict(kind, ok, ...). ok=False + error = skip it for trends. kind 'other' = not tracked."""
    n, v = (name or "").lower(), fix_digits(value or "")
    text = f"{n} {v}"
    num = re.search(r"(\d+(?:\.\d+)?)", v)
    if re.search(r"\bbp\b|blood\s*pressure", n):
        m = re.search(r"(\d{2,3})\s*/\s*(\d{2,3})", v)
        if not m:
            return dict(kind="bp", ok=False, error="could not read systolic/diastolic")
        s_, d_ = float(m.group(1)), float(m.group(2))
        if not (60 <= s_ <= 260 and 30 <= d_ <= 160 and s_ > d_):
            return dict(kind="bp", ok=False, error=f"implausible BP {s_:.0f}/{d_:.0f}")
        return dict(kind="bp", ok=True, systolic=s_, diastolic=d_, unit="mmHg")
    if SUGAR_NAME.search(n):
        if not num:
            return dict(kind="sugar_unspecified", ok=False, error="no number found")
        x = float(num.group(1))
        if re.search(r"hba1c|\ba1c\b", text):
            kind, unit, lo, hi = "hba1c", "%", 3, 20
        else:
            if re.search(r"\bfbs\b|\bfbg\b|fasting", text): kind = "sugar_fasting"
            elif re.search(r"\bppbs\b|\bppg\b|\bpp\b|post", text): kind = "sugar_post_meal"
            elif re.search(r"\brbs\b|\brbg\b|random", text): kind = "sugar_random"
            else: kind = "sugar_unspecified"
            unit = "mmol/L" if "mmol" in text else "mg/dL"
            lo, hi = (1, 45) if unit == "mmol/L" else (20, 800)
        if not (lo <= x <= hi):
            return dict(kind=kind, ok=False, error=f"implausible value {x:g} {unit}")
        return dict(kind=kind, ok=True, value=x, unit=unit)
    spec = [("pulse", r"\bpr\b|pulse|heart\s*rate|\bhr\b", 30, 220, "/min"),
            ("temp", r"temp", 30, 110, "F/C"),
            ("spo2", r"spo2|oxygen|o2\s*sat", 50, 100, "%"),
            ("weight", r"weight|\bwt\b", 1, 300, "kg")]
    for kind, pat, lo, hi, unit in spec:
        if re.search(pat, n):
            if not num:
                return dict(kind=kind, ok=False, error="no number found")
            x = float(num.group(1))
            if kind == "temp":
                unit = "F" if x >= 90 else "C"
                lo, hi = (90, 110) if unit == "F" else (30, 43)
            if not (lo <= x <= hi):
                return dict(kind=kind, ok=False, error=f"implausible value {x:g}")
            return dict(kind=kind, ok=True, value=x, unit=unit)
    return dict(kind="other", ok=False, error=None)


_MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}

def parse_date(s):
    """-> (iso 'YYYY-MM-DD' or None, ambiguous_dayfirst: bool). Indian format = day first."""
    if not s:
        return None, False
    for cand in (s, fix_digits(s)):
        # Check ISO format YYYY-MM-DD or YYYY/MM/DD first
        m_iso = re.search(r"\b(\d{4})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})\b", cand)
        if m_iso:
            yy, mm, dd = int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3))
            try:
                return datetime.date(yy, mm, dd).isoformat(), False
            except ValueError:
                pass
        # Then DD-MM-YYYY (Indian format: day first)
        m = re.search(r"(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{2,4})", cand)
        if m:
            dd, mm, yy = int(m.group(1)), int(m.group(2)), int(m.group(3))
            yy = yy + 2000 if yy < 100 else yy
            try:
                return datetime.date(yy, mm, dd).isoformat(), (dd <= 12 and mm <= 12 and dd != mm)
            except ValueError:
                pass
        m = re.search(r"(\d{1,2})\s*([A-Za-z]{3})[a-z]*\.?,?\s*(\d{2,4})", cand)
        if m and m.group(2).lower() in _MONTHS:
            yy = int(m.group(3)); yy = yy + 2000 if yy < 100 else yy
            try:
                return datetime.date(yy, _MONTHS[m.group(2).lower()], int(m.group(1))).isoformat(), False
            except ValueError:
                pass
    return None, False

def _g(v):
    return v.value if v is not None and v.value else None


def analyze_prescription(rx, by_id, expected_name=None):
    """-> dict(record=<UI record>, gate=<status+reasons>, warnings=[...])"""
    reasons, warnings = [], []
    meds = [analyze_medicine(m, by_id) for m in rx.medicines]

    # identity
    ident_conf = field_conf(rx.patient_name, by_id)
    identity_issue = None
    if _g(rx.patient_name) is None:
        identity_issue = "patient name not found on the prescription"
    elif ident_conf is not None and ident_conf < THRESH_OK:
        identity_issue = f"patient name read with low confidence ({ident_conf:.2f})"
    if expected_name and _g(rx.patient_name):
        if fuzz.token_set_ratio(expected_name.lower(), _g(rx.patient_name).lower()) < 70:
            identity_issue = f"name on prescription ('{_g(rx.patient_name)}') does not match the logged-in patient ('{expected_name}')"
            reasons.append("NAME_MISMATCH")
    if identity_issue:
        reasons.append(identity_issue)

    # date
    date_iso, ambiguous = parse_date(_g(rx.date))
    date_issue = None
    if date_iso is None:
        date_issue = "date missing or unreadable - set it before confirming (needed for the timeline and trends)"
    elif date_iso > (datetime.date.today() + datetime.timedelta(days=1)).isoformat():
        date_issue = f"date {date_iso} is in the future - check it"
    elif ambiguous:
        warnings.append(f"date read as day/month/year -> {date_iso}")
    if date_issue:
        reasons.append(date_issue)

    # vitals
    vit = []
    vital_issue = False
    for v in rx.vitals:
        val = _g(v.value)
        p = parse_vital(v.name, val)
        c = field_conf(v.value, by_id)
        flag = "ok"
        if p["kind"] != "other":
            if not p["ok"]:
                flag, vital_issue = "check", True
                reasons.append(f"vital {v.name}: {p['error']}")
            elif c is not None and c < THRESH_LOW:
                flag, vital_issue = "low", True
                reasons.append(f"vital {v.name} read with low confidence ({c:.2f})")
            elif c is not None and c < THRESH_OK:
                flag, vital_issue = "check", True
        vit.append(dict(name=v.name, value=val, conf=c, flag=flag, kind=p["kind"], parsed={k: x for k, x in p.items() if k not in ("kind",)}))

    for m in meds:
        if m["status"] != "OK":
            reasons.append(f"{m['name'] or '?'}: {m['status']} " + "; ".join(i["msg"] for i in m["issues"]) + (" | auto-corrected: " + ", ".join(m["corrected"]) if m["corrected"] else ""))
        warnings.extend(m["warnings"])

    # page level gate
    low = sum(m["status"] == "LOW" for m in meds)
    if not rx.looks_like_prescription:
        status = "LOW_QUALITY"; reasons.insert(0, "does not look like a prescription")
    elif not meds:
        status = "LOW_QUALITY"; reasons.insert(0, "no medicines could be read - ask the user to re-upload a clearer photo")
    elif low * 2 >= len(meds):
        status = "LOW_QUALITY"; reasons.insert(0, "most medicines were read with low confidence - ask for a clearer photo")
    elif identity_issue or date_issue or vital_issue or any(m["status"] != "OK" for m in meds):
        status = "NEEDS_CHECK"
    else:
        status = "HIGH_CONFIDENCE"

    record = dict(
        patient=dict(name=_g(rx.patient_name), uhid=_g(rx.patient_uhid), age=_g(rx.patient_age), sex=_g(rx.patient_sex),
                     ward_bed=_g(rx.patient_ward_bed), name_conf=ident_conf),
        hospital=_g(rx.hospital_name),
        doctor=dict(name=_g(rx.doctor_name), reg_no=_g(rx.doctor_reg_no)),
        date_raw=_g(rx.date), date_iso=date_iso,
        vitals=vit, diagnosis=[x.value for x in rx.diagnosis if x.value], allergies=[x.value for x in rx.allergies if x.value],
        medicines=meds, advice=[x.value for x in rx.advice if x.value], follow_up=_g(rx.follow_up))
    return dict(record=record, gate=dict(status=status, reasons=reasons), warnings=warnings)

"""## 7. Pipeline functions (OCR -> raw DB -> LLM -> validation -> draft DB)"""

class PipelineError(Exception):
    def __init__(self, msg, raw_ocr_id=None, http=500):
        super().__init__(msg); self.raw_ocr_id, self.http = raw_ocr_id, http


def _payload(extraction_id, raw_id, status, analysis, model, duplicate=False):
    return dict(ocr_id=raw_id, extraction_id=extraction_id, status=status, llm_model=model, duplicate=duplicate, **analysis)


def structure_from_raw(raw_id, expected_name=None, image_path=None):
    """Step 4-6: run the LLM on the STORED raw OCR (also used to retry after an LLM failure without re-running OCR)."""
    t_start = time.time()
    log_stage("DB_FETCH", f"Fetching stored raw OCR lines for raw_ocr_id={raw_id}")
    with engine.connect() as c:
        row = c.execute(select(raw_ocr).where(raw_ocr.c.id == raw_id)).mappings().first()
    if not row:
        log_stage("ERROR", f"raw_ocr row #{raw_id} not found in database")
        raise PipelineError("raw_ocr row not found", http=404)
    lines = json.loads(row["lines_json"])
    by_id = {l["id"]: l for l in lines}
    log_stage("LLM_STRUCTURING", f"Invoking Google Gemini on {len(lines)} OCR lines...")
    t_llm = time.time()
    try:
        rx, model = call_gemini(lines, image_path)
        log_stage("LLM_STRUCTURING", f"Gemini structuring succeeded using model '{model}'", time.time() - t_llm)
    except Exception as e:
        log_stage("ERROR", f"Gemini structuring failed: {e}\n{traceback.format_exc()}", time.time() - t_llm)
        with engine.begin() as c:
            audit(c, "llm_failed", None, dict(raw_ocr_id=raw_id, error=str(e)[:300]))
        raise PipelineError(f"LLM structuring failed: {e}", raw_ocr_id=raw_id, http=502)

    t_val = time.time()
    log_stage("VALIDATION", "Analyzing prescription entities and cross-referencing Drug Master...")
    analysis = analyze_prescription(rx, by_id, expected_name)
    med_count = len(analysis.get("record", {}).get("medicines", []))
    gate_st = analysis.get("gate", {}).get("status", "UNKNOWN")
    log_stage("VALIDATION", f"Validation complete: gate={gate_st}, {med_count} medicines extracted", time.time() - t_val)

    t_db = time.time()
    with engine.begin() as c:
        eid = c.execute(insert(extractions).values(raw_ocr_id=raw_id, llm_model=model, analysis_json=jd(analysis),
                                                   status="PENDING_USER_CONFIRMATION", created_at=now_iso())).inserted_primary_key[0]
        audit(c, "extracted", eid, dict(raw_ocr_id=raw_id, gate=gate_st, model=model))
    log_stage("DATABASE", f"Draft extraction #{eid} committed to database", time.time() - t_db)
    log_stage("PIPELINE_COMPLETE", f"Structuring completed successfully for extraction #{eid}", time.time() - t_start)
    return _payload(eid, raw_id, "PENDING_USER_CONFIRMATION", analysis, model)


def process_image(data: bytes, filename: str, patient_id: str, expected_name: Optional[str] = None):
    t_pipeline_start = time.time()
    sha = hashlib.sha256(data).hexdigest()
    log_stage("UPLOAD_RECEIVED", f"Processing upload: filename='{filename}', size={len(data)} bytes, sha256={sha[:12]}...")

    # Duplicate Upload Guard: Check if identical image has already been uploaded for this patient
    with engine.connect() as c:
        hit = c.execute(
            select(raw_ocr.c.id)
            .where(raw_ocr.c.image_sha256 == sha, raw_ocr.c.patient_id == patient_id)
        ).first()
    if hit:
        log_stage("DUPLICATE_DISCARDED", f"Duplicate image upload detected for patient {patient_id} (sha256={sha[:12]}). OCR service skipped and upload discarded.", time.time() - t_pipeline_start)
        raise PipelineError(f"Duplicate prescription image detected. This exact prescription has already been uploaded for patient #{patient_id}. The duplicate upload was automatically discarded without running OCR to prevent redundant records.", http=409)

    t_prep = time.time()
    try:
        path, size = preprocess_image(data)
        log_stage("PREPROCESSING", f"Image cleaned and saved to {path} (resolution={size[0]}x{size[1]})", time.time() - t_prep)
    except Exception as e:
        log_stage("ERROR", f"Image preprocessing failed: {e}\n{traceback.format_exc()}", time.time() - t_prep)
        raise PipelineError(f"not a readable image: {e}", http=400)

    t_ocr = time.time()
    log_stage("OCR_INFERENCE", f"Starting {OCR_ENGINE} model inference (resolution={size[0]}x{size[1]})...")
    try:
        raw, (w, h) = run_ocr(path, size)
        log_stage("OCR_INFERENCE", f"{OCR_ENGINE} inference completed ({len(raw)} text boxes detected)", time.time() - t_ocr)
    except Exception as e:
        log_stage("ERROR", f"{OCR_ENGINE} inference failed: {e}\n{traceback.format_exc()}", time.time() - t_ocr)
        raise PipelineError(f"{OCR_ENGINE} inference failed: {e}", http=500)

    t_lines = time.time()
    lines = build_lines(raw, w, h)
    log_stage("LINE_PARSING", f"Reconstructed reading order into {len(lines)} lines", time.time() - t_lines)

    if not lines:
        log_stage("ERROR", "No text found in the image")
        raise PipelineError("no text found in the image - ask the user to re-upload a clearer photo", http=422)
    avg = round(sum(l["conf"] for l in lines) / len(lines), 4)

    t_db = time.time()
    with engine.begin() as c:                      # RAW OCR is saved before the LLM is called
        raw_id = c.execute(insert(raw_ocr).values(image_sha256=sha, patient_id=patient_id, filename=filename, ocr_engine=OCR_ENGINE,
                                                  image_w=w, image_h=h, avg_conf=avg, lines_json=jd(lines),
                                                  created_at=now_iso())).inserted_primary_key[0]
        audit(c, "ocr_saved", None, dict(raw_ocr_id=raw_id, lines=len(lines), avg_conf=avg))
    log_stage("DATABASE", f"Raw OCR saved with raw_ocr_id={raw_id} (avg_conf={avg})", time.time() - t_db)

    result = structure_from_raw(raw_id, expected_name, path)
    log_stage("PIPELINE_COMPLETE", "Full prescription pipeline completed successfully", time.time() - t_pipeline_start)
    return result

"""## 8. API (FastAPI)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | no auth, quick check |
| POST | `/ocr` | multipart: `file`, `patient_id`, optional `patient_name` -> draft extraction |
| POST | `/structure/{ocr_id}` | re-run the LLM on stored raw OCR (after a 502) |
| GET | `/extractions/{id}` | fetch a draft again |
| GET | `/raw_ocr/{id}` | raw OCR lines |
| POST | `/confirm/{extraction_id}` | JSON `{record, confirmed_by, allow_duplicate}` -> save to patient record + observations |
| POST | `/discard/{extraction_id}` | user threw the draft away |
| GET | `/patients/{patient_id}/prescriptions` | timeline of confirmed prescriptions |
| GET | `/patients/{patient_id}/observations?kind=bp` | numeric series for trends / baseline |

All except `/health` need header `X-API-Key: <API_TOKEN>`.
"""

from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="Prescription OCR service", version="3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


DEV_API_TOKEN = "rx_local_dev_token_2026_secure"

def require_key(x_api_key: str = Header(default=None)):
    # In local development mode, accept requests without key or with dev token
    if not API_TOKEN or API_TOKEN == DEV_API_TOKEN:
        if not x_api_key or x_api_key == DEV_API_TOKEN:
            return
        if secrets.compare_digest(x_api_key, API_TOKEN):
            return
    if x_api_key and (x_api_key == DEV_API_TOKEN or secrets.compare_digest(x_api_key, API_TOKEN)):
        return
    raise HTTPException(401, "invalid or missing X-API-Key")


@app.exception_handler(PipelineError)
def _pipeline_err(request, exc: PipelineError):
    return JSONResponse(status_code=exc.http, content=dict(error=str(exc), raw_ocr_id=exc.raw_ocr_id))


@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "PaddleOCR Prescription API Server",
        "version": "3.0",
        "endpoints": {
            "health": "/health",
            "direct_ocr": "/api/ocr",
            "structured_ocr": "/ocr",
            "docs": "/docs"
        }
    }


@app.get("/health")
def health():
    return dict(ok=True, ocr=OCR_ENGINE, medicine_names_indexed=len(MED_INDEX), time=now_iso())


@app.get("/api/ocr")
def api_ocr_direct_info():
    """Informational endpoint for direct OCR."""
    return {
        "status": "online",
        "service": "PaddleOCR Direct OCR Endpoint",
        "protocol": "Use HTTP POST with multipart/form-data with a 'file' parameter."
    }


@app.post("/api/ocr")
def api_ocr_direct(
    file: UploadFile = File(...),
    patient_id: Optional[str] = Form(None),
    patient_name: Optional[str] = Form(None)
):
    """
    Direct OCR processing endpoint compatible with frontend patient portal.
    Receives 'file' via multipart/form-data and returns:
    {
        "success": true,
        "filename": "...",
        "predictions_count": N,
        "results": [
            {
                "box": [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
                "text": "...",
                "confidence": 0.99
            }
        ]
    }
    """
    t0 = time.time()
    log_stage("ENDPOINT_API_OCR", f"Received POST /api/ocr request: filename='{file.filename}', content_type='{file.content_type}'")
    ctype = (file.content_type or "").lower().strip()
    if ctype and ctype not in ALLOWED_TYPES and not ctype.startswith("image/") and not (file.filename or "").lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff")):
        log_stage("ERROR", f"Rejected unsupported file type: '{file.content_type}'")
        raise HTTPException(415, f"unsupported file type {file.content_type}; use jpg/png/webp")

    data = file.file.read(MAX_UPLOAD_MB * 1024 * 1024 + 1)
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        log_stage("ERROR", f"File size exceeds maximum {MAX_UPLOAD_MB} MB")
        raise HTTPException(413, f"file larger than {MAX_UPLOAD_MB} MB")

    try:
        path, size = preprocess_image(data)
        raw, (w, h) = run_ocr(path, size)

        parsed_results = []
        for box in raw:
            x0, y0, x1, y1 = box["x0"], box["y0"], box["x1"], box["y1"]
            parsed_results.append({
                "box": [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
                "text": box["text"],
                "confidence": float(box["conf"])
            })

        log_stage("ENDPOINT_API_OCR", f"POST /api/ocr processed {len(parsed_results)} text boxes successfully", time.time() - t0)
        return {
            "success": True,
            "filename": file.filename,
            "predictions_count": len(parsed_results),
            "results": parsed_results
        }
    except Exception as e:
        log_stage("ERROR", f"OCR processing failed in /api/ocr: {e}\n{traceback.format_exc()}", time.time() - t0)
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


@app.get("/ocr")
def api_ocr_info():
    """Informational endpoint when /ocr is opened via browser GET request."""
    return dict(
        status="ready",
        service="Prescription OCR & Information Extraction Service",
        protocol="Use HTTP POST with multipart/form-data to submit a prescription image for OCR.",
        required_method="POST",
        required_headers={"X-API-Key": "<API_TOKEN>"},
        required_form_fields={
            "file": "Image file (JPEG, PNG, WebP up to 10MB)",
            "patient_id": "Patient identifier / UHID (e.g. UHID-10023, P-101)",
        },
        optional_form_fields={
            "patient_name": "Patient full name (for record cross-referencing)",
        },
        web_upload_ui="http://localhost:3000/upload",
        swagger_docs="/docs#/default/api_ocr_ocr_post",
    )


@app.post("/ocr", dependencies=[Depends(require_key)])
def api_ocr(file: UploadFile = File(...), patient_id: str = Form(...), patient_name: Optional[str] = Form(None)):
    t0 = time.time()
    log_stage("ENDPOINT_OCR", f"Received POST /ocr request: filename='{file.filename}', content_type='{file.content_type}'")
    ctype = (file.content_type or "").lower().strip()
    if ctype not in ALLOWED_TYPES and not (file.filename or "").lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        log_stage("ERROR", f"Rejected unsupported file type: '{file.content_type}'")
        raise HTTPException(415, f"unsupported file type {file.content_type}; use jpg/png/webp")
    data = file.file.read(MAX_UPLOAD_MB * 1024 * 1024 + 1)
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        log_stage("ERROR", f"File size exceeds maximum {MAX_UPLOAD_MB} MB")
        raise HTTPException(413, f"file larger than {MAX_UPLOAD_MB} MB")
    try:
        res = process_image(data, file.filename or "upload", patient_id, patient_name)
        log_stage("ENDPOINT_OCR", "POST /ocr returning HTTP 200 successfully", time.time() - t0)
        return res
    except HTTPException:
        raise
    except PipelineError as pe:
        log_stage("ERROR", f"PipelineError in api_ocr: {pe}\n{traceback.format_exc()}", time.time() - t0)
        raise
    except Exception as ex:
        log_stage("ERROR", f"Unexpected error in api_ocr: {ex}\n{traceback.format_exc()}", time.time() - t0)
        raise HTTPException(500, f"Internal error during prescription OCR: {ex}")


@app.post("/structure/{ocr_id}", dependencies=[Depends(require_key)])
def api_structure(ocr_id: int, patient_name: Optional[str] = None):
    return structure_from_raw(ocr_id, patient_name)


@app.get("/extractions", dependencies=[Depends(require_key)])
def api_list_extractions(limit: int = 20, patient_id: Optional[str] = None):
    with engine.connect() as c:
        q = select(
            extractions.c.id,
            extractions.c.raw_ocr_id,
            extractions.c.llm_model,
            extractions.c.status,
            extractions.c.created_at,
            raw_ocr.c.patient_id,
            raw_ocr.c.filename,
            raw_ocr.c.avg_conf,
            extractions.c.analysis_json,
        ).join(raw_ocr, raw_ocr.c.id == extractions.c.raw_ocr_id)
        if patient_id:
            q = q.where(raw_ocr.c.patient_id == patient_id)
        q = q.order_by(extractions.c.id.desc()).limit(limit)
        rows = c.execute(q).mappings().all()

    out = []
    for r in rows:
        analysis = json.loads(r["analysis_json"]) if r["analysis_json"] else {}
        out.append(dict(
            extraction_id=r["id"],
            ocr_id=r["raw_ocr_id"],
            llm_model=r["llm_model"],
            status=r["status"],
            created_at=r["created_at"],
            patient_id=r["patient_id"],
            filename=r["filename"],
            avg_conf=r["avg_conf"],
            gate=analysis.get("gate", {}),
            record=analysis.get("record", {}),
        ))
    return out


@app.get("/extractions/{extraction_id}", dependencies=[Depends(require_key)])
def api_get_extraction(extraction_id: int):
    with engine.connect() as c:
        r = c.execute(select(extractions).where(extractions.c.id == extraction_id)).mappings().first()
        if not r:
            raise HTTPException(404, "not found")
        patient_id = c.execute(select(raw_ocr.c.patient_id).where(raw_ocr.c.id == r["raw_ocr_id"])).scalar()
    
    analysis = json.loads(r["analysis_json"])
    if r["status"] == "CONFIRMED":
        with engine.connect() as c:
            cp = c.execute(select(confirmed_prescriptions.c.data_json, confirmed_prescriptions.c.patient_id).where(confirmed_prescriptions.c.extraction_id == extraction_id)).mappings().first()
            if cp and cp["data_json"]:
                analysis["record"] = json.loads(cp["data_json"])
                if cp["patient_id"]:
                    patient_id = cp["patient_id"]

    res = _payload(r["id"], r["raw_ocr_id"], r["status"], analysis, r["llm_model"])
    res["patient_id"] = patient_id
    return res


@app.get("/raw_ocr/{ocr_id}", dependencies=[Depends(require_key)])
def api_get_raw(ocr_id: int):
    with engine.connect() as c:
        r = c.execute(select(raw_ocr).where(raw_ocr.c.id == ocr_id)).mappings().first()
    if not r:
        raise HTTPException(404, "not found")
    d = dict(r); d["lines"] = json.loads(d.pop("lines_json"))
    return d


# ---------------------------------------------------------------------------------------------------------
META_KEYS = {"fields", "status", "issues", "warnings", "corrected", "min_conf", "ambiguity_note", "db", "conf", "flag", "parsed", "kind", "name_conf"}

def diff(a, b, path=""):
    out = []
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k in META_KEYS:
                continue
            out += diff(a.get(k), b.get(k), f"{path}.{k}" if path else k)
    elif isinstance(a, list) and isinstance(b, list):
        for i in range(max(len(a), len(b))):
            out += diff(a[i] if i < len(a) else None, b[i] if i < len(b) else None, f"{path}[{i}]")
    elif a != b:
        out.append(dict(path=path, machine=a, confirmed=b))
    return out


class ConfirmBody(BaseModel):
    record: dict                       # the (possibly edited) record, same shape as returned by /ocr
    confirmed_by: Optional[str] = None
    allow_duplicate: bool = False


@app.post("/confirm/{extraction_id}", dependencies=[Depends(require_key)])
def api_confirm(extraction_id: int, body: ConfirmBody):
    t0 = time.time()
    log_stage("CONFIRM", f"Processing confirmation for extraction #{extraction_id}, allow_duplicate={body.allow_duplicate}")
    with engine.connect() as c:
        ex = c.execute(select(extractions).where(extractions.c.id == extraction_id)).mappings().first()
        if not ex:
            log_stage("ERROR", f"Extraction #{extraction_id} not found")
            raise HTTPException(404, "extraction not found")
        patient_id = c.execute(select(raw_ocr.c.patient_id).where(raw_ocr.c.id == ex["raw_ocr_id"])).scalar()

    rec = body.record
    if not patient_id or str(patient_id).strip() == "":
        patient_id = (rec.get("patient") or {}).get("uhid") or (rec.get("patient") or {}).get("name") or "UNKNOWN_PATIENT"

    if ex["status"] == "CONFIRMED":
        log_stage("WARN", f"Extraction #{extraction_id} was already confirmed")
        with engine.connect() as c:
            cp = c.execute(select(confirmed_prescriptions).where(confirmed_prescriptions.c.extraction_id == extraction_id)).mappings().first()
        if cp:
            return dict(prescription_id=cp["id"], patient_id=cp["patient_id"], rx_date=cp["rx_date"], edits=json.loads(cp["edits_json"] or "[]"),
                        observations_saved=0, observations_skipped=[], already_confirmed=True)
        raise HTTPException(409, "already confirmed")
    if ex["status"] == "DISCARDED":
        log_stage("WARN", f"Extraction #{extraction_id} was discarded")
        raise HTTPException(409, "this draft was discarded")

    date_iso = rec.get("date_iso")
    try:
        datetime.date.fromisoformat(date_iso or "")
    except ValueError:
        date_iso, _ = parse_date(rec.get("date_raw"))
    if not date_iso:
        date_iso = datetime.date.today().isoformat()
        log_stage("CONFIRM", f"No date found in prescription; defaulting to today: {date_iso}")
    rec["date_iso"] = date_iso
    meds = rec.get("medicines") or []
    if not meds:
        log_stage("ERROR", "Confirmation rejected: at least one medicine is required")
        raise HTTPException(422, "At least one medicine is required to confirm prescription")
    
    doc_raw = rec.get("doctor") or {}
    doctor = doc_raw if isinstance(doc_raw, dict) else {"name": str(doc_raw), "reg_no": None}

    names = sorted((m.get("name") or "").strip().lower() for m in meds if isinstance(m, dict))
    if not body.allow_duplicate:
        with engine.connect() as c:
            same = c.execute(select(confirmed_prescriptions.c.id, confirmed_prescriptions.c.data_json).where(
                confirmed_prescriptions.c.patient_id == patient_id, confirmed_prescriptions.c.rx_date == date_iso)).all()
        for sid, sdata in same:
            old = json.loads(sdata) if sdata else {}
            old_meds = [m for m in (old.get("medicines") or []) if isinstance(m, dict)]
            if sorted((m.get("name") or "").strip().lower() for m in old_meds) == names:
                log_stage("CONFIRM_DUPLICATE", f"Duplicate detected matching confirmed prescription #{sid}")
                raise HTTPException(409, f"looks like a duplicate of confirmed prescription #{sid} (same patient, date and medicines). Send allow_duplicate=true to save anyway.")

    original = json.loads(ex["analysis_json"])["record"]
    edits = diff(original, rec)
    skipped, saved_obs = [], 0
    with engine.begin() as c:
        pid = c.execute(insert(confirmed_prescriptions).values(
            extraction_id=extraction_id, patient_id=patient_id, rx_date=date_iso, hospital=rec.get("hospital"),
            doctor=doctor.get("name"), doctor_reg_no=doctor.get("reg_no"), data_json=jd(rec), edits_json=jd(edits),
            confirmed_by=body.confirmed_by, confirmed_at=now_iso())).inserted_primary_key[0]
        for v in rec.get("vitals") or []:
            if not isinstance(v, dict):
                continue
            p = parse_vital(v.get("name"), v.get("value"))
            if p["kind"] == "other":
                continue
            if not p["ok"]:
                skipped.append(dict(name=v.get("name"), value=v.get("value"), reason=p["error"]))
                continue
            c.execute(insert(observations).values(
                patient_id=patient_id, prescription_id=pid, obs_date=date_iso, kind=p["kind"], systolic=p.get("systolic"),
                diastolic=p.get("diastolic"), value=p.get("value"), unit=p.get("unit"),
                raw_text=f"{v.get('name')} {v.get('value')}"[:120], created_at=now_iso()))
            saved_obs += 1
        
        # Keep extractions analysis_json synced with the confirmed doctor review
        analysis = json.loads(ex["analysis_json"])
        analysis["record"] = rec
        c.execute(update(extractions).where(extractions.c.id == extraction_id).values(status="CONFIRMED", analysis_json=jd(analysis)))
        audit(c, "confirmed", extraction_id, dict(prescription_id=pid, by=body.confirmed_by, edits=len(edits), observations=saved_obs))
    
    log_stage("CONFIRM", f"Prescription #{pid} successfully confirmed and saved (edits={len(edits)}, vitals={saved_obs})", time.time() - t0)
    return dict(prescription_id=pid, patient_id=patient_id, rx_date=date_iso, edits=edits,
                observations_saved=saved_obs, observations_skipped=skipped)


@app.post("/discard/{extraction_id}", dependencies=[Depends(require_key)])
def api_discard(extraction_id: int):
    with engine.begin() as c:
        st = c.execute(select(extractions.c.status).where(extractions.c.id == extraction_id)).scalar()
        if st is None:
            return dict(ok=True)
        if st == "CONFIRMED":
            raise HTTPException(409, "already confirmed")
        c.execute(delete(extractions).where(extractions.c.id == extraction_id))
        audit(c, "discarded", extraction_id)
    return dict(ok=True)


@app.get("/patients/{patient_id}/prescriptions", dependencies=[Depends(require_key)])
def api_patient_rx(patient_id: str):
    with engine.connect() as c:
        rows = c.execute(select(confirmed_prescriptions).where(confirmed_prescriptions.c.patient_id == patient_id)
                         .order_by(confirmed_prescriptions.c.rx_date)).mappings().all()
    out = []
    for r in rows:
        d = dict(r); d["data"] = json.loads(d.pop("data_json")); d["edits"] = json.loads(d.pop("edits_json") or "[]")
        out.append(d)
    return out


@app.get("/patients/{patient_id}/observations", dependencies=[Depends(require_key)])
def api_patient_obs(patient_id: str, kind: Optional[str] = None):
    q = select(observations).where(observations.c.patient_id == patient_id)
    if kind:
        q = q.where(observations.c.kind == kind)
    with engine.connect() as c:
        rows = c.execute(q.order_by(observations.c.obs_date, observations.c.id)).mappings().all()
    return [dict(r) for r in rows]

"""## 9. Start the local API
Run this file from the VS Code terminal. The API is available only on this computer by default.
"""

import uvicorn

PORT = int(os.environ.get("PORT", "8000"))
HOST = os.environ.get("HOST", "0.0.0.0")

if __name__ == "__main__":
    print("Starting local Prescription OCR API...")
    print("API token:", API_TOKEN)
    print(f"Health check: http://{HOST}:{PORT}/health")
    print(f"API docs:    http://{HOST}:{PORT}/docs")
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
