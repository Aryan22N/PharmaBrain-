import os
import sqlalchemy as sa
from sqlalchemy import text

db_url = os.environ.get('DATABASE_URL', '')
if 'psycopg2' not in db_url and db_url.startswith('postgresql://'):
    db_url = db_url.replace('postgresql://', 'postgresql+psycopg2://')
engine = sa.create_engine(db_url)

with engine.connect() as conn:
    print("--- USERS ---")
    users = conn.execute(text('SELECT id, name, email, "patientId", "legacyPatientId" FROM "User"')).fetchall()
    for u in users:
        print(u)

    print("\n--- DOCUMENTS ---")
    docs = conn.execute(text('SELECT id, "userId", "patientId", "originalName", status, "uploadedAt", "filePath" FROM "Document" ORDER BY id')).fetchall()
    for d in docs:
        print(d)

    print("\n--- CONFIRMED PRESCRIPTIONS ---")
    conf = conn.execute(text('SELECT id, extraction_id, patient_id, rx_date, hospital, doctor FROM confirmed_prescriptions ORDER BY id')).fetchall()
    for c in conf:
        print(c)

    print("\n--- OBSERVATIONS COUNT ---")
    obs = conn.execute(text('SELECT id, patient_id, prescription_id, obs_date, kind, value, systolic, diastolic FROM observations ORDER BY obs_date, id')).fetchall()
    print("Total observations:", len(obs))
    for o in obs:
        print(o)

    print("\n--- PATIENT TIMELINE EVENTS ---")
    tl = conn.execute(text('SELECT id, patient_id, event_date, category, title, source, verification_status FROM patient_timeline_events ORDER BY event_date, id')).fetchall()
    print("Total timeline events:", len(tl))
    for t in tl:
        print(t)
