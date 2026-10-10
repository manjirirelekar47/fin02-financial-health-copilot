"""tests/test_agent_tools.py — Unit tests for agent tools and claim verifier.

Tests:
1. All 9 tools execute and return valid numerical/contract outputs without raw transaction leakage:
   get_summary, get_recurring, forecast_report, simulate_decision, plan, replan,
   shock_capacity, get_priority_list, lock_path.
2. Claim verifier passes draft text whose figures strictly match tool outputs.
3. Claim verifier flags and rejects draft text with unverified/invented numbers.
"""

from __future__ import annotations

from pathlib import Path
import pandas as pd
import pytest

from src.agent.tools import (
    forecast_report,
    get_priority_list,
    get_recurring,
    get_summary,
    lock_path,
    plan,
    replan,
    shock_capacity,
    simulate_decision,
)
from src.agent.verifier import verify_claims

DATA_DIR = Path(__file__).parents[1] / "data"


@pytest.fixture()
def persona_a_df() -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / "persona_a_transactions.csv")
    df["date"] = pd.to_datetime(df["date"])
    return df


def test_agent_tools_return_valid_engine_outputs(persona_a_df: pd.DataFrame):
    """Verify all 9 agent tools execute as clean engine wrappers."""
    # 1. get_summary
    summary = get_summary(persona_a_df)
    assert "monthly_summary" in summary
    assert "trend_flags" in summary

    # 2. get_recurring
    recurring = get_recurring(persona_a_df)
    assert recurring["total_monthly_burden"] >= 0.0
    assert "recurring_payments" in recurring

    # 3. forecast_report
    forecast = forecast_report(persona_a_df, horizon_weeks=8)
    assert forecast["horizon_weeks"] == 8
    assert "income_stream" in forecast
    assert "expense_stream" in forecast

    # 4. simulate_decision
    sim = simulate_decision(persona_a_df)
    assert "status" in sim

    # 5. plan
    plan_out = plan(persona_a_df, reserve=45000.0, goal=75000.0)
    assert plan_out["status"] == "ok"
    assert len(plan_out["sequences"]) >= 2

    # 6. replan
    replan_out = replan(persona_a_df, change={"goal": 30000.0, "reserve": 40000.0})
    assert replan_out["status"] in ("ok", "infeasible")

    # 7. shock_capacity
    shock = shock_capacity(persona_a_df, reserve=45000.0, limit=0.10)
    assert "max_absorbable_shock" in shock
    assert shock["max_absorbable_shock"] >= 0.0

    # 8. get_priority_list
    priorities = get_priority_list(persona_a_df)
    assert "payment_order" in priorities
    assert "Critical" in priorities["categories_by_priority"]

    # 9. lock_path
    lock_res = lock_path(persona_a_df, {"goal": "Home Downpayment", "required_balance": 150000.0})
    assert lock_res["status"] == "locked"
    assert lock_res["lock"]["goal"] == "Home Downpayment"


def test_claim_verifier_accepts_verified_numbers():
    """Verify that verify_claims passes numbers that exist in tool outputs."""
    tool_outputs = {
        "monthly_summary": {"net_cashflow": 12500.0, "dti": 0.28},
        "plan": {
            "reserve": 45000.0,
            "goal": 75000.0,
            "sequences": [
                {"summary": {"any_week_breach_prob": 0.042, "total_cut": 18400.0}}
            ],
        },
    }

    # Draft using exact and percentage numbers from tools
    draft = (
        "Your monthly net cash flow is Rs 12,500 with a DTI of 28%. "
        "The recommended plan protects your Rs 45,000 reserve with only a 4.2% breach risk, "
        "achieving your Rs 75,000 goal with Rs 18,400 in discretionary trimming."
    )

    text, is_valid, unmatched = verify_claims(draft, tool_outputs)
    assert is_valid is True
    assert len(unmatched) == 0


def test_claim_verifier_rejects_hallucinated_numbers():
    """Verify that verify_claims catches invented numbers not present in tool outputs."""
    tool_outputs = {
        "plan": {
            "reserve": 45000.0,
            "goal": 75000.0,
            "sequences": [
                {"summary": {"any_week_breach_prob": 0.042}}
            ],
        }
    }

    # Draft containing an invented number (e.g. Rs 99,999)
    hallucinated_draft = (
        "Your reserve is Rs 45,000 and your breach risk is 4.2%. "
        "You will save an extra Rs 99,999 next month."
    )

    text, is_valid, unmatched = verify_claims(hallucinated_draft, tool_outputs)
    assert is_valid is False
    assert "99999.0" in unmatched or 99999.0 in [float(u) for u in unmatched]
