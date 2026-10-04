import os
import json
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "model", ".env")
load_dotenv(_env_path)
load_dotenv()
raw_url = os.environ.get("DATABASE_URL", "").replace("postgresql://", "postgresql+psycopg2://")
if not raw_url:
    print("No DATABASE_URL found!")
    exit(1)

engine = create_engine(raw_url)

with engine.begin() as conn:
    # 1. Create User table if not exists
    conn.execute(text('''
        CREATE TABLE IF NOT EXISTS "User" (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            "passwordHash" VARCHAR(255) NOT NULL,
            "createdAt" VARCHAR(64) DEFAULT CURRENT_TIMESTAMP::text
        );
    '''))

    # 2. Create Document table if not exists
    conn.execute(text('''
        CREATE TABLE IF NOT EXISTS "Document" (
            id SERIAL PRIMARY KEY,
            "userId" INTEGER,
            "originalName" VARCHAR(255) NOT NULL,
            "storedFilename" VARCHAR(255),
            "documentType" VARCHAR(64) DEFAULT 'PRESCRIPTION',
            "mimeType" VARCHAR(64) DEFAULT 'image/jpeg',
            "filePath" VARCHAR(255),
            status VARCHAR(64) DEFAULT 'CONFIRMED',
            "uploadedAt" VARCHAR(64) DEFAULT CURRENT_TIMESTAMP::text
        );
    '''))

    # 3. Create Analysis table if not exists
    conn.execute(text('''
        CREATE TABLE IF NOT EXISTS "Analysis" (
            id SERIAL PRIMARY KEY,
            "documentId" INTEGER REFERENCES "Document"(id) ON DELETE CASCADE,
            summary TEXT,
            "structuredResult" JSONB,
            "isDemo" BOOLEAN DEFAULT false,
            "createdAt" VARCHAR(64) DEFAULT CURRENT_TIMESTAMP::text
        );
    '''))

    # 4. Ensure User Rahul Sharma exists
    hashed = "$2b$10$J65hBcUjNyvmOrjDUELC4eISq8IUsiFatGUrLsJfk6iOcgw3Nj26i"
    conn.execute(text('''
        INSERT INTO "User" (id, name, email, "passwordHash", "createdAt")
        VALUES (1, 'Rahul Sharma', 'rahul.sharma@example.com', :hash, '2026-08-01T10:00:00Z')
        ON CONFLICT (email) DO UPDATE SET name = 'Rahul Sharma';
    '''), {"hash": hashed})

    # Clear old seed documents for user 1 to guarantee exactly 14 records
    conn.execute(text('DELETE FROM "Document" WHERE "userId" = 1;'))

    records_to_seed = [
        {
            "name": "City Care Medical Centre - Cardiology Rx",
            "status": "CONFIRMED",
            "uploaded_at": "2026-09-13T11:30:00Z",
            "summary": "City Care Medical Centre (Dr. Neha Verma, Reg 65432). Prescribed: Metformin 500mg, Atorvastatin 10mg, Pantoprazole 40mg, Vitamin D3. BP: 128/82 mmHg.",
            "data": {
                "hospital": "City Care Medical Centre",
                "doctor": {"name": "Dr. Neha Verma", "reg_no": "65432"},
                "date_iso": "2026-09-13",
                "patient": {"name": "Rahul Sharma", "uhid": "CCM12578", "age": "34y", "sex": "M"},
                "vitals": [
                    {"name": "Blood Pressure", "value": "128/82", "unit": "mmHg"},
                    {"name": "Pulse Rate", "value": "76", "unit": "bpm"},
                    {"name": "Weight", "value": "72", "unit": "kg"}
                ],
                "medicines": [
                    {"name": "Metformin", "strength": "500 mg", "form": "Tablet", "frequency": "1-0-1", "duration": "30 days", "route": "Oral", "instructions": "Take after meals"},
                    {"name": "Atorvastatin", "strength": "10 mg", "form": "Tablet", "frequency": "0-0-1", "duration": "30 days", "route": "Oral", "instructions": "Take at bedtime"},
                    {"name": "Pantoprazole", "strength": "40 mg", "form": "Capsule", "frequency": "1-0-0", "duration": "14 days", "route": "Oral", "instructions": "Take 30 mins before breakfast"},
                    {"name": "Vitamin D3", "strength": "60,000 IU", "form": "Capsule", "frequency": "Once weekly", "duration": "8 weeks", "route": "Oral", "instructions": "Take with milk"}
                ],
                "diagnosis": "Type 2 Diabetes Mellitus, Mild Hyperlipidemia",
                "allergies": "No Known Drug Allergies (NKDA)",
                "advice": "Diabetic diet counselling. Low saturated fat and low sodium. 30 minutes daily brisk walk.",
                "follow_up": "Review after 4 weeks with fasting blood glucose and lipid panel."
            }
        },
        {
            "name": "Max Super Speciality Hospital - Endocrinology",
            "status": "CONFIRMED",
            "uploaded_at": "2026-08-15T09:45:00Z",
            "summary": "Max Super Speciality Hospital (Dr. Arvind Saxena, Reg 41829). HbA1c Lab review: 8.1% (Elevated glycemic control). Adjusted Metformin to 1000 mg oral.",
            "data": {
                "hospital": "Max Super Speciality Hospital",
                "doctor": {"name": "Dr. Arvind Saxena", "reg_no": "41829"},
                "date_iso": "2026-08-15",
                "patient": {"name": "Rahul Sharma", "uhid": "CCM12578", "age": "34y", "sex": "M"},
                "vitals": [
                    {"name": "HbA1c", "value": "8.1", "unit": "%"},
                    {"name": "Fasting Blood Sugar", "value": "154", "unit": "mg/dL"},
                    {"name": "Post-prandial Glucose", "value": "210", "unit": "mg/dL"}
                ],
                "medicines": [
                    {"name": "Metformin", "strength": "1000 mg", "form": "Tablet", "frequency": "1-0-1", "duration": "60 days", "route": "Oral", "instructions": "Take twice daily after food"},
                    {"name": "Glimepiride", "strength": "1 mg", "form": "Tablet", "frequency": "1-0-0", "duration": "30 days", "route": "Oral", "instructions": "Take 15 mins before breakfast"}
                ],
                "diagnosis": "Uncontrolled Type 2 Diabetes with elevated HbA1c (8.1%)",
                "allergies": "Sulfa drugs (mild rash reported in 2021)",
                "advice": "Strict carbohydrate control, maintain log of self-monitored blood glucose (SMBG). Avoid refined sugars.",
                "follow_up": "HbA1c re-evaluation in 3 months."
            }
        },
        {
            "name": "Apollo Clinic - Internal Medicine Follow-up",
            "status": "CONFIRMED",
            "uploaded_at": "2026-07-22T14:15:00Z",
            "summary": "Apollo Clinic (Dr. R. K. Gupta, Reg 28914). Blood Pressure 146/92 mmHg (Stage 1 Hypertension). Advised salt restriction & Amlodipine 5mg.",
            "data": {
                "hospital": "Apollo Clinic",
                "doctor": {"name": "Dr. R. K. Gupta", "reg_no": "28914"},
                "date_iso": "2026-07-22",
                "patient": {"name": "Rahul Sharma", "uhid": "CCM12578", "age": "34y", "sex": "M"},
                "vitals": [
                    {"name": "Blood Pressure", "value": "146/92", "unit": "mmHg"},
                    {"name": "Pulse Rate", "value": "78", "unit": "bpm"},
                    {"name": "SpO2", "value": "98", "unit": "%"}
                ],
                "medicines": [
                    {"name": "Amlodipine", "strength": "5 mg", "form": "Tablet", "frequency": "0-1-0", "duration": "30 days", "route": "Oral", "instructions": "Take daily in the afternoon"}
                ],
                "diagnosis": "Stage 1 Essential Hypertension",
                "allergies": "No Known Drug Allergies (NKDA)",
                "advice": "DASH diet (Dietary Approaches to Stop Hypertension), dietary sodium < 2g/day, stress management.",
                "follow_up": "Blood pressure check in 2 weeks."
            }
        },
        {
            "name": "Fortis Healthcare - Comprehensive Metabolic Panel",
            "status": "CONFIRMED",
            "uploaded_at": "2026-06-10T08:30:00Z",
            "summary": "Fortis Healthcare (Dr. Sunita Kapoor). Fasting Blood Sugar: 142 mg/dL. Total Cholesterol: 218 mg/dL. LDL: 138 mg/dL. Triglycerides: 172 mg/dL.",
            "data": {
                "hospital": "Fortis Healthcare Laboratories",
                "doctor": {"name": "Dr. Sunita Kapoor (Pathologist)", "reg_no": "33102"},
                "date_iso": "2026-06-10",
                "patient": {"name": "Rahul Sharma", "uhid": "CCM12578", "age": "34y", "sex": "M"},
                "vitals": [
                    {"name": "Fasting Blood Sugar", "value": "142", "unit": "mg/dL"},
                    {"name": "Total Cholesterol", "value": "218", "unit": "mg/dL"},
                    {"name": "LDL Cholesterol", "value": "138", "unit": "mg/dL"},
                    {"name": "Triglycerides", "value": "172", "unit": "mg/dL"},
                    {"name": "Serum Creatinine", "value": "0.92", "unit": "mg/dL"}
                ],
                "medicines": [],
                "diagnosis": "Dyslipidemia with Impaired Fasting Glucose",
                "allergies": "No Known Drug Allergies (NKDA)",
                "advice": "Initiate lipid-lowering therapy and dietary lifestyle modifications.",
                "follow_up": "Repeat lipid profile after 8 weeks."
            }
        },
        {
            "name": "Medanta Heart Institute - Baseline ECG & 2D Echo",
            "status": "CONFIRMED",
            "uploaded_at": "2026-05-18T10:00:00Z",
            "summary": "Medanta Heart Institute (Dr. Rajesh Trehan). Resting Heart Rate: 76 bpm. Normal sinus rhythm, preserved LVEF 60%. Mild concentric LVH noted.",
            "data": {
                "hospital": "Medanta Heart Institute",
                "doctor": {"name": "Dr. Rajesh Trehan (Cardiologist)", "reg_no": "19405"},
                "date_iso": "2026-05-18",
                "patient": {"name": "Rahul Sharma", "uhid": "CCM12578", "age": "34y", "sex": "M"},
                "vitals": [
                    {"name": "Resting Heart Rate", "value": "76", "unit": "bpm"},
                    {"name": "LVEF", "value": "60", "unit": "%"},
                    {"name": "Blood Pressure", "value": "134/86", "unit": "mmHg"}
                ],
                "medicines": [
                    {"name": "Aspirin", "strength": "75 mg", "form": "Tablet", "frequency": "0-1-0", "duration": "60 days", "route": "Oral", "instructions": "Take with lunch"}
                ],
                "diagnosis": "Mild Concentric Left Ventricular Hypertrophy, Preserved Ejection Fraction (60%)",
                "allergies": "No Known Drug Allergies (NKDA)",
                "advice": "Optimize blood pressure management to prevent progression of LVH.",
                "follow_up": "Annual echocardiogram review."
            }
        },
        {
            "name": "City Care Medical Centre - Initial Consultation",
            "status": "CONFIRMED",
            "uploaded_at": "2026-04-05T12:00:00Z",
            "summary": "City Care Medical Centre (Dr. Neha Verma). Baseline vitals: BP 142/90 mmHg, Pulse 80/min, Temp 98.6°F. Started lifestyle modification.",
            "data": {
                "hospital": "City Care Medical Centre",
                "doctor": {"name": "Dr. Neha Verma", "reg_no": "65432"},
                "date_iso": "2026-04-05",
                "patient": {"name": "Rahul Sharma", "uhid": "CCM12578", "age": "34y", "sex": "M"},
                "vitals": [
                    {"name": "Blood Pressure", "value": "142/90", "unit": "mmHg"},
                    {"name": "Pulse Rate", "value": "80", "unit": "bpm"},
                    {"name": "Temperature", "value": "98.6", "unit": "°F"},
                    {"name": "BMI", "value": "26.4", "unit": "kg/m²"}
                ],
                "medicines": [
                    {"name": "Metformin", "strength": "500 mg", "form": "Tablet", "frequency": "1-0-0", "duration": "30 days", "route": "Oral", "instructions": "Take morning with breakfast"}
                ],
                "diagnosis": "Newly Diagnosed Type 2 Diabetes, Overweight (BMI 26.4)",
                "allergies": "No Known Drug Allergies (NKDA)",
                "advice": "Structured weight reduction target of 5-7% over 6 months, medical nutrition therapy.",
                "follow_up": "Comprehensive blood testing and clinical review in 4 weeks."
            }
        },
        {
            "name": "Indraprastha Apollo - Annual Preventive Health Check",
            "status": "CONFIRMED",
            "uploaded_at": "2026-03-12T09:00:00Z",
            "summary": "Indraprastha Apollo Hospitals (Dr. Vikram Seth). Executive Health Screening: Complete blood count normal. Baseline serum creatinine: 0.9 mg/dL. eGFR > 90.",
            "data": {
                "hospital": "Indraprastha Apollo Hospitals",
                "doctor": {"name": "Dr. Vikram Seth", "reg_no": "52019"},
                "date_iso": "2026-03-12",
                "patient": {"name": "Rahul Sharma", "uhid": "CCM12578", "age": "34y", "sex": "M"},
                "vitals": [
                    {"name": "Serum Creatinine", "value": "0.9", "unit": "mg/dL"},
                    {"name": "eGFR", "value": ">90", "unit": "mL/min"},
                    {"name": "Uric Acid", "value": "5.4", "unit": "mg/dL"},
                    {"name": "Hemoglobin", "value": "14.8", "unit": "g/dL"}
                ],
                "medicines": [],
                "diagnosis": "Normal preventive health screening parameters; adequate renal clearance.",
                "allergies": "No Known Drug Allergies (NKDA)",
                "advice": "Maintain hydration (2.5L water daily), regular health surveillance.",
                "follow_up": "Annual follow-up screening."
            }
        },
        {
            "name": "Diagnostic Lab Report - Serum Electrolytes",
            "status": "PROCESSED",
            "uploaded_at": "2026-02-28T11:20:00Z",
            "summary": "Dr. Lal PathLabs (Dr. Alok Sen). Sodium: 140 mEq/L, Potassium: 4.3 mEq/L, Chloride: 101 mEq/L. Kidney function within normal reference range.",
            "data": {
                "hospital": "Dr. Lal PathLabs",
                "doctor": {"name": "Dr. Alok Sen (Biochemist)", "reg_no": "44710"},
                "date_iso": "2026-02-28",
                "patient": {"name": "Rahul Sharma", "uhid": "CCM12578", "age": "34y", "sex": "M"},
                "vitals": [
                    {"name": "Sodium", "value": "140", "unit": "mEq/L"},
                    {"name": "Potassium", "value": "4.3", "unit": "mEq/L"},
                    {"name": "Chloride", "value": "101", "unit": "mEq/L"},
                    {"name": "Bicarbonate", "value": "24", "unit": "mEq/L"}
                ],
                "medicines": [],
                "diagnosis": "Normal serum electrolyte homeostasis",
                "allergies": "No Known Drug Allergies (NKDA)",
                "advice": "Normal dietary electrolyte intake.",
                "follow_up": "As clinically indicated."
            }
        },
        {
            "name": "Thyroid Profile (TSH, Free T3, Free T4)",
            "status": "PROCESSED",
            "uploaded_at": "2026-02-15T07:45:00Z",
            "summary": "Quest Diagnostics (Dr. Meenakshi Iyer). TSH: 2.45 uIU/mL (Euthyroid). Free T4: 1.15 ng/dL. Normal thyroid function confirmed.",
            "data": {
                "hospital": "Quest Diagnostics Reference Lab",
                "doctor": {"name": "Dr. Meenakshi Iyer", "reg_no": "38921"},
                "date_iso": "2026-02-15",
                "patient": {"name": "Rahul Sharma", "uhid": "CCM12578", "age": "34y", "sex": "M"},
                "vitals": [
                    {"name": "TSH", "value": "2.45", "unit": "uIU/mL"},
                    {"name": "Free T3", "value": "3.1", "unit": "pg/mL"},
                    {"name": "Free T4", "value": "1.15", "unit": "ng/dL"}
                ],
                "medicines": [],
                "diagnosis": "Euthyroid state; normal endocrine thyroid gland activity.",
                "allergies": "No Known Drug Allergies (NKDA)",
                "advice": "Routine thyroid monitoring every 12 months.",
                "follow_up": "Routine annual review."
            }
        },
        {
            "name": "Chest X-Ray PA View - Diagnostic Radiology",
            "status": "PROCESSED",
            "uploaded_at": "2026-01-20T15:30:00Z",
            "summary": "Mahajan Imaging (Dr. Harsh Vardhan). Lungs clear bilaterally. Normal cardiac silhouette. No pleural effusion or active focal consolidation.",
            "data": {
                "hospital": "Mahajan Imaging & Radiological Sciences",
                "doctor": {"name": "Dr. Harsh Vardhan (Radiologist)", "reg_no": "17823"},
                "date_iso": "2026-01-20",
                "patient": {"name": "Rahul Sharma", "uhid": "CCM12578", "age": "34y", "sex": "M"},
                "vitals": [
                    {"name": "Cardiac Silhouette", "value": "Normal", "unit": ""},
                    {"name": "Pulmonary Fields", "value": "Clear bilaterally", "unit": ""}
                ],
                "medicines": [],
                "diagnosis": "Normal posteroanterior chest radiograph. No active pulmonary parenchymal lesions or pleural effusion.",
                "allergies": "No Known Drug Allergies (NKDA)",
                "advice": "No further radiological intervention required at present.",
                "follow_up": "As clinically indicated."
            }
        },
        {
            "name": "Ultrasound Whole Abdomen Screening",
            "status": "PROCESSED",
            "uploaded_at": "2025-12-05T10:15:00Z",
            "summary": "Max Diagnostic Ultrasound (Dr. Priya Sengupta). Mild Grade 1 fatty liver changes. Normal gallbladder, pancreas, spleen, and kidneys bilaterally.",
            "data": {
                "hospital": "Max Diagnostic Ultrasound Centre",
                "doctor": {"name": "Dr. Priya Sengupta (Sonologist)", "reg_no": "46108"},
                "date_iso": "2025-12-05",
                "patient": {"name": "Rahul Sharma", "uhid": "CCM12578", "age": "34y", "sex": "M"},
                "vitals": [
                    {"name": "Liver Span", "value": "14.2", "unit": "cm"},
                    {"name": "Fatty Infiltration", "value": "Grade 1", "unit": ""}
                ],
                "medicines": [],
                "diagnosis": "Mild Grade 1 Hepatic Steatosis (Fatty Liver). Other abdominal organs within normal morphological limits.",
                "allergies": "No Known Drug Allergies (NKDA)",
                "advice": "Low-lipid diet, avoid refined carbohydrates, aerobic physical workouts.",
                "follow_up": "Repeat ultrasonography in 12 months."
            }
        },
        {
            "name": "Ophthalmology Fundus Screening Report",
            "status": "PROCESSED",
            "uploaded_at": "2025-11-18T16:00:00Z",
            "summary": "Centre for Sight (Dr. Sanjay Bhatt). Dilated fundus examination: No diabetic retinopathy. Macula healthy bilaterally. Intraocular pressure normal.",
            "data": {
                "hospital": "Centre for Sight Eye Institute",
                "doctor": {"name": "Dr. Sanjay Bhatt (Ophthalmologist)", "reg_no": "29431"},
                "date_iso": "2025-11-18",
                "patient": {"name": "Rahul Sharma", "uhid": "CCM12578", "age": "34y", "sex": "M"},
                "vitals": [
                    {"name": "IOP (OD)", "value": "14", "unit": "mmHg"},
                    {"name": "IOP (OS)", "value": "15", "unit": "mmHg"},
                    {"name": "Cup-to-Disc Ratio", "value": "0.3", "unit": ""}
                ],
                "medicines": [
                    {"name": "Refresh Tears Lubricant", "strength": "0.5%", "form": "Eye Drops", "frequency": "1 drop thrice daily", "duration": "30 days", "route": "Ophthalmic", "instructions": "Instill into both eyes as needed"}
                ],
                "diagnosis": "Normal bilateral retinal funduscopy. No signs of diabetic retinopathy or hypertensive retinopathy.",
                "allergies": "No Known Drug Allergies (NKDA)",
                "advice": "Eye protection during screen work, follow 20-20-20 rule.",
                "follow_up": "Annual dilated fundus evaluation."
            }
        },
        {
            "name": "Urine Microalbumin & Creatinine Ratio",
            "status": "PROCESSED",
            "uploaded_at": "2025-10-10T08:15:00Z",
            "summary": "SRL Diagnostics (Dr. Deepak Nair). Microalbuminuria negative (ACR: 14 mg/g). Normal renal filtration without protein leakage.",
            "data": {
                "hospital": "SRL Diagnostics Speciality Unit",
                "doctor": {"name": "Dr. Deepak Nair", "reg_no": "51240"},
                "date_iso": "2025-10-10",
                "patient": {"name": "Rahul Sharma", "uhid": "CCM12578", "age": "34y", "sex": "M"},
                "vitals": [
                    {"name": "Albumin-to-Creatinine Ratio (ACR)", "value": "14", "unit": "mg/g"},
                    {"name": "Urinary Albumin", "value": "1.2", "unit": "mg/dL"},
                    {"name": "Urinary Creatinine", "value": "85", "unit": "mg/dL"}
                ],
                "medicines": [],
                "diagnosis": "Normoalbuminuria (ACR < 30 mg/g). Preserved glomerular capillary barrier without microvascular leakage.",
                "allergies": "No Known Drug Allergies (NKDA)",
                "advice": "Strict blood pressure and glycemic control to protect renal microvasculature.",
                "follow_up": "Repeat annual microalbuminuria check."
            }
        },
        {
            "name": "gpt pres.jpeg - Handwritten Prescription Draft",
            "status": "PROCESSED",
            "uploaded_at": "2026-10-04T14:48:00Z",
            "summary": "Extraction #4: City Care Medical Centre prescription extracted via PaddleOCR & Gemini 3.5 Flash.",
            "data": {
                "hospital": "City Care Medical Centre",
                "doctor": {"name": "Dr. Neha Verma", "reg_no": "65432"},
                "date_iso": "2026-10-04",
                "patient": {"name": "Rahul Sharma", "uhid": "CCM12578", "age": "34y", "sex": "M"},
                "vitals": [
                    {"name": "Blood Pressure", "value": "128/82", "unit": "mmHg"},
                    {"name": "Pulse Rate", "value": "76", "unit": "bpm"}
                ],
                "medicines": [
                    {"name": "Metformin", "strength": "500 mg", "form": "Tablet", "frequency": "1-0-1", "duration": "30 days", "route": "Oral", "instructions": "Take twice daily after meals"},
                    {"name": "Atorvastatin", "strength": "10 mg", "form": "Tablet", "frequency": "0-0-1", "duration": "30 days", "route": "Oral", "instructions": "Take once daily at bedtime"},
                    {"name": "Pantoprazole", "strength": "40 mg", "form": "Capsule", "frequency": "1-0-0", "duration": "14 days", "route": "Oral", "instructions": "Take before breakfast"}
                ],
                "diagnosis": "Type 2 Diabetes Mellitus, Essential Hypertension Stage 1",
                "allergies": "No Known Drug Allergies (NKDA)",
                "advice": "Continue prescribed oral therapies. Maintain low sodium and diabetic diet.",
                "follow_up": "Review after 1 month."
            }
        }
    ]

    for item in records_to_seed:
        name = item["name"]
        status = item["status"]
        uploaded_at = item["uploaded_at"]
        summary = item["summary"]
        data = item["data"]

        res = conn.execute(text('''
            INSERT INTO "Document" ("userId", "originalName", "storedFilename", "documentType", "mimeType", "filePath", status, "uploadedAt")
            VALUES (1, :name, :name, 'PRESCRIPTION', 'image/jpeg', :path, :status, :uploaded_at)
            RETURNING id;
        '''), {
            "name": name,
            "path": f"/uploads/{name.replace(' ', '_').lower()}.jpg",
            "status": status,
            "uploaded_at": uploaded_at
        })
        d_id = res.scalar()
        conn.execute(text('''
            INSERT INTO "Analysis" ("documentId", summary, "structuredResult", "isDemo", "createdAt")
            VALUES (:d_id, :summary, CAST(:result AS jsonb), false, :uploaded_at);
        '''), {
            "d_id": d_id,
            "summary": summary,
            "result": json.dumps(data),
            "uploaded_at": uploaded_at
        })

    # Seed historical HbA1c (8.1%)
    conn.execute(text('''
        INSERT INTO observations (patient_id, obs_date, kind, value, unit, raw_text, created_at)
        VALUES ('CCM12578', '2026-08-15', 'hba1c', 8.1, '%', 'HbA1c 8.1% (Elevated)', '2026-08-15T09:45:00Z')
        ON CONFLICT DO NOTHING;
    '''))

    # Seed historical BP (146/92)
    conn.execute(text('''
        INSERT INTO observations (patient_id, obs_date, kind, systolic, diastolic, unit, raw_text, created_at)
        VALUES ('CCM12578', '2026-07-22', 'bp', 146.0, 92.0, 'mmHg', 'BP 146/92 mmHg', '2026-07-22T14:15:00Z')
        ON CONFLICT DO NOTHING;
    '''))

print("Seeded Neon DMR with complete clinical summary objects! Total records: 14")
