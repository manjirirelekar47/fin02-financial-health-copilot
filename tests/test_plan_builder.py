"""tests/test_plan_builder.py — Tests for Workstreams C & D (Decision Simulator & LP Plan Builder).

Tests:
1. Critical items never cut in any period or sequence.
2. The reserve floor is held or explicitly flagged in every weekly period row.
3. Results are identical for the same seed (CRN determinism).
4. S0 equals the unmodified forecast baseline (0 cuts, 0 extra prepayment, 0 extra savings).
5. There is a verified case where the median ranking and the risk ranking disagree,
   generating the Why-Line explanation.
6. Plan outputs conform to frozen Pydantic v2 Plan contracts.
"""

from __future__ import annotations

from pathlib import Path
import pandas as pd
import pytest

from contracts.schemas import Plan, Sequence
from src.lp_planner import build_plan_sequences
from src.reserve_simulator import (
    build_deterministic_cashflow,
    extract_cashflow_components,
    generate_why_line,
    get_crn_residual_matrix,
    simulate_sequence_under_crn,
)
from contracts.schemas import PlanAction

DATA_DIR = Path(__file__).parents[1] / "data"


@pytest.fixture()
def persona_a_df() -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / "persona_a_transactions.csv")
    df["date"] = pd.to_datetime(df["date"])
    return df


@pytest.fixture()
def persona_b_df() -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / "persona_b_transactions.csv")
    df["date"] = pd.to_datetime(df["date"])
    return df


def test_critical_items_never_cut(persona_a_df: pd.DataFrame):
    """Verify that Critical (debt payments) and High (essentials) items are NEVER cut across all sequences."""
    plan = build_plan_sequences(persona_a_df, reserve=45000.0, goal=75000.0, seed=42)
    assert plan.status == "ok"
    assert len(plan.sequences) >= 3

    s0 = next(s for s in plan.sequences if "s0" in s.id)
    s1 = next(s for s in plan.sequences if "s1" in s.id)
    s2 = next(s for s in plan.sequences if "s2" in s.id)

    # Across all 8 periods, debt_service and essentials must remain identical to baseline
    for week_idx in range(8):
        p0 = s0.periods[week_idx]
        p1 = s1.periods[week_idx]
        p2 = s2.periods[week_idx]

        # Debt service (Critical) must never be reduced
        assert p1.debt_service == p0.debt_service, f"Week {week_idx+1}: Critical debt service was altered in S1"
        assert p2.debt_service == p0.debt_service, f"Week {week_idx+1}: Critical debt service was altered in S2"

        # Essentials (High) must never be cut
        assert p1.essentials == p0.essentials, f"Week {week_idx+1}: High essentials were cut in S1"
        assert p2.essentials == p0.essentials, f"Week {week_idx+1}: High essentials were cut in S2"

    # Verify no action cuts Critical categories
    for seq in (s0, s1, s2):
        for act in seq.actions:
            if act.type == "cut_category":
                assert act.category not in ("debt_payment", "housing", "utilities", "health")


def test_reserve_held_or_flagged_every_week(persona_a_df: pd.DataFrame):
    """Verify that the reserve floor is held or explicitly flagged in every weekly period row."""
    # Test with an elevated reserve floor of Rs 440,000 to observe both safe and deficit weeks
    plan = build_plan_sequences(persona_a_df, reserve=440000.0, goal=50000.0, seed=42)

    for seq in plan.sequences:
        assert len(seq.periods) == 8
        for p in seq.periods:
            assert 0.0 <= p.reserve_breach_prob <= 1.0
            if p.closing_p10 < 440000.0:
                # If balance is under reserve at P10, breach probability must be positive and note must flag it
                assert p.reserve_breach_prob > 0.0
                assert "Warning" in p.tradeoff_note or "breach" in p.tradeoff_note.lower() or "dips" in p.tradeoff_note.lower()
            else:
                # Buffer holds reserve
                assert p.closing_p10 >= 440000.0


def test_results_identical_for_same_seed(persona_a_df: pd.DataFrame):
    """Verify that CRN simulation produces bit-for-bit identical results for the same seed."""
    plan1 = build_plan_sequences(persona_a_df, reserve=45000.0, goal=75000.0, seed=42)
    plan2 = build_plan_sequences(persona_a_df, reserve=45000.0, goal=75000.0, seed=42)

    assert plan1.why_line == plan2.why_line
    assert plan1.recommended_sequence_id == plan2.recommended_sequence_id

    for s1, s2 in zip(plan1.sequences, plan2.sequences):
        assert s1.id == s2.id
        assert s1.summary.any_week_breach_prob == s2.summary.any_week_breach_prob
        assert s1.summary.min_p10_closing == s2.summary.min_p10_closing
        for p1, p2 in zip(s1.periods, s2.periods):
            assert p1.closing_p10 == p2.closing_p10
            assert p1.closing_p50 == p2.closing_p50
            assert p1.closing_p90 == p2.closing_p90
            assert p1.reserve_breach_prob == p2.reserve_breach_prob


def test_s0_equals_unmodified_forecast(persona_a_df: pd.DataFrame):
    """Verify that sequence S0 equals the unmodified forecast (zero cuts, zero prepayment, zero savings)."""
    plan = build_plan_sequences(persona_a_df, reserve=45000.0, goal=75000.0, seed=42)
    s0 = next(s for s in plan.sequences if "s0" in s.id)

    assert s0.actions == [], "S0 must contain no actions"
    assert s0.summary.total_cut == 0.0, "S0 must have 0 total cuts"

    for p in s0.periods:
        assert p.prepayment == 0.0, f"Week {p.week} S0 prepayment must be 0"
        assert p.savings == 0.0, f"Week {p.week} S0 savings must be 0"


def test_median_and_risk_ranking_disagree(persona_b_df: pd.DataFrame):
    """Verify that there is a case where the median ranking and risk ranking disagree,

    triggering the spec why-line template.
    """
    init_bal, start_date, obs, res = extract_cashflow_components(persona_b_df, initial_balance=60000.0)
    det, breakdown = build_deterministic_cashflow(obs, start_date)
    crn = get_crn_residual_matrix(res, seed=42)

    reserve = 48000.0

    # Sequence S0: Hold steady (higher median, but high breach probability in volatile weeks)
    s0 = simulate_sequence_under_crn("s0", "S0 Hold steady", [], det, crn, breakdown, 60000.0, start_date, reserve, 20000.0)

    # Sequence S1: Trim discretionary in peak weeks and accelerate debt prepayment
    # Lower median liquid balance, but protects against the reserve dip
    s1 = simulate_sequence_under_crn(
        "s1",
        "S1 Trim and repay debt first",
        [
            PlanAction(type="cut_category", start_week=1, end_week=5, amount=3000.0),
            PlanAction(type="prepay_debt", start_week=8, end_week=8, amount=16000.0),
        ],
        det,
        crn,
        breakdown,
        60000.0,
        start_date,
        reserve,
        20000.0,
    )

    # 1. Median ranking: S0 has higher median closing balance than S1
    assert s0.periods[-1].closing_p50 > s1.periods[-1].closing_p50, (
        f"Expected S0 median ({s0.periods[-1].closing_p50}) > S1 median ({s1.periods[-1].closing_p50})"
    )

    # 2. Risk ranking: S1 has lower reserve breach risk than S0
    assert s1.summary.any_week_breach_prob < s0.summary.any_week_breach_prob, (
        f"Expected S1 risk ({s1.summary.any_week_breach_prob}) < S0 risk ({s0.summary.any_week_breach_prob})"
    )

    # 3. Why-Line generator: selects lower risk sequence and explains trade-off
    rec_id, why_line = generate_why_line([s0, s1], reserve)
    assert rec_id == "s1"
    assert "better median" in why_line
    assert "lower-risk plan" in why_line
    assert "recommended" in why_line


def test_plan_contract_validation(persona_a_df: pd.DataFrame):
    """Verify that build_plan_sequences returns a model that strictly satisfies the frozen Plan schema."""
    plan = build_plan_sequences(persona_a_df, reserve=45000.0, goal=75000.0, seed=42)
    plan_dict = plan.model_dump(mode="json")
    validated = Plan.model_validate(plan_dict)

    assert validated.horizon_weeks == 8
    assert validated.status == "ok"
    assert len(validated.sequences) == 3
    assert validated.view == "weekly"
    assert validated.grade == "Decision-grade"
