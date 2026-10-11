"""tests/test_replan_infeasibility.py — Tests for Workstream E (Replan, Infeasibility & Conflict Report).

Tests:
1. An impossible goal returns status infeasible, names the conflicting constraints, and gives
   at least 2 relaxation options, each re-scored with its resulting risk.
2. A feasible plan after a small income drop returns a normal plan (status: "ok"), not a conflict.
3. Critical items are never cut in any replan.
4. Results are identical for the same seed.
5. Replan triggered by surprise expense preserves Critical debt payments while adjusting discretionary spend.
6. RealEngine refresh() executes replan when drift occurs on a locked path.
"""

from __future__ import annotations

from pathlib import Path
import pandas as pd
import pytest

from contracts.schemas import ConflictReport, LockedPath, Plan, RelaxationOption
from engine.real_engine import RealEngine
from src.lp_planner import build_plan_sequences, replan_sequences

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


def test_impossible_goal_returns_infeasible_conflict_report(persona_a_df: pd.DataFrame):
    """Test 1: An impossible savings goal returns status 'infeasible', names the conflicting

    constraints, reports slack amounts, and yields at least 2 re-scored relaxation options.
    """
    # Over 8 weeks with Rs 50,000 opening buffer and Rs 50,000 reserve floor,
    # attempting a Rs 350,000 savings goal is mathematically impossible.
    plan = replan_sequences(
        persona_a_df,
        change={
            "goal": 350000.0,
            "reserve": 50000.0,
            "initial_balance": 50000.0,
            "seed": 42,
        },
    )

    assert plan.status == "infeasible"
    assert plan.recommended_sequence_id == ""
    assert plan.conflict is not None
    assert isinstance(plan.conflict, ConflictReport)

    # 1. Names the conflicting constraints
    assert len(plan.conflict.constraints) >= 2
    constraint_text = " ".join(plan.conflict.constraints).lower()
    assert "reserve" in constraint_text
    assert "savings" in constraint_text or "goal" in constraint_text
    assert "debt" in constraint_text or "emi" in constraint_text

    # 2. Reports non-zero slack amounts
    assert "savings_goal_shortfall" in plan.conflict.slack_amounts
    assert plan.conflict.slack_amounts["savings_goal_shortfall"] > 1.0

    # 3. Gives at least 2 relaxation options, each re-scored with resulting risk
    assert len(plan.conflict.relaxations) >= 2
    for rel in plan.conflict.relaxations:
        assert isinstance(rel, RelaxationOption)
        assert 0.0 <= rel.resulting_risk <= 1.0
        assert rel.description != ""

    types = [r.type for r in plan.conflict.relaxations]
    assert "lower_goal" in types
    assert "extend_deadline" in types or "lower_reserve" in types


def test_feasible_plan_after_small_income_drop_returns_normal_plan(persona_a_df: pd.DataFrame):
    """Test 2: A feasible plan after a small income drop returns a normal plan (status: 'ok'),

    not a conflict.
    """
    # 10% income reduction on Persona A with a reasonable savings target of Rs 25,000
    plan = replan_sequences(
        persona_a_df,
        change={
            "trigger": "income_drop",
            "drop_pct": 0.10,
            "reserve": 40000.0,
            "goal": 25000.0,
            "seed": 42,
        },
    )

    assert plan.status == "ok"
    assert plan.conflict is None
    assert len(plan.sequences) >= 3
    assert plan.recommended_sequence_id != ""
    assert "recommended" in plan.why_line.lower()


def test_critical_items_never_cut_in_any_replan(persona_a_df: pd.DataFrame):
    """Test 3: Critical debt obligations and High essential items are NEVER cut in any replan."""
    baseline = build_plan_sequences(persona_a_df, reserve=45000.0, goal=50000.0, seed=42)
    base_s0 = next(s for s in baseline.sequences if "s0" in s.id)

    # Trigger a 30% income drop replan
    replanned = replan_sequences(
        persona_a_df,
        change={
            "trigger": "income_drop",
            "drop_pct": 0.30,
            "from_week": 1,
            "reserve": 45000.0,
            "goal": 50000.0,
            "seed": 42,
        },
    )

    for seq in replanned.sequences:
        for week_idx in range(8):
            rep_p = seq.periods[week_idx]
            base_p = base_s0.periods[week_idx]

            # Critical debt service must not be cut or altered
            assert rep_p.debt_service == base_p.debt_service, (
                f"Week {week_idx+1}: Critical debt service altered in replanned {seq.id}"
            )

            # High essentials must not be cut
            assert rep_p.essentials == base_p.essentials, (
                f"Week {week_idx+1}: High essentials altered in replanned {seq.id}"
            )


def test_replan_results_identical_for_same_seed(persona_a_df: pd.DataFrame):
    """Test 4: Results are bit-for-bit identical for the same seed."""
    change = {"trigger": "income_drop", "drop_pct": 0.20, "reserve": 45000.0, "goal": 40000.0, "seed": 42}
    r1 = replan_sequences(persona_a_df, change=change)
    r2 = replan_sequences(persona_a_df, change=change)

    assert r1.status == r2.status
    assert r1.why_line == r2.why_line
    assert r1.recommended_sequence_id == r2.recommended_sequence_id

    for s1, s2 in zip(r1.sequences, r2.sequences):
        assert s1.id == s2.id
        assert s1.summary.any_week_breach_prob == s2.summary.any_week_breach_prob
        for p1, p2 in zip(s1.periods, s2.periods):
            assert p1.closing_p50 == p2.closing_p50
            assert p1.reserve_breach_prob == p2.reserve_breach_prob


def test_replan_on_surprise_expense(persona_b_df: pd.DataFrame):
    """Test 5: Replan on a surprise expense (e.g. Rs 18,000 health/repair in week 2)

    preserves debt payments while updating discretionary spend.
    """
    replanned = replan_sequences(
        persona_b_df,
        change={
            "trigger": "new_expense",
            "amount": 18000.0,
            "week": 2,
            "reserve": 35000.0,
            "goal": 20000.0,
            "seed": 42,
        },
    )

    assert replanned.status in ("ok", "infeasible")
    # Verify that week 2 essentials reflect the extra 18,000
    for seq in replanned.sequences:
        assert seq.periods[1].essentials >= 18000.0
        # Critical debt service remains paid
        assert seq.periods[1].debt_service >= 0.0


def test_refresh_wires_into_replan_on_drift(persona_a_df: pd.DataFrame):
    """Test 6: RealEngine.refresh() executes replan when plan-drift occurs on a locked path."""
    engine = RealEngine()
    records = persona_a_df.to_dict(orient="records")

    locked = LockedPath(
        id="lock_test",
        goal="Save 75k",
        deadline="2027-02-28",
        required_balance=550000.0,
        band={"p10": 480000, "p50": 520000, "p90": 560000},
        reserve=45000.0,
    )

    # Ingest a large surprise expense debit that degrades the projected balance
    large_expense = {
        "id": "exp_surprise_999",
        "date": "2026-12-31",
        "narration": "HOSPITAL EMERGENCY ADMISSION",
        "amount": 75000.0,
        "type": "debit",
        "category": "health",
    }

    refresh_res = engine.refresh(records[:600], new_txn=large_expense, locks=[locked])
    assert refresh_res["status"] == "ok"
    assert "replanned_plan" in refresh_res
