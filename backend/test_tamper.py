"""Quick test: login, store evidence, verify original, verify tampered."""
import sys, os
os.environ["PYTHONIOENCODING"] = "utf-8"
import requests, json

BASE = "http://localhost:8000"

# 1) Login
r = requests.post(f"{BASE}/api/auth/login", json={"badge_id": "admin@crimenet.gov.in", "password": "Admin@123"})
data = r.json()
token = data.get("data", {}).get("access_token", "")
print("1. Login:", "OK" if token else "FAILED")

headers = {"Authorization": f"Bearer {token}"}

# 2) Store evidence
evidence_text = "FIR No: 2026/MH/4817 - Rajesh Kumar Sharma was robbed near DN Nagar Metro"
r = requests.post(f"{BASE}/api/blockchain/tamper-demo/store", 
    json={"evidence_text": evidence_text, "case_label": "TEST-001"},
    headers=headers)
store = r.json()
print("2. Store:", store.get("message", "?"))
eid = store.get("data", {}).get("evidence_id", "")
sha = store.get("data", {}).get("sha256", "")
print("   Evidence ID:", eid)
print("   SHA-256:", sha[:32] + "...")

# 3) Verify original (should be INTACT)
r = requests.post(f"{BASE}/api/blockchain/tamper-demo/verify",
    json={"evidence_id": eid, "evidence_text": evidence_text},
    headers=headers)
verify1 = r.json()
d1 = verify1.get("data", {})
integrity1 = d1.get("integrity", "?")
print("3. Verify Original:", integrity1)

# 4) Tamper and verify (should be TAMPERED)
tampered = evidence_text.replace("Sharma", "Verma")
r = requests.post(f"{BASE}/api/blockchain/tamper-demo/verify",
    json={"evidence_id": eid, "evidence_text": tampered},
    headers=headers)
verify2 = r.json()
d2 = verify2.get("data", {})
integrity2 = d2.get("integrity", "?")
print("4. Verify Tampered:", integrity2)
if d2.get("diff"):
    print("   Bits changed:", d2["diff"].get("bits_changed", "?"))

if integrity1 == "INTACT" and integrity2 == "TAMPERED":
    print("\n=== ALL TESTS PASSED ===")
else:
    print("\n=== SOME TESTS FAILED ===")
    print("  Expected: INTACT + TAMPERED, Got:", integrity1, "+", integrity2)
