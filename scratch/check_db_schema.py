import os
import psycopg2
from dotenv import load_dotenv

load_dotenv("model/.env")
load_dotenv()

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()

cur.execute("""
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_name = 'Document';
""")
print("Document columns:", cur.fetchall())

cur.execute("""
    SELECT enumlabel 
    FROM pg_enum 
    JOIN pg_type ON pg_enum.enum_typid = pg_type.oid 
    WHERE typname = 'DocumentStatus';
""")
print("DocumentStatus enum values:", cur.fetchall())
conn.close()
