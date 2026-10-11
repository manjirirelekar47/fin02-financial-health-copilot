"""Mock-consent Account Aggregator flow backed only by a bundled fixture.

No network client or provider credentials are used here. Match SandboxAAClient
to an AA provider only after that provider's documented schema is supplied.
"""

from __future__ import annotations

import csv
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import ValidationError

from api.aa_schemas import (
    MockConsent,
    MockConsentApproval,
    MockConsentCreate,
    MockConsentList,
    SandboxInfo,
)
from api.storage import (
    approve_aa_consent,
    get_aa_consent,
    list_aa_consents,
    save_aa_consent,
    update_aa_consent,
)
from contracts.schemas import Transaction, TransactionType


router = APIRouter(prefix="/api/aa", tags=["Mock Account Aggregator"])
FIXTURE_PATH = Path(__file__).resolve().parents[1] / "fixtures" / "sample_statement.csv"


class SandboxAAClient:
    """Local fixture adapter. TODO: map documented provider fields when supplied."""

    def fetch_transactions(
        self, data_from: date | None = None, data_to: date | None = None
    ) -> list[dict]:
        if not FIXTURE_PATH.is_file():
            raise FileNotFoundError("Bundled sandbox statement fixture is missing")

        # This mapping describes the repository's fixture only; it is not a
        # claim about any AA provider's payload schema.
        with FIXTURE_PATH.open("r", encoding="utf-8-sig", newline="") as source:
            rows = list(csv.DictReader(source))

        transactions: list[dict] = []
        for index, row in enumerate(rows, start=1):
            try:
                item_date = date.fromisoformat(str(row.get("date", "")))
                if data_from and item_date < data_from:
                    continue
                if data_to and item_date > data_to:
                    continue
                raw_type = str(row.get("type", "")).strip().lower()
                if raw_type in {"credit", "cr"}:
                    txn_type = TransactionType.credit
                elif raw_type in {"debit", "dr"}:
                    txn_type = TransactionType.debit
                else:
                    raise ValueError("type must be credit or debit")
                transaction = Transaction.model_validate({
                    "id": f"aa-sandbox-{index}",
                    "date": item_date,
                    "narration": row.get("narration", "Sandbox transaction"),
                    "amount": abs(float(str(row.get("amount", "")).replace(",", ""))),
                    "type": txn_type,
                    "category": row.get("category") or "uncategorised",
                    "balance": float(str(row["balance"]).replace(",", "")) if row.get("balance") else None,
                })
                transactions.append(transaction.model_dump(mode="json"))
            except (ValueError, ValidationError) as exc:
                raise ValueError(f"Sandbox fixture row {index + 1} is invalid: {exc}") from exc
        return transactions


sandbox_client = SandboxAAClient()


def _session_id(
    session_id: Annotated[str | None, Query()] = None,
    x_session_id: Annotated[str | None, Header()] = None,
) -> str:
    value = session_id or x_session_id or "demo"
    value = value.strip()
    if not value or len(value) > 128:
        raise HTTPException(status_code=422, detail="session_id must contain 1 to 128 characters")
    return value


@router.get("/sandbox-info", response_model=SandboxInfo)
def get_sandbox_info() -> SandboxInfo:
    try:
        rows = sandbox_client.fetch_transactions()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    dates = [date.fromisoformat(row["date"]) for row in rows]
    return SandboxInfo(
        available=bool(rows),
        transaction_count=len(rows),
        data_from=min(dates) if dates else None,
        data_to=max(dates) if dates else None,
    )


@router.post("/consents", response_model=MockConsent, status_code=201)
def create_mock_consent(
    body: MockConsentCreate,
    session_id: Annotated[str | None, Query()] = None,
    x_session_id: Annotated[str | None, Header()] = None,
) -> MockConsent:
    effective_session = _session_id(session_id, x_session_id)
    consent = MockConsent(
        consent_id=f"mock-{uuid.uuid4().hex}",
        session_id=effective_session,
        purpose=body.purpose.strip(),
        data_from=body.data_from,
        data_to=body.data_to,
        consent_status="pending",
        created_at=datetime.now(timezone.utc),
    )
    save_aa_consent(consent.model_dump(mode="json"))
    return consent


@router.get("/consents", response_model=MockConsentList)
def get_mock_consents(
    session_id: Annotated[str | None, Query()] = None,
    x_session_id: Annotated[str | None, Header()] = None,
) -> MockConsentList:
    effective_session = _session_id(session_id, x_session_id)
    consents = [MockConsent.model_validate(item) for item in list_aa_consents(effective_session)]
    return MockConsentList(consents=consents)


def _load_session_consent(consent_id: str, session_id: str) -> MockConsent:
    item = get_aa_consent(session_id, consent_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Mock consent was not found for this session")
    return MockConsent.model_validate(item)


@router.get("/consents/{consent_id}", response_model=MockConsent)
def get_mock_consent(
    consent_id: str,
    session_id: Annotated[str | None, Query()] = None,
    x_session_id: Annotated[str | None, Header()] = None,
) -> MockConsent:
    return _load_session_consent(consent_id, _session_id(session_id, x_session_id))


@router.post("/consents/{consent_id}/approve", response_model=MockConsentApproval)
def approve_mock_consent(
    consent_id: str,
    session_id: Annotated[str | None, Query()] = None,
    x_session_id: Annotated[str | None, Header()] = None,
) -> MockConsentApproval:
    effective_session = _session_id(session_id, x_session_id)
    consent = _load_session_consent(consent_id, effective_session)
    if consent.consent_status == "revoked":
        raise HTTPException(status_code=409, detail="A revoked mock consent cannot be approved")
    if consent.consent_status == "approved":
        return MockConsentApproval(consent=consent, imported_count=consent.imported_count)

    try:
        transactions = sandbox_client.fetch_transactions(consent.data_from, consent.data_to)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not transactions:
        raise HTTPException(status_code=422, detail="No sandbox transactions fall inside the consented date range")

    # Stable per-consent IDs make repeated approval idempotent in storage.
    for index, transaction in enumerate(transactions, start=1):
        transaction["id"] = f"{consent_id}-{index}"
    consent.consent_status = "approved"
    consent.approved_at = datetime.now(timezone.utc)
    consent.imported_count = len(transactions)
    try:
        approve_aa_consent(effective_session, consent.model_dump(mode="json"), transactions)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return MockConsentApproval(consent=consent, imported_count=len(transactions))


@router.post("/consents/{consent_id}/revoke", response_model=MockConsent)
def revoke_mock_consent(
    consent_id: str,
    session_id: Annotated[str | None, Query()] = None,
    x_session_id: Annotated[str | None, Header()] = None,
) -> MockConsent:
    effective_session = _session_id(session_id, x_session_id)
    consent = _load_session_consent(consent_id, effective_session)
    if consent.consent_status != "revoked":
        consent.consent_status = "revoked"
        consent.revoked_at = datetime.now(timezone.utc)
        update_aa_consent(effective_session, consent.model_dump(mode="json"))
    return consent
