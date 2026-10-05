import os
import json
import psycopg2
from dotenv import load_dotenv

# Load env from model/.env or frontend/.env.local
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "model", ".env"))
db_url = os.getenv("DATABASE_URL")
if not db_url:
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "frontend", ".env.local"))
    db_url = os.getenv("DATABASE_URL")

conn = psycopg2.connect(db_url)
cur = conn.cursor()

print("--- DOCUMENTS ---")
cur.execute("SELECT id, patient_id, filename, status, structured_result, summary, created_at FROM documents ORDER BY id ASC;")
docs = cur.fetchall()
print(f"Total documents: {len(docs)}")
for d in docs:
    sr = d[4]
    if isinstance(sr, str):
        try: sr = json.loads(sr)
        except: pass
    meds = sr.get("medicines") if isinstance(sr, dict) else None
    doc_date = sr.get("date_iso") if isinstance(sr, dict) else None
    doctor = sr.get("doctor") if isinstance(sr, dict) else None
    print(f"ID: {d[0]} | Patient: {d[1]} | File: {d[2]} | Status: {d[3]} | Date: {doc_date} | Doctor: {doctor} | Meds: {len(meds) if meds else 0}")
    if meds:
        print("   Meds detail:", meds)
    print("   Summary:", d[5])
    print()

print("\n--- EXTRACTIONS ---")
try:
    cur.execute("SELECT id, patient_id, status, structured_data, created_at FROM extractions ORDER BY id ASC;")
    exts = cur.fetchall()
    print(f"Total extractions: {len(exts)}")
    for e in exts:
        sd = e[3]
        if isinstance(sd, str):
            try: sd = json.loads(sd)
            except: pass
        meds = sd.get("medicines") if isinstance(sd, dict) else None
        print(f"ID: {e[0]} | Patient: {e[1]} | Status: {e[2]} | Meds: {len(meds) if meds else 0}")
        if meds:
            print("   Meds:", meds)
except Exception as ex:
    print("Extractions query error:", ex)

conn.close()
