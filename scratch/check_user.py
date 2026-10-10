import os, sqlalchemy as sa
from sqlalchemy import text

db_url = os.environ.get('DATABASE_URL', '')
if 'psycopg2' not in db_url and db_url.startswith('postgresql://'):
    db_url = db_url.replace('postgresql://', 'postgresql+psycopg2://')
engine = sa.create_engine(db_url)

with engine.connect() as conn:
    print('=== USER 1 ===')
    u = conn.execute(text('SELECT id, name, email, "patientId", "legacyPatientId" FROM "User" WHERE id = 1')).fetchone()
    print(u)
    pids = [u[3], u[4], str(u[0])]
    print('pids:', pids)
    print('=== DOCUMENTS for User 1 ===')
    docs = conn.execute(text('SELECT id, "userId", "patientId", "originalName", status, "uploadedAt", "filePath" FROM "Document" WHERE "userId" = 1 OR "patientId" = :pid ORDER BY id'), {'pid': u[3]}).fetchall()
    for d in docs:
        print(d)
    print('=== CONFIRMED PRESCRIPTIONS for User 1 ===')
    cps = conn.execute(text('SELECT id, extraction_id, patient_id, rx_date, hospital, doctor FROM confirmed_prescriptions WHERE patient_id = ANY(:pids) ORDER BY id'), {'pids': pids}).fetchall()
    for c in cps:
        print(c)
    print('=== ALL CONFIRMED PRESCRIPTIONS ===')
    all_cps = conn.execute(text('SELECT id, extraction_id, patient_id, rx_date, hospital, doctor FROM confirmed_prescriptions ORDER BY id')).fetchall()
    for c in all_cps:
        print(c)
    print('=== CACHE ===')
    cache = conn.execute(text('SELECT patient_id, obs_hash, updated_at FROM patient_trends_cache')).fetchall()
    for ca in cache:
        print(ca)
