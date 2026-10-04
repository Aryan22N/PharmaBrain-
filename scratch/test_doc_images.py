import urllib.request
import json

rahul_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoicmFodWwuc2hhcm1hQGV4YW1wbGUuY29tIiwibmFtZSI6IlJhaHVsIFNoYXJtYSIsImlhdCI6MTc5MTEyNTc5NSwiZXhwIjoxNzkxNzMwNTk1fQ.GQqUJVwTFcCM45qS1S11Ab8yiZuSFxYnhBwVDOlUvS0'

req = urllib.request.Request('http://localhost:3000/api/user/dashboard', headers={'Authorization': f'Bearer {rahul_token}'})
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode('utf-8'))

docs = data.get('documents', [])
print(f'Total docs: {len(docs)}')
for d in docs[:5]:
    print(f"Doc #{d['id']}: filename='{d['filename']}', status='{d['status']}', imageUrl='{d.get('imageUrl')}'")
