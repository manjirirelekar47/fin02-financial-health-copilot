"""Pydantic v2 contracts for the stateless SpendShield engine."""

from __future__ import annotations

from datetime import date
from typing import Any, Literal

from enum import Enum
from pydantic import BaseModel, Field, field_validator


Tag = Literal["observed", "predicted", "recommended"]
Grade = Literal["Decision-grade", "Planning-grade", "Indicative"]
ViewType = Literal["weekly", "monthly", "sixmonth", "yearly"]


class Priority(str, Enum):
    Critical = "Critical"
    High = "High"
    Medium = "Medium"
    Low = "Low"


class TransactionType(str, Enum):
    debit = "debit"
    credit = "credit"


class Transaction(BaseModel):
    id: str
    date: date
    narration: str
    amount: float = Field(gt=0)
    type: TransactionType | Literal["debit", "credit"]
    category: str = "uncategorised"
    category_confidence: float = Field(default=0.0, ge=0, le=1)
    priority: Priority | Literal["Critical", "High", "Medium", "Low"] = Priority.Low
    balance: float | None = None
    is_duplicate: bool = False

    @field_validator("narration")
    @classmethod
    def narration_is_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("narration must not be blank")
        return value


class Scenario(BaseModel):
    kind: Literal[
        "do_nothing",
        "cut_spend",
        "refinance",
        "new_emi",
        "purchase",
        "medical",
        "income_drop_30",
        "job_loss",
        "emi_hike_12",
    ] = "do_nothing"
    params: dict[str, Any] = Field(default_factory=dict)
    horizon_days: int = Field(default=90, ge=14, le=365)
    seed: int = 42


class BufferQuantiles(BaseModel):
    p10: float
    p50: float
    p90: float


class SimulationResult(BaseModel):
    status: Literal["ok", "insufficient_data"]
    shortfall_prob: float = Field(ge=0, le=1)
    buffer: BufferQuantiles
    runway_days: int = Field(ge=0)
    new_dti: float | None = Field(default=None, ge=0)
    reserve_breach_prob: float = Field(default=0.0, ge=0, le=1)
    tag: Tag = "predicted"
    evidence: list[str] = Field(default_factory=list)
    kind: str = "do_nothing"


class Alert(BaseModel):
    id: str
    mode: Literal["silent_creep", "rollover", "plan_drift"]
    title: str
    extra_per_month: float = Field(default=0, ge=0)
    extra_per_year: float = Field(default=0, ge=0)
    severity: Literal["low", "medium", "high", "critical"]
    evidence: list[str] = Field(default_factory=list)
    tag: Tag = "observed"


class RecurringPayment(BaseModel):
    """Normalised output of the recurring-payment detector."""

    merchant: str
    recurring_type: str
    occurrences: int = Field(ge=3)
    avg_amount: float = Field(ge=0)
    amount_std: float = Field(ge=0)
    avg_interval_days: float = Field(ge=0)
    first_seen: date
    last_seen: date
    first_amount: float = Field(ge=0)
    last_amount: float = Field(ge=0)
    total_drift_pct: float
    evidence: list[str] = Field(default_factory=list)
    tag: Tag = "observed"


class LockedPath(BaseModel):
    id: str
    goal: str
    deadline: date
    required_balance: float = Field(ge=0)
    band: BufferQuantiles
    reserve: float = Field(default=0.0, ge=0)
    category_ceilings: dict[str, float] = Field(default_factory=dict)
    max_risk: float = Field(default=0.15, ge=0, le=1)
    priority: Literal["Critical", "High", "Medium", "Low"] = "High"


class RecoveryOption(BaseModel):
    action: Literal["cut", "delay", "reduce_budget"]
    target: str | None = None
    amount: float | None = Field(default=None, ge=0)
    days: int | None = Field(default=None, ge=0)


class DriftResult(BaseModel):
    lock_id: str
    success_prob_before: float = Field(ge=0, le=1)
    success_prob_now: float = Field(ge=0, le=1)
    reason: str
    delay_days: int = Field(ge=0)
    recovery: list[RecoveryOption] = Field(default_factory=list)
    tag: Tag = "recommended"


# ==============================================================================
# Addition 1: Constrained Action Planning Contracts (F6 & F7)
# ==============================================================================

ActionType = Literal[
    "cut_category",
    "prepay_debt",
    "save",
    "delay_payment",
    "one_off_expense",
]


class PlanAction(BaseModel):
    type: ActionType | str
    start_week: int = 1
    end_week: int = 8
    amount: float | None = None
    percentage: float | None = None
    category: str | None = None
    description: str = ""


class PeriodRow(BaseModel):
    week: int
    start_date: date
    opening_balance: float
    income_p50: float
    essentials: float
    debt_service: float
    discretionary: float
    savings: float
    prepayment: float
    closing_p10: float
    closing_p50: float
    closing_p90: float
    reserve_breach_prob: float = Field(default=0.0, ge=0, le=1)
    tradeoff_note: str = ""
    period_type: Literal["week", "month"] = "week"
    period_label: str = ""
    period_start: date | None = None
    period_end: date | None = None
    grade: Grade = "Decision-grade"


class SequenceSummary(BaseModel):
    min_p10_closing: float
    any_week_breach_prob: float = Field(ge=0, le=1)
    total_cut: float = 0.0
    goal_met: bool = True


class Sequence(BaseModel):
    id: str
    name: str
    actions: list[PlanAction] = Field(default_factory=list)
    periods: list[PeriodRow] = Field(default_factory=list)
    summary: SequenceSummary
    tag: Tag = "recommended"


class RelaxationOption(BaseModel):
    type: Literal["lower_goal", "extend_deadline", "lower_reserve", "accept_higher_risk"] | str
    amount: float | None = None
    weeks: int | None = None
    resulting_risk: float = Field(ge=0, le=1)
    description: str = ""


class ConflictReport(BaseModel):
    constraints: list[str] = Field(default_factory=list)
    slack_amounts: dict[str, float] = Field(default_factory=dict)
    relaxations: list[RelaxationOption] = Field(default_factory=list)
    tag: Tag = "observed"


class SixMonthSummary(BaseModel):
    closing_p10: float
    closing_p50: float
    closing_p90: float
    lowest_p10_balance: float
    lowest_p10_week: int
    reserve_breach_prob: float = Field(ge=0, le=1)
    cumulative_saving: float
    debt_cleared: float
    goal_met: bool
    grade: Grade = "Planning-grade"


class Plan(BaseModel):
    id: str
    reserve: float = Field(ge=0)
    goal: float = Field(ge=0)
    deadline: date
    horizon_weeks: int = 8
    sequences: list[Sequence] = Field(default_factory=list)
    recommended_sequence_id: str = ""
    why_line: str = ""
    status: Literal["ok", "infeasible", "insufficient_data"] = "ok"
    conflict: ConflictReport | None = None
    view: ViewType = "weekly"
    grade: Grade = "Decision-grade"
    six_month_summary: SixMonthSummary | None = None


# ==============================================================================
# Addition 2: Probabilistic Cashflow Forecast Contracts (F4 & Part 3)
# ==============================================================================

class StreamQuantiles(BaseModel):
    p10: list[float] = Field(default_factory=list)
    p50: list[float] = Field(default_factory=list)
    p90: list[float] = Field(default_factory=list)


class ForecastBaseline(BaseModel):
    name: str
    mae: float
    mase: float
    coverage: float = Field(ge=0, le=1)
    mean_width: float = Field(ge=0)


class PerHorizonBucket(BaseModel):
    bucket: Literal["1 to 8 weeks", "9 to 26 weeks", "27 to 52 weeks"] | str
    origins: int
    mae: float
    mase: float
    coverage: float = Field(ge=0, le=1)
    mean_width: float = Field(ge=0)
    grade: Grade = "Decision-grade"


class ForecastReport(BaseModel):
    method: str
    horizon_weeks: int = 8
    nominal_level: float = 0.80
    income_stream: StreamQuantiles
    expense_stream: StreamQuantiles
    baselines: list[ForecastBaseline] = Field(default_factory=list)
    per_horizon: list[PerHorizonBucket] = Field(default_factory=list)
    test_window: str = "Months 25 to 36"
    seeds: dict[str, int] = Field(default_factory=dict)
    tag: Tag = "predicted"
