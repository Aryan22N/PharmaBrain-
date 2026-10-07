#!/usr/bin/env python3
"""
High-Performance Bulk Importer for 250k+ Medicine Dataset
Imports CSV or JSON medicine records into the database 'medicine_master' table in seconds.

Supported CSV Column Headers (flexible auto-mapping):
  - name / brand_name / drug_name (REQUIRED)
  - generic / generic_name
  - composition / active_ingredients
  - uses / indication / category
  - strengths_mg / strength / dosage_form

Usage:
  python import_medicines_bulk.py <path_to_csv_or_json_file>
"""

import os, sys, csv, json, time, re
from dotenv import load_dotenv

_script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_script_dir, ".env"))
load_dotenv()

from sqlalchemy import create_engine, MetaData, Table, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("Error: DATABASE_URL not set in environment or model/.env")
    sys.exit(1)

# Import sanitizer from final_prescription_ocr_service_windows
sys.path.insert(0, _script_dir)
try:
    from final_prescription_ocr_service_windows import sanitize_database_url, medicine_master, engine
except Exception as e:
    from sqlalchemy import Column, Integer, String, Text
    from final_prescription_ocr_service_windows import sanitize_database_url
    CLEAN_URL = sanitize_database_url(DATABASE_URL)
    engine = create_engine(CLEAN_URL)
    md = MetaData()
    medicine_master = Table("medicine_master", md,
        Column("id", Integer, primary_key=True, autoincrement=True),
        Column("name", String(120), unique=True),
        Column("generic", String(160)), Column("composition", Text), Column("uses", Text),
        Column("strengths_mg", String(200)), Column("source", String(80)))


def normalize_header(header):
    h = header.strip().lower().replace(" ", "_")
    if h in ("name", "brand_name", "drug_name", "medicine_name", "brand"):
        return "name"
    if h in ("generic", "generic_name", "salt", "active_ingredient"):
        return "generic"
    if h in ("composition", "ingredients", "formula"):
        return "composition"
    if h in ("uses", "indication", "indications", "category"):
        return "uses"
    if h in ("strengths_mg", "strength", "strengths", "dosage"):
        return "strengths_mg"
    return h


def bulk_import(file_path, batch_size=5000):
    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}")
        sys.exit(1)

    print(f"Starting bulk import from '{file_path}' into medicine_master...")
    start_time = time.time()

    rows_to_insert = []
    seen_names = set()
    total_processed = 0
    total_inserted = 0

    is_json = file_path.endswith(".json")

    if is_json:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                data = data.get("medicines") or data.get("data") or []
            for item in data:
                total_processed += 1
                raw_name = str(item.get("name") or item.get("brand_name") or "").strip().lower()
                if not raw_name or raw_name in seen_names:
                    continue
                seen_names.add(raw_name)

                rows_to_insert.append({
                    "name": raw_name[:120],
                    "generic": str(item.get("generic") or item.get("generic_name") or "")[:160],
                    "composition": str(item.get("composition") or ""),
                    "uses": str(item.get("uses") or ""),
                    "strengths_mg": str(item.get("strengths_mg") or item.get("strength") or "")[:200],
                    "source": os.path.basename(file_path)[:80]
                })

                if len(rows_to_insert) >= batch_size:
                    total_inserted += _commit_batch(rows_to_insert)
                    rows_to_insert = []
                    print(f"  Processed {total_processed:,} records... ({total_inserted:,} imported)")
    else:
        with open(file_path, newline="", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            headers = [normalize_header(h) for h in next(reader, [])]
            
            for row_idx, row in enumerate(reader, start=1):
                total_processed += 1
                row_dict = {headers[i]: row[i].strip() for i in range(min(len(headers), len(row)))}
                
                raw_name = row_dict.get("name", "").lower()
                if not raw_name or raw_name in seen_names:
                    continue
                seen_names.add(raw_name)

                rows_to_insert.append({
                    "name": raw_name[:120],
                    "generic": row_dict.get("generic", "")[:160],
                    "composition": row_dict.get("composition", ""),
                    "uses": row_dict.get("uses", ""),
                    "strengths_mg": row_dict.get("strengths_mg", "")[:200],
                    "source": os.path.basename(file_path)[:80]
                })

                if len(rows_to_insert) >= batch_size:
                    total_inserted += _commit_batch(rows_to_insert)
                    rows_to_insert = []
                    print(f"  Processed {total_processed:,} records... ({total_inserted:,} imported)")

    if rows_to_insert:
        total_inserted += _commit_batch(rows_to_insert)

    elapsed = time.time() - start_time
    print(f"\n✅ SUCCESS! Processed {total_processed:,} total rows.")
    print(f"Successfully inserted/updated {total_inserted:,} unique medicine records in {elapsed:.2f} seconds.")


def _commit_batch(batch):
    if not batch:
        return 0
    with engine.begin() as conn:
        if engine.dialect.name == "postgresql":
            stmt = pg_insert(medicine_master).values(batch)
            stmt = stmt.on_conflict_do_update(
                index_elements=["name"],
                set_={
                    "generic": stmt.excluded.generic,
                    "composition": stmt.excluded.composition,
                    "uses": stmt.excluded.uses,
                    "strengths_mg": stmt.excluded.strengths_mg,
                    "source": stmt.excluded.source
                }
            )
            conn.execute(stmt)
        else:
            # SQLite / Generic fallback
            for item in batch:
                ex = conn.execute(select(medicine_master.c.id).where(medicine_master.c.name == item["name"])).first()
                if ex:
                    conn.execute(medicine_master.update().where(medicine_master.c.name == item["name"]).values(**item))
                else:
                    conn.execute(medicine_master.insert().values(**item))
    return len(batch)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_medicines_bulk.py <path_to_medicines_file.csv_or_json>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    bulk_import(file_path)
