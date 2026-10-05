import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('model/.env')
db_url = os.getenv('DATABASE_URL')
conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

# 1. Run Table creation SQL
with open('scratch/create_timeline_and_medicines_tables.sql', 'r') as f:
    sql = f.read()
cur.execute(sql)
print("Created/verified patient_timeline_events and patient_medications tables!")

# 2. Seed Timeline Records for Rahul Sharma
# Clear existing for user 1 / 483027156 / CCM12578 to ensure exact counts
cur.execute("DELETE FROM patient_timeline_events WHERE patient_id IN ('483027156', 'CCM12578');")
cur.execute("DELETE FROM patient_medications WHERE patient_id IN ('483027156', 'CCM12578');")

timeline_items = [
    {
        "event_date": "2026-09-12",
        "category": "Symptom Report",
        "title": "Patient Symptom Note: Gastrointestinal Discomfort",
        "description": "Reported nausea and abdominal heaviness 1-2 hours following evening Metformin dose.",
        "source": "Manual Entry",
        "reliability": "Low",
        "verification_status": "Patient Confirmed",
        "facility": "Patient Home Portal",
        "doctor": "Rahul Sharma (Patient Self-Report)",
        "reference_id": "PATIENT-SYMPTOM-2026-0912",
        "is_conflicting": False,
        "conflict_details": None
    },
    {
        "event_date": "2026-09-11",
        "category": "Medication",
        "title": "Discrepant Medication Self-Entry: Metformin 1000mg",
        "description": "Patient self-reported increasing Metformin from 500mg to 1000mg BID. Marked conflicting with active hospital discharge prescription.",
        "source": "Manual Entry",
        "reliability": "Low",
        "verification_status": "Conflicting Record",
        "facility": "Patient Home Portal",
        "doctor": "Rahul Sharma (Patient Self-Entry)",
        "reference_id": "PATIENT-MED-2026-0911",
        "is_conflicting": True,
        "conflict_details": "HMS Reference: Metformin 500 mg BID (10 Sep 2026) vs Patient Self-Entry: Metformin 1000 mg (11 Sep 2026)."
    },
    {
        "event_date": "2026-09-10",
        "category": "Medication",
        "title": "Hospital Outpatient Prescription: Metformin 500mg BID",
        "description": "Standard oral antihyperglycemic therapy prescribed twice daily after meals following metabolic review.",
        "source": "Hospital HMS",
        "reliability": "High",
        "verification_status": "Hospital Verified",
        "facility": "City Care Medical Centre",
        "doctor": "Dr. Priya Deshmukh",
        "reference_id": "HMS-PRESCRIPTION-2026-0910",
        "is_conflicting": False,
        "conflict_details": None
    },
    {
        "event_date": "2026-08-15",
        "category": "Lab Report",
        "title": "Endocrinology Comprehensive Panel: HbA1c 8.1%",
        "description": "Venous blood specimen processed via HPLC. HbA1c 8.1% (elevated threshold). Glycemic counseling conducted.",
        "source": "Hospital HMS",
        "reliability": "High",
        "verification_status": "Hospital Verified",
        "facility": "Max Super Speciality Hospital",
        "doctor": "Dr. Arvind Saxena",
        "reference_id": "LAB-HBA1C-2026-0815",
        "is_conflicting": False,
        "conflict_details": None
    },
    {
        "event_date": "2026-07-22",
        "category": "Cardiology",
        "title": "Cardiology Follow-Up: Blood Pressure 146/92 mmHg",
        "description": "Stage 1 Essential Hypertension monitoring. Dietary sodium restriction and continued Telmisartan 40mg therapy.",
        "source": "Hospital HMS",
        "reliability": "High",
        "verification_status": "Hospital Verified",
        "facility": "Apollo Clinic",
        "doctor": "Dr. R. K. Gupta",
        "reference_id": "HMS-OPD-2026-0722",
        "is_conflicting": False,
        "conflict_details": None
    },
    {
        "event_date": "2026-06-10",
        "category": "Lab Report",
        "title": "Fasting Lipid Profile & Metabolic Chemistry",
        "description": "Total Cholesterol 218 mg/dL, LDL 138 mg/dL, Triglycerides 172 mg/dL. Fasting Blood Sugar 142 mg/dL.",
        "source": "Hospital HMS",
        "reliability": "High",
        "verification_status": "Hospital Verified",
        "facility": "Fortis Healthcare Laboratories",
        "doctor": "Dr. Sunita Kapoor",
        "reference_id": "LAB-LIPID-2026-0610",
        "is_conflicting": False,
        "conflict_details": None
    },
    {
        "event_date": "2026-05-18",
        "category": "Cardiology",
        "title": "Transthoracic 2D Echocardiography & Baseline ECG",
        "description": "Preserved left ventricular systolic function (LVEF 60%). No regional wall motion abnormality. Resting heart rate 76 bpm.",
        "source": "Hospital HMS",
        "reliability": "High",
        "verification_status": "Hospital Verified",
        "facility": "Medanta Heart Institute",
        "doctor": "Dr. Rajesh Trehan",
        "reference_id": "ECHO-CARDIO-2026-0518",
        "is_conflicting": False,
        "conflict_details": None
    },
    {
        "event_date": "2025-11-04",
        "category": "Medication",
        "title": "Annual Diabetic Review & Prescription Refill",
        "description": "Routine annual glycemic titration. Maintained on oral Biguanides and Angiotensin receptor antagonist.",
        "source": "Hospital HMS",
        "reliability": "High",
        "verification_status": "Hospital Verified",
        "facility": "City Care Medical Centre",
        "doctor": "Dr. Neha Verma",
        "reference_id": "HMS-ANNUAL-2025-1104",
        "is_conflicting": False,
        "conflict_details": None
    },
    {
        "event_date": "2025-06-14",
        "category": "Lab Report",
        "title": "Glycated Hemoglobin & Renal Function Battery",
        "description": "HbA1c 7.6%. Serum Creatinine 0.94 mg/dL. Estimated GFR > 90 mL/min/1.73m² (Normal renal clearance).",
        "source": "Hospital HMS",
        "reliability": "High",
        "verification_status": "Hospital Verified",
        "facility": "Max Super Speciality Laboratories",
        "doctor": "Dr. Arvind Saxena",
        "reference_id": "LAB-RENAL-2025-0614",
        "is_conflicting": False,
        "conflict_details": None
    },
    {
        "event_date": "2024-12-08",
        "category": "Diagnostic",
        "title": "Diabetic Retinopathy Screening & Fundus Photography",
        "description": "Bilateral dilated fundus examination shows no signs of diabetic macular edema or microaneurysms.",
        "source": "Hospital HMS",
        "reliability": "High",
        "verification_status": "Hospital Verified",
        "facility": "Vision Eye Institute",
        "doctor": "Dr. Shalini Mehta",
        "reference_id": "OPH-FUNDUS-2024-1208",
        "is_conflicting": False,
        "conflict_details": None
    },
    {
        "event_date": "2024-05-20",
        "category": "Medication",
        "title": "Blood Pressure Titration & Monotherapy Initiation",
        "description": "Transitioned antihypertensive regimen to Telmisartan 40mg monotherapy with excellent tolerance.",
        "source": "Hospital HMS",
        "reliability": "High",
        "verification_status": "Hospital Verified",
        "facility": "City Care Medical Centre",
        "doctor": "Dr. Priya Deshmukh",
        "reference_id": "HMS-TITR-2024-0520",
        "is_conflicting": False,
        "conflict_details": None
    },
    {
        "event_date": "2023-03-25",
        "category": "Medication",
        "title": "Initial Antihypertensive Prescription: Telmisartan 40mg",
        "description": "First initiation of ARB therapy for stage 1 blood pressure regulation. Baseline renal function normal.",
        "source": "Hospital HMS",
        "reliability": "High",
        "verification_status": "Hospital Verified",
        "facility": "City Care Medical Centre",
        "doctor": "Dr. Priya Deshmukh",
        "reference_id": "HMS-OPD-2023-0322-RX",
        "is_conflicting": False,
        "conflict_details": None
    },
    {
        "event_date": "2021-08-10",
        "category": "Symptom Report",
        "title": "Adverse Reaction Log: Sulfa Medication Allergy Rash",
        "description": "Mild cutaneous erythematous maculopapular rash reported following Trimethoprim-sulfamethoxazole. Documented in allergy file.",
        "source": "Manual Entry",
        "reliability": "Medium",
        "verification_status": "Patient Confirmed",
        "facility": "Apollo Emergency Care",
        "doctor": "Rahul Sharma / ER Staff",
        "reference_id": "ALLERGY-SULFA-2021-0810",
        "is_conflicting": False,
        "conflict_details": None
    },
    {
        "event_date": "2019-10-14",
        "category": "Diagnostic",
        "title": "Baseline Comprehensive Health Checkup & Family History",
        "description": "Initial adult preventative health assessment. Family history positive for early type 2 diabetes (maternal).",
        "source": "Hospital HMS",
        "reliability": "High",
        "verification_status": "Hospital Verified",
        "facility": "City Care Medical Centre",
        "doctor": "Dr. Priya Deshmukh",
        "reference_id": "HMS-BASE-2019-1014",
        "is_conflicting": False,
        "conflict_details": None
    }
]

for t in timeline_items:
    cur.execute("""
        INSERT INTO patient_timeline_events 
        (patient_id, user_id, event_date, category, title, description, source, reliability, verification_status, facility, doctor, reference_id, is_conflicting, conflict_details)
        VALUES (%s, 1, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    """, (
        '483027156',
        t["event_date"],
        t["category"],
        t["title"],
        t["description"],
        t["source"],
        t["reliability"],
        t["verification_status"],
        t["facility"],
        t["doctor"],
        t["reference_id"],
        t["is_conflicting"],
        t["conflict_details"]
    ))
print(f"Seeded {len(timeline_items)} timeline events for Rahul Sharma (483027156)!")

# 3. Seed Recorded Medicines for Rahul Sharma
medicines = [
    {
        "name": "Metformin Hydrochloride",
        "strength": "500 mg",
        "status": "ACTIVE",
        "indication": "Type 2 Diabetes Glycemic Control",
        "frequency": "Twice daily after meals",
        "route": "Oral",
        "start_date": "2026-09-10",
        "end_date": None,
        "doctor": "Dr. Priya Deshmukh",
        "reference_id": "HMS-PRESCRIPTION-2026-0910",
        "is_conflicting": True,
        "conflict_details": "Conflicting information detected — Hospital HMS record is shown as the higher-priority source. The patient-entered record has been retained for history.",
        "source": "Hospital HMS",
        "reliability": "High",
        "verification_status": "Hospital Verified"
    },
    {
        "name": "Telmisartan",
        "strength": "40 mg",
        "status": "ACTIVE",
        "indication": "Hypertension Management",
        "frequency": "Once daily in the morning",
        "route": "Oral",
        "start_date": "2023-03-25",
        "end_date": None,
        "doctor": "Dr. Priya Deshmukh",
        "reference_id": "HMS-OPD-2023-0322-RX",
        "is_conflicting": False,
        "conflict_details": None,
        "source": "Hospital HMS",
        "reliability": "High",
        "verification_status": "Hospital Verified"
    },
    {
        "name": "Glimepiride",
        "strength": "1 mg",
        "status": "DISCONTINUED",
        "indication": "Type 2 Diabetes (Replaced by Metformin titration)",
        "frequency": "Once daily before breakfast",
        "route": "Oral",
        "start_date": "2024-01-10",
        "end_date": "2026-08-15",
        "doctor": "Dr. Arvind Saxena",
        "reference_id": "MAX-ENDO-2024-0110",
        "is_conflicting": False,
        "conflict_details": None,
        "source": "Hospital HMS",
        "reliability": "High",
        "verification_status": "Hospital Verified"
    },
    {
        "name": "Amlodipine",
        "strength": "5 mg",
        "status": "DISCONTINUED",
        "indication": "Mild Hypertension (Switched to Telmisartan)",
        "frequency": "Once daily in the morning",
        "route": "Oral",
        "start_date": "2022-06-05",
        "end_date": "2023-03-25",
        "doctor": "Dr. R. K. Gupta",
        "reference_id": "APOLLO-HTN-2022-06",
        "is_conflicting": False,
        "conflict_details": None,
        "source": "Hospital HMS",
        "reliability": "High",
        "verification_status": "Hospital Verified"
    }
]

for m in medicines:
    cur.execute("""
        INSERT INTO patient_medications
        (patient_id, user_id, name, strength, status, indication, frequency, route, start_date, end_date, doctor, reference_id, is_conflicting, conflict_details, source, reliability, verification_status)
        VALUES (%s, 1, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    """, (
        '483027156',
        m["name"],
        m["strength"],
        m["status"],
        m["indication"],
        m["frequency"],
        m["route"],
        m["start_date"],
        m["end_date"],
        m["doctor"],
        m["reference_id"],
        m["is_conflicting"],
        m["conflict_details"],
        m["source"],
        m["reliability"],
        m["verification_status"]
    ))
print(f"Seeded {len(medicines)} patient medications for Rahul Sharma (483027156)!")

conn.close()
print("All timeline and medicines data seeded into Supabase successfully!")
