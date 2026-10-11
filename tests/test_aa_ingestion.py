from fastapi.testclient import TestClient

from api.main import app
from api.storage import clear_user_data, get_transactions


client = TestClient(app)


def test_mock_consent_requires_explicit_approval_and_imports_sandbox_rows():
    session_id = "aa-consent-flow-test"
    clear_user_data(session_id)

    info = client.get("/api/aa/sandbox-info")
    assert info.status_code == 200
    assert info.json()["source_label"] == "Sandbox / test data"
    assert info.json()["transaction_count"] > 0

    created = client.post(
        "/api/aa/consents",
        headers={"X-Session-ID": session_id},
        json={
            "purpose": "Cash flow review in SpendShield",
            "data_from": "2026-07-01",
            "data_to": "2026-09-28",
        },
    )
    assert created.status_code == 201
    consent = created.json()
    assert consent["consent_status"] == "pending"
    assert consent["source_label"] == "Sandbox / test data"
    assert get_transactions(session_id) == []

    approved = client.post(
        f"/api/aa/consents/{consent['consent_id']}/approve",
        headers={"X-Session-ID": session_id},
    )
    assert approved.status_code == 200
    result = approved.json()
    assert result["consent"]["consent_status"] == "approved"
    assert result["imported_count"] > 0
    assert len(get_transactions(session_id)) == result["imported_count"]
    assert all(row["id"].startswith(consent["consent_id"]) for row in get_transactions(session_id))

    repeated = client.post(
        f"/api/aa/consents/{consent['consent_id']}/approve",
        headers={"X-Session-ID": session_id},
    )
    assert repeated.status_code == 200
    assert repeated.json()["imported_count"] == result["imported_count"]
    clear_user_data(session_id)


def test_mock_consent_validation_and_session_isolation():
    session_id = "aa-consent-validation-test"
    clear_user_data(session_id)

    blank = client.post(
        "/api/aa/consents",
        headers={"X-Session-ID": session_id},
        json={"purpose": "     "},
    )
    assert blank.status_code == 422

    reversed_dates = client.post(
        "/api/aa/consents",
        headers={"X-Session-ID": session_id},
        json={"purpose": "Cash flow review", "data_from": "2026-09-01", "data_to": "2026-07-01"},
    )
    assert reversed_dates.status_code == 422

    created = client.post(
        "/api/aa/consents",
        headers={"X-Session-ID": session_id},
        json={"purpose": "Cash flow review"},
    )
    assert created.status_code == 201
    consent_id = created.json()["consent_id"]
    hidden = client.get(
        f"/api/aa/consents/{consent_id}", headers={"X-Session-ID": "different-session"}
    )
    assert hidden.status_code == 404
    clear_user_data(session_id)


def test_mock_consent_can_be_revoked_and_does_not_claim_bank_connectivity():
    session_id = "aa-consent-revoke-test"
    clear_user_data(session_id)
    created = client.post(
        "/api/aa/consents",
        headers={"X-Session-ID": session_id},
        json={"purpose": "Cash flow review"},
    )
    consent_id = created.json()["consent_id"]
    revoked = client.post(
        f"/api/aa/consents/{consent_id}/revoke", headers={"X-Session-ID": session_id}
    )
    assert revoked.status_code == 200
    assert revoked.json()["consent_status"] == "revoked"
    assert revoked.json()["source_label"] == "Sandbox / test data"

    approval = client.post(
        f"/api/aa/consents/{consent_id}/approve", headers={"X-Session-ID": session_id}
    )
    assert approval.status_code == 409
    clear_user_data(session_id)
