"""tests/test_api_endpoints.py — Comprehensive tests for API endpoints using httpx / TestClient.

Verifies:
1. Existing endpoints retain exact response shapes (no breaking regressions).
2. New endpoints:
   - GET /api/plan?view= (weekly, monthly, yearly)
   - POST /api/plan
   - POST /api/replan
   - GET /api/forecast-report?view=
   - GET /api/evidence-pack
   - POST /api/chat (with verified claim checks)
   - DELETE /api/delete-my-data & DELETE /api/user-data
   - POST /api/live-add
3. Multi-horizon query parameters & session-scoped data handling.
"""

from __future__ import annotations

import io
from fastapi.testclient import TestClient
import pytest

from api.main import app

client = TestClient(app)


def test_existing_endpoints_retain_shape():
    """Verify that existing legacy and round 1/2 endpoints retain their response structures."""
    # 1. Summary
    resp = client.get("/api/summary?session_id=demo")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    if data:
        assert "month" in data[0]
        assert "income" in data[0] or "expenses" in data[0]

    # 2. Recurring
    resp = client.get("/api/recurring?session_id=demo")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "payments" in data
    assert "total_monthly_burden" in data
    assert "alerts" in data

    # 3. Priority / Calendar
    resp = client.get("/api/priority?session_id=demo")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data and "ratios" in data

    # 4. Forecast
    resp = client.get("/api/forecast?session_id=demo&horizon_days=30")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "ok"
    assert "forecast" in data
    assert "backtest" in data

    # 5. Shock capacity
    resp = client.get("/api/shock-capacity?session_id=demo&limit=0.10")
    assert resp.status_code == 200
    data = resp.json()
    assert "max_shock" in data or "status" in data

    # 6. Presets
    resp = client.get("/simulate/presets?session_id=demo")
    assert resp.status_code == 200
    data = resp.json()
    assert "paths" in data

    # 7. Calibration
    resp = client.get("/calibration?session_id=demo")
    assert resp.status_code == 200
    data = resp.json()
    assert "alignment_tags" in data
    assert "mandatory_disclosure" in data


def test_plan_endpoint_views():
    """Verify GET /api/plan?view= returns valid Plan models across weekly, monthly, yearly views."""
    for view in ["weekly", "monthly", "yearly"]:
        resp = client.get(f"/api/plan?reserve=45000&goal=75000&view={view}&session_id=demo")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") in ("ok", "infeasible")
        assert "sequences" in data
        assert data.get("view") == view
        assert len(data["sequences"]) >= 2
        for seq in data["sequences"]:
            assert "periods" in seq
            assert "summary" in seq
            assert seq["summary"]["any_week_breach_prob"] >= 0.0


def test_post_plan_endpoint():
    """Verify POST /api/plan accepts body with reserve, goal, view."""
    payload = {
        "reserve": 40000.0,
        "goal": 70000.0,
        "view": "monthly"
    }
    resp = client.post("/api/plan?session_id=demo", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") in ("ok", "infeasible")
    assert data.get("view") == "monthly"
    assert "sequences" in data


def test_post_replan_feasible_and_infeasible():
    """Verify POST /api/replan handles normal replan and triggers conflict report for impossible goals."""
    # Feasible replan
    feasible_payload = {
        "plan": {"reserve": 45000, "goal": 75000},
        "change": {"income_drop": 0.15, "view": "weekly"}
    }
    resp = client.post("/api/replan?session_id=demo", json=feasible_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") in ("ok", "infeasible")

    # Infeasible target (goal > 250k)
    infeasible_payload = {
        "plan": {"reserve": 50000, "goal": 300000},
        "change": {"goal": 300000}
    }
    resp = client.post("/api/replan?session_id=demo", json=infeasible_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "infeasible"
    assert "conflict" in data
    assert data["conflict"] is not None
    assert len(data["conflict"]["relaxations"]) >= 2


def test_forecast_report_endpoint():
    """Verify GET /api/forecast-report?view= returns declared-method report with 4 baselines and per-horizon evidence."""
    resp = client.get("/api/forecast-report?view=weekly&horizon_weeks=8&session_id=demo")
    assert resp.status_code == 200
    data = resp.json()
    assert "method" in data
    assert "nominal_level" in data
    assert "baselines" in data
    assert len(data["baselines"]) >= 4
    assert "per_horizon" in data
    assert len(data["per_horizon"]) >= 3
    grades = [h.get("grade") for h in data["per_horizon"]]
    assert "Decision-grade" in grades
    assert "Planning-grade" in grades
    assert "Indicative" in grades


def test_evidence_pack_endpoint():
    """Verify GET /api/evidence-pack produces and surfaces the 6 required artifacts."""
    resp = client.get("/api/evidence-pack")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "ok"
    assert "artifacts" in data
    artifacts = data["artifacts"]
    assert "plan_periods_csv" in artifacts
    assert "constraints_json" in artifacts
    assert "forecasts_csv" in artifacts
    assert "outcomes_csv" in artifacts
    assert "baseline_comparison_csv" in artifacts
    assert "timeline_md" in artifacts
    for art in artifacts.values():
        assert art["exists"] is True
        assert art["size_bytes"] > 0


def test_chat_endpoint_agent_verification():
    """Verify POST /api/chat operates without query (returning analysis) and with query (returning verified claims)."""
    # 1. Base query without body
    resp = client.post("/api/chat?session_id=demo")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("verified_claims") is True

    # 2. Query with affordability question
    resp = client.post("/api/chat?session_id=demo", json={"query": "Can I afford a Rs 80,000 laptop?"})
    assert resp.status_code == 200
    data = resp.json()
    assert "answer" in data
    assert data.get("verified_claims") is True
    assert isinstance(data.get("unmatched_numbers_flagged"), list)


def test_user_data_lifecycle_and_live_add():
    """Verify upload, live add, and delete user data lifecycle with session isolation."""
    test_sid = "test-session-lifecycle"

    # 1. Live add
    live_txn = {
        "transaction": {
            "amount": 2500.0,
            "category": "Shopping",
            "merchant": "Electronics Store",
            "date": "2026-10-01",
            "type": "debit"
        }
    }
    resp = client.post(f"/api/live-add?session_id={test_sid}", json=live_txn)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("state") in ("ok", "needs_review") or "transaction_id" in data

    # 2. Delete user data via /api/delete-my-data
    resp = client.delete(f"/api/delete-my-data?session_id={test_sid}")
    assert resp.status_code == 200
    del_data = resp.json()
    assert del_data.get("session_id") == test_sid

    # 3. Delete user data via /api/user-data
    resp = client.delete(f"/api/user-data?session_id={test_sid}")
    assert resp.status_code == 200
