import os, psycopg2
from dotenv import load_dotenv

load_dotenv('model/.env')
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()
cur.execute('SELECT id, "originalName", "storedFilename", "filePath", status FROM "Document" ORDER BY id DESC LIMIT 5;')
for r in cur.fetchall():
    print(r)
