"""backend/schemas.py — Standalone Pydantic schemas for extracted Phase 1 features.
Decoupled: No external heavy optimization or agent dependencies.
"""

from __future__ import annotations
from typing import Literal, List, Optional
from pydantic import BaseModel, Field


# ------------------------------------------------------------------------------
# Feature 1: Minimum Cash Reserve Schemas
# ------------------------------------------------------------------------------

class CashReserveRequest(BaseModel):
    """Payload to configure or update the user's cash reserve floor."""
    reserve: float = Field(
        default=45000.0,
        ge=0.0,
        description="Minimum emergency cash reserve floor in INR"
    )


class CashReserveResponse(BaseModel):
    reserve: float
    status: str = "ok"
    message: str = "Cash reserve floor updated successfully"


# ------------------------------------------------------------------------------
# Feature 2: F5 MVP Simulator Schemas (8-Week Table)
# ------------------------------------------------------------------------------

class PeriodRow(BaseModel):
    week: int
    period_label: str
    start_date: str
    opening_balance: float
    income_p50: float
    essentials: float
    discretionary: float
    closing_p10: float
    closing_p50: float
    closing_p90: float
    reserve_breach_prob: float
    tradeoff_note: str


class SequenceSummary(BaseModel):
    min_p10_closing: float
    any_week_breach_prob: float
    total_cut: float


class SequenceResult(BaseModel):
    id: str
    name: str
    periods: List[PeriodRow]
    summary: SequenceSummary


class SimulationResponse(BaseModel):
    status: str = "ok"
    reserve_floor: float
    recommended_sequence_id: str
    sequences: List[SequenceResult]


# ------------------------------------------------------------------------------
# Feature 3: Live Add & Silent Creep Alert Schemas
# ------------------------------------------------------------------------------

class LiveTransactionInput(BaseModel):
    date: str
    narration: str
    amount: float = Field(gt=0.0)
    type: Literal["debit", "credit"] = "debit"
    category: Optional[str] = "uncategorised"


class SilentCreepAlert(BaseModel):
    id: str
    mode: Literal["silent_creep"] = "silent_creep"
    title: str
    extra_per_month: float
    extra_per_year: float
    severity: Literal["low", "medium", "high"] = "medium"
    evidence: List[str] = Field(default_factory=list)
    tag: str = "observed"


class LiveAddResponse(BaseModel):
    status: str = "ok"
    transaction: dict
    alerts: List[SilentCreepAlert] = Field(default_factory=list)
    total_transactions: int
