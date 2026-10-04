import urllib.request
import json
import sys

BASE_URL = "http://localhost:3000"

def run_test():
    print("=================================================================")
    print("STEP 1: Register New Patient with Unique 9-Digit ID")
    print("=================================================================")
    reg_payload = json.dumps({
        "name": "Dr. Ananya Iyer",
        "email": "ananya.iyer@apollohospitals.org",
        "password": "SecurePassword#2026"
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{BASE_URL}/api/auth/register",
        data=reg_payload,
        headers={"Content-Type": "application/json"}
    )
    
    try:
        with urllib.request.urlopen(req) as resp:
            reg_res = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        if e.code == 409:
            print("User already registered, logging in instead...")
            login_payload = json.dumps({
                "email": "ananya.iyer@apollohospitals.org",
                "password": "SecurePassword#2026"
            }).encode("utf-8")
            login_req = urllib.request.Request(
                f"{BASE_URL}/api/auth/login",
                data=login_payload,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(login_req) as l_resp:
                reg_res = json.loads(l_resp.read().decode("utf-8"))
        else:
            print(f"FAILED (HTTP {e.code}): {body}")
            sys.exit(1)

    print("Authentication Response:")
    print(json.dumps(reg_res["user"], indent=2))
    
    token = reg_res["token"]
    patient_id = reg_res["user"]["patientId"]
    
    # Assert 9-digit format
    assert len(patient_id) == 9, f"Expected 9 digits, got {len(patient_id)} ({patient_id})"
    assert patient_id.isdigit(), f"Expected numeric string, got {patient_id}"
    print(f"SUCCESS: Generated 9-Digit Patient ID: {patient_id}")

    print("\n=================================================================")
    print("STEP 2: Verify /api/auth/me Profile and ID Integrity")
    print("=================================================================")
    me_req = urllib.request.Request(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(me_req) as resp:
        me_res = json.loads(resp.read().decode("utf-8"))
    print(json.dumps(me_res, indent=2))
    assert me_res["user"]["patientId"] == patient_id
    print("SUCCESS: /api/auth/me confirmed 9-digit ID match.")

    print("\n=================================================================")
    print("STEP 3: Verify Strict Patient Data Isolation on Dashboard")
    print("=================================================================")
    dash_req = urllib.request.Request(
        f"{BASE_URL}/api/user/dashboard",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(dash_req) as resp:
        dash_res = json.loads(resp.read().decode("utf-8"))

    doc_count = len(dash_res.get("documents", []))
    print(f"New Patient Dashboard Metrics: {dash_res.get('metrics')}")
    print(f"New Patient Document Count: {doc_count}")
    assert doc_count == 0, f"DATA LEAK DETECTED! Expected 0 documents for new user, got {doc_count}"
    print("SUCCESS: Patient Data Isolation strictly verified (0 documents for new patient).")

    print("\n=================================================================")
    print("STEP 4: Verify Existing Patient (Rahul Sharma) Data Preservation")
    print("=================================================================")
    rahul_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoicmFodWwuc2hhcm1hQGV4YW1wbGUuY29tIiwibmFtZSI6IlJhaHVsIFNoYXJtYSIsImlhdCI6MTc5MTEyNTc5NSwiZXhwIjoxNzkxNzMwNTk1fQ.GQqUJVwTFcCM45qS1S11Ab8yiZuSFxYnhBwVDOlUvS0"
    rahul_req = urllib.request.Request(
        f"{BASE_URL}/api/user/dashboard",
        headers={"Authorization": f"Bearer {rahul_token}"}
    )
    with urllib.request.urlopen(rahul_req) as resp:
        rahul_res = json.loads(resp.read().decode("utf-8"))

    rahul_docs = len(rahul_res.get("documents", []))
    print(f"Rahul Sharma User: {rahul_res.get('user')}")
    print(f"Rahul Sharma Document Count: {rahul_docs}")
    print(f"Rahul Sharma Metrics: {rahul_res.get('metrics')}")
    assert rahul_docs >= 14, f"Expected at least 14 documents for Rahul Sharma, got {rahul_docs}"
    assert rahul_res["user"]["patientId"] == "483027156", "Expected 483027156"
    assert rahul_res["user"]["legacyPatientId"] == "CCM12578", "Expected CCM12578"
    print("SUCCESS: Rahul Sharma's 14 historical records & dual IDs preserved perfectly!")

    print("\n=================================================================")
    print("ALL ACCEPTANCE CRITERIA PASSED!")
    print("=================================================================")

if __name__ == "__main__":
    run_test()
