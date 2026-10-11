"""Product-owned schemas for the local Account Aggregator mock flow.

These are SpendShield's own consent fields, not a real AA provider contract.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class MockConsentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    purpose: str = Field(min_length=5, max_length=200)
    data_from: date | None = None
    data_to: date | None = None

    @field_validator("purpose")
    @classmethod
    def purpose_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("purpose must not be blank")
        return value.strip()

    @model_validator(mode="after")
    def validate_date_window(self) -> "MockConsentCreate":
        if (self.data_from is None) != (self.data_to is None):
            raise ValueError("data_from and data_to must either both be supplied or both be omitted")
        if self.data_from and self.data_to and self.data_to < self.data_from:
            raise ValueError("data_to must be on or after data_from")
        return self


class MockConsent(BaseModel):
    consent_id: str
    session_id: str
    purpose: str
    data_from: date | None = None
    data_to: date | None = None
    data_types: list[Literal["transactions"]] = Field(default_factory=lambda: ["transactions"])
    consent_status: Literal["pending", "approved", "revoked"]
    created_at: datetime
    approved_at: datetime | None = None
    revoked_at: datetime | None = None
    imported_count: int = Field(default=0, ge=0)
    source_label: Literal["Sandbox / test data"] = "Sandbox / test data"
    notice: str = "Mock consent only. No bank connection is made; bundled sandbox/test data is used."


class MockConsentList(BaseModel):
    consents: list[MockConsent]
    source_label: Literal["Sandbox / test data"] = "Sandbox / test data"
    notice: str = "Mock consent only. No bank connection is made; bundled sandbox/test data is used."


class MockConsentApproval(BaseModel):
    consent: MockConsent
    imported_count: int = Field(ge=0)
    source_label: Literal["Sandbox / test data"] = "Sandbox / test data"
    notice: str = "Mock consent only. No bank connection is made; bundled sandbox/test data is used."


class SandboxInfo(BaseModel):
    available: bool
    transaction_count: int = Field(ge=0)
    data_from: date | None = None
    data_to: date | None = None
    source_label: Literal["Sandbox / test data"] = "Sandbox / test data"
    notice: str = "This is a local fixture, not a bank connection or real AA provider response."
