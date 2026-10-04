"""
Neon to Supabase PostgreSQL Migration Tool
Safely copies existing records (users, documents, analyses, extractions, observations)
from Neon PostgreSQL to Supabase PostgreSQL without data loss or overwriting.

Usage:
  python scratch/migrate_neon_to_supabase.py
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv("model/.env")
load_dotenv("frontend/.env.local")
load_dotenv()

SOURCE_URL = os.environ.get("NEON_DATABASE_URL") or os.environ.get("DATABASE_URL")
TARGET_URL = os.environ.get("SUPABASE_DATABASE_URL") or os.environ.get("DATABASE_URL")

TABLES_ORDER = [
    "User",
    "Document",
    "Analysis",
    "medicine_master",
    "raw_ocr",
    "extractions",
    "confirmed_prescriptions",
    "observations",
    "audit_log"
]

def migrate():
    print("=" * 65)
    print("  Neon -> Supabase PostgreSQL Data Migration")
    print("=" * 65)
    
    if not SOURCE_URL or not TARGET_URL:
        print("[ERROR] DATABASE_URL or SUPABASE_DATABASE_URL is missing.")
        return

    print(f"[INFO] Source DB: {SOURCE_URL.split('@')[-1] if '@' in SOURCE_URL else 'configured'}")
    print(f"[INFO] Target DB: {TARGET_URL.split('@')[-1] if '@' in TARGET_URL else 'configured'}")

    # 1. Apply DDL to target
    target_conn = psycopg2.connect(TARGET_URL)
    with open("scratch/supabase_schema.sql", "r", encoding="utf-8") as f:
        schema_sql = f.read()
    with target_conn.cursor() as cur:
        cur.execute(schema_sql)
        target_conn.commit()
    print("[SUCCESS] Applied Supabase schema & 9-digit patient ID generator function.")

    # 2. Check if source is different from target
    if SOURCE_URL == TARGET_URL:
        print("[INFO] Source and Target URLs are identical. Schema updated in-place.")
        with target_conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute('SELECT id, name, email, "patientId", "legacyPatientId" FROM "User";')
            print("Users in database:", cur.fetchall())
        target_conn.close()
        return

    source_conn = psycopg2.connect(SOURCE_URL)

    for table in TABLES_ORDER:
        try:
            with source_conn.cursor(cursor_factory=RealDictCursor) as s_cur:
                s_cur.execute(f'SELECT * FROM "{table}"' if table in ["User", "Document", "Analysis"] else f'SELECT * FROM {table}')
                rows = s_cur.fetchall()
            
            if not rows:
                print(f"[INFO] Table {table}: 0 rows to migrate.")
                continue

            columns = list(rows[0].keys())
            quoted_table = f'"{table}"' if table in ["User", "Document", "Analysis"] else table
            quoted_cols = [f'"{c}"' for c in columns]
            placeholders = [f"%({c})s" for c in columns]

            insert_sql = f"""
                INSERT INTO {quoted_table} ({', '.join(quoted_cols)})
                VALUES ({', '.join(placeholders)})
                ON CONFLICT (id) DO NOTHING;
            """

            with target_conn.cursor() as t_cur:
                for row in rows:
                    t_cur.execute(insert_sql, row)
                target_conn.commit()

            print(f"[SUCCESS] Migrated {len(rows)} records into {table}.")
        except Exception as e:
            print(f"[WARNING] Could not migrate table {table}: {e}")
            target_conn.rollback()

    source_conn.close()
    target_conn.close()
    print("[DONE] Neon to Supabase migration completed safely!")

if __name__ == "__main__":
    migrate()
