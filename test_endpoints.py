import sys
import os
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'src')))

from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_endpoints():
    print("Testing /simulate/presets...")
    resp = client.get("/simulate/presets")
    print(f"Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"Error: {resp.text}")

    print("\nTesting /categoriser/review-queue...")
    resp = client.get("/categoriser/review-queue")
    print(f"Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"Error: {resp.text}")

    print("\nTesting /categoriser/correct...")
    resp = client.post("/categoriser/correct", json={
        "tx_id": "0",
        "corrected_category": "Food & Dining"
    })
    print(f"Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"Error: {resp.text}")

    print("\nTesting /calibration...")
    resp = client.get("/calibration")
    print(f"Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"Error: {resp.text}")

    print("\nTesting /transactions...")
    resp = client.post("/transactions", json={
        "narration": "TEST NEW TRANSACTION",
        "amount": 500.0,
        "date": "2023-10-01",
        "tx_type": "debit",
        "account_type": "bank"
    })
    print(f"Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"Error: {resp.text}")

    print("\nTesting /agent/chat...")
    resp = client.post("/agent/chat", json={
        "message": "Can I afford a Rs 80,000 laptop?"
    })
    print(f"Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"Error: {resp.text}")

    print("\nTesting /twin/benchmark...")
    resp = client.get("/twin/benchmark")
    print(f"Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"Error: {resp.text}")

    print("\nTesting /optimize...")
    resp = client.post("/optimize", json={
      "target_amount": 50000,
      "target_months": 4,
      "max_shortfall_prob": 0.1
    })
    print(f"Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"Error: {resp.text}")

if __name__ == "__main__":
    test_endpoints()
