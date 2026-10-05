import urllib.request
import json

jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoicmFodWwuc2hhcm1hQGV4YW1wbGUuY29tIiwibmFtZSI6IlJhaHVsIFNoYXJtYSIsImlhdCI6MTc5MTEyNTc5NSwiZXhwIjoxNzkxNzMwNTk1fQ.GQqUJVwTFcCM45qS1S11Ab8yiZuSFxYnhBwVDOlUvS0"
headers = {
    "Authorization": f"Bearer {jwt}",
    "Content-Type": "application/json"
}

# 1. Test Dashboard
req = urllib.request.Request("http://localhost:3000/api/user/dashboard", headers=headers)
with urllib.request.urlopen(req) as resp:
    dash = json.loads(resp.read().decode())
    print("Dashboard success:", dash.get("success"))
    print("User Patient ID:", dash.get("user", {}).get("patientId"))
    print("Timeline events count:", len(dash.get("timelineEvents", [])))
    print("Medicines count:", len(dash.get("recordedMedicines", [])))

# 2. Test Timeline GET
req = urllib.request.Request("http://localhost:3000/api/patient/timeline", headers=headers)
with urllib.request.urlopen(req) as resp:
    tl = json.loads(resp.read().decode())
    print("Timeline API count:", len(tl.get("timelineEvents", [])))

# 3. Test Medicines GET
req = urllib.request.Request("http://localhost:3000/api/patient/medicines", headers=headers)
with urllib.request.urlopen(req) as resp:
    meds = json.loads(resp.read().decode())
    print("Medicines API count:", len(meds.get("medicines", [])))

# 4. Test Add Timeline Note (POST)
payload = json.dumps({
    "event_date": "2026-10-04",
    "category": "Symptom Report",
    "title": "Patient Symptom Note: Mild Dizziness",
    "description": "Patient reported slight dizziness in late morning after breakfast.",
    "source": "Manual Entry",
    "facility": "Patient Home Portal",
    "doctor": "Rahul Sharma (Patient Self-Report)",
    "reliability": "Low",
    "verification_status": "Patient Confirmed",
    "reference_id": "PATIENT-SYMPTOM-20261004"
}).encode('utf-8')
req = urllib.request.Request("http://localhost:3000/api/patient/timeline", data=payload, headers=headers, method="POST")
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode())
    print("Add Timeline POST success:", res.get("success"), "Event ID:", res.get("event", {}).get("id"))

# 5. Test Add Medicine (POST)
payload_med = json.dumps({
    "name": "Atorvastatin Calcium",
    "strength": "20 mg",
    "status": "ACTIVE",
    "indication": "Hyperlipidemia / Cholesterol Control",
    "frequency": "Once daily at bedtime",
    "route": "Oral",
    "start_date": "2026-10-04",
    "doctor": "Dr. Priya Deshmukh",
    "reference_id": "HMS-PRESCRIPTION-2026-1004",
    "source": "Hospital HMS",
    "reliability": "High",
    "verification_status": "Hospital Verified"
}).encode('utf-8')
req = urllib.request.Request("http://localhost:3000/api/patient/medicines", data=payload_med, headers=headers, method="POST")
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode())
    print("Add Medicine POST success:", res.get("success"), "Medicine ID:", res.get("medicine", {}).get("id"))
