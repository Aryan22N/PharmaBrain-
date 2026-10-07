import os, sys, urllib.parse
from sqlalchemy import create_engine, text

raw_url = "postgresql://postgres.dvydfsahkqzgluusdsnn:arn2252006%40123@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"

# Normalize URL
if raw_url.startswith("postgresql://"):
    url = "postgresql+psycopg2://" + raw_url[len("postgresql://"):]
else:
    url = raw_url

print(f"Connecting to database...")

try:
    engine = create_engine(url, connect_args={"connect_timeout": 15})
    with engine.connect() as conn:
        res = conn.execute(text("SELECT current_database();")).fetchone()
        print("✅ Connection Successful! DB Name:", res[0])
        
        tables = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).fetchall()
        tbl_names = [t[0] for t in tables]
        print(f"📋 Tables present ({len(tbl_names)}): {tbl_names}")
        
        if "medicine_master" in tbl_names:
            count = conn.execute(text("SELECT count(*) FROM medicine_master")).fetchone()
            print(f"💊 medicine_master total rows: {count[0]:,}")
            sample = conn.execute(text("SELECT * FROM medicine_master LIMIT 3")).mappings().all()
            for s in sample:
                print("   Sample medicine:", dict(s))
        else:
            print("⚠️ 'medicine_master' table does NOT exist in public schema yet.")
            
except Exception as e:
    print("❌ Connection Error:", e)
