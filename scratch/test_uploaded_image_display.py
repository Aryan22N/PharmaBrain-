import urllib.request
import json
import os

BASE_URL = "http://localhost:3000"

def test_uploaded_image_in_summary():
    print("=================================================================")
    print("TEST: Upload Image & Verify Display in Patient Summary")
    print("=================================================================")

    # 1. Login as Dr. Ananya Iyer
    login_payload = json.dumps({
        "email": "ananya.iyer@apollohospitals.org",
        "password": "SecurePassword#2026"
    }).encode("utf-8")
    login_req = urllib.request.Request(
        f"{BASE_URL}/api/auth/login",
        data=login_payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(login_req) as resp:
        auth_data = json.loads(resp.read().decode("utf-8"))
    
    token = auth_data["token"]
    patient_id = auth_data["user"]["patientId"]
    print(f"Logged in as patientId: {patient_id}")

    # 2. Upload prescription image
    boundary = "----WebKitFormBoundaryImageUpload999"
    body_parts = []
    
    body_parts.append(f"--{boundary}\r\n".encode("utf-8"))
    body_parts.append(b'Content-Disposition: form-data; name="file"; filename="patient_scan_prescription.png"\r\n')
    body_parts.append(b'Content-Type: image/png\r\n\r\n')
    
    with open("scratch/test_rx.png", "rb") as f:
        png_bytes = f.read()
    body_parts.append(png_bytes)
    body_parts.append(b'\r\n')
    
    body_parts.append(f"--{boundary}\r\n".encode("utf-8"))
    body_parts.append(b'Content-Disposition: form-data; name="patient_id"\r\n\r\n')
    body_parts.append(patient_id.encode("utf-8"))
    body_parts.append(b'\r\n')

    body_parts.append(f"--{boundary}--\r\n".encode("utf-8"))
    body = b"".join(body_parts)

    upload_req = urllib.request.Request(
        f"{BASE_URL}/api/ocr",
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Authorization": f"Bearer {token}"
        }
    )

    print("Uploading prescription image...")
    with urllib.request.urlopen(upload_req) as resp:
        ocr_res = json.loads(resp.read().decode("utf-8"))
    
    uploaded_img_url = ocr_res.get("image_url")
    print(f"Upload success! image_url returned: {uploaded_img_url}")
    assert uploaded_img_url and uploaded_img_url.startswith("/uploads/"), f"Unexpected image_url: {uploaded_img_url}"

    # 3. Verify static file serving via Next.js
    img_req = urllib.request.Request(f"{BASE_URL}{uploaded_img_url}")
    with urllib.request.urlopen(img_req) as img_resp:
        assert img_resp.status == 200, f"Expected 200, got {img_resp.status}"
        img_data = img_resp.read()
        print(f"HTTP GET {uploaded_img_url} returned HTTP 200 OK! ({len(img_data)} bytes received)")

    # 4. Verify Patient Summary dashboard endpoint includes the image_url
    dash_req = urllib.request.Request(
        f"{BASE_URL}/api/user/dashboard",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(dash_req) as resp:
        dash_res = json.loads(resp.read().decode("utf-8"))

    latest_doc = dash_res["documents"][0]
    print(f"Latest document in Patient Summary: ID #{latest_doc['id']}, filename='{latest_doc['filename']}', imageUrl='{latest_doc['imageUrl']}'")
    assert latest_doc["imageUrl"] == uploaded_img_url, f"Expected {uploaded_img_url}, got {latest_doc['imageUrl']}"

    print("=================================================================")
    print("SUCCESS: Uploaded image is stored, served, and displayed in Patient Summary!")
    print("=================================================================")

if __name__ == "__main__":
    test_uploaded_image_in_summary()
