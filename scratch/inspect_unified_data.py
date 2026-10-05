import urllib.request
import json

jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoicmFodWwuc2hhcm1hQGV4YW1wbGUuY29tIiwibmFtZSI6IlJhaHVsIFNoYXJtYSIsImlhdCI6MTc5MTEyNTc5NSwiZXhwIjoxNzkxNzMwNTk1fQ.GQqUJVwTFcCM45qS1S11Ab8yiZuSFxYnhBwVDOlUvS0"
headers = {
    "Authorization": f"Bearer {jwt}",
    "Content-Type": "application/json"
}

req = urllib.request.Request("http://localhost:3000/api/patient/medicines", headers=headers)
with urllib.request.urlopen(req) as resp:
    meds = json.loads(resp.read().decode())
    print("=== RECORDED MEDICINES ===")
    print(f"Total: {meds.get('total')}, Active: {meds.get('activeCount')}, Historical: {meds.get('historicalCount')}, Conflicts: {meds.get('conflictsCount')}")
    for m in meds.get("medicines", []):
        print(f"- {m.get('name')} | Strength: {m.get('strength')} | Status: {m.get('status')} | Conflict: {m.get('is_conflicting')} | Source: {m.get('source')} | Doctor: {m.get('doctor')}")

req = urllib.request.Request("http://localhost:3000/api/patient/timeline", headers=headers)
with urllib.request.urlopen(req) as resp:
    tl = json.loads(resp.read().decode())
    print("\n=== TIMELINE EVENTS ===")
    print(f"Total: {tl.get('total')}, Conflicts: {tl.get('conflictsCount')}")
    for ev in tl.get("events", [])[:10]:
        print(f"[{ev.get('event_date')}] {ev.get('category')} | {ev.get('title')} | Conflicting: {ev.get('is_conflicting')}")
