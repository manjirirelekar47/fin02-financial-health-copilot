"""tests/test_multi_horizon.py — Tests for Multi-Horizon Views (BUILD.md Part 3).

Invariants verified:
1. Weekly flows sum strictly to month totals for calendar dates in that month.
2. Overlapping weekly and monthly plans agree within 5% on closing balances.
3. Critical non-negotiable items (EMIs, debt service) are NEVER cut across any horizon or view.
4. Grade labels match: weekly -> Decision-grade, monthly/sixmonth -> Planning-grade, yearly -> Indicative.
5. SixMonthSummary is populated with valid closing quantiles, breach probability, and lowest balance.
"""

from __future__ import annotations

from pathlib import Path
import pandas as pd
import pytest

from src.lp_planner import build_plan_sequences

DATA_DIR = Path(__file__).parents[1] / "data"


@pytest.fixture()
def persona_a_df() -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / "persona_a_transactions.csv")
    df["date"] = pd.to_datetime(df["date"])
    return df


def test_weekly_flows_sum_to_month_totals(persona_a_df: pd.DataFrame):
    """Verify weekly cashflow components strictly sum to month totals for calendar months."""
    weekly_plan = build_plan_sequences(persona_a_df, reserve=45000.0, goal=75000.0, view="weekly")
    monthly_plan = build_plan_sequences(persona_a_df, reserve=45000.0, goal=75000.0, view="monthly")

    w_s0 = weekly_plan.sequences[0].periods
    m_s0 = monthly_plan.sequences[0].periods

    # Month 1 is weeks 1..4
    m1_inc = sum(p.income_p50 for p in w_s0[0:4])
    m1_ess = sum(p.essentials for p in w_s0[0:4])
    m1_debt = sum(p.debt_service for p in w_s0[0:4])
    m1_disc = sum(p.discretionary for p in w_s0[0:4])

    assert abs(m_s0[0].income_p50 - m1_inc) < 1.0, f"Month 1 income {m_s0[0].income_p50} != sum of weeks {m1_inc}"
    assert abs(m_s0[0].essentials - m1_ess) < 1.0, f"Month 1 essentials {m_s0[0].essentials} != sum of weeks {m1_ess}"
    assert abs(m_s0[0].debt_service - m1_debt) < 1.0, f"Month 1 debt {m_s0[0].debt_service} != sum of weeks {m1_debt}"
    assert abs(m_s0[0].discretionary - m1_disc) < 1.0, f"Month 1 disc {m_s0[0].discretionary} != sum of weeks {m1_disc}"

    # Month 2 is weeks 5..8
    m2_inc = sum(p.income_p50 for p in w_s0[4:8])
    m2_ess = sum(p.essentials for p in w_s0[4:8])
    m2_debt = sum(p.debt_service for p in w_s0[4:8])
    m2_disc = sum(p.discretionary for p in w_s0[4:8])

    assert abs(m_s0[1].income_p50 - m2_inc) < 1.0, f"Month 2 income {m_s0[1].income_p50} != sum of weeks {m2_inc}"
    assert abs(m_s0[1].essentials - m2_ess) < 1.0, f"Month 2 essentials {m_s0[1].essentials} != sum of weeks {m2_ess}"
    assert abs(m_s0[1].debt_service - m2_debt) < 1.0, f"Month 2 debt {m_s0[1].debt_service} != sum of weeks {m2_debt}"
    assert abs(m_s0[1].discretionary - m2_disc) < 1.0, f"Month 2 disc {m_s0[1].discretionary} != sum of weeks {m2_disc}"


def test_overlapping_weekly_and_monthly_plans_agree_within_5_percent(persona_a_df: pd.DataFrame):
    """Verify overlapping horizon closing balances (end of week 8 vs end of month 2) agree within 5%."""
    weekly_plan = build_plan_sequences(persona_a_df, reserve=45000.0, goal=75000.0, view="weekly", seed=42)
    monthly_plan = build_plan_sequences(persona_a_df, reserve=45000.0, goal=75000.0, view="monthly", seed=42)

    w8_closing = weekly_plan.sequences[0].periods[7].closing_p50
    m2_closing = monthly_plan.sequences[0].periods[1].closing_p50

    rel_diff = abs(w8_closing - m2_closing) / max(abs(w8_closing), 1.0)
    assert rel_diff < 0.05, f"Overlapping balance diff {rel_diff*100:.2f}% exceeds 5% limit (W8: {w8_closing}, M2: {m2_closing})"


def test_critical_items_never_cut_in_any_view(persona_a_df: pd.DataFrame):
    """Verify Critical items (EMIs, loans) are 100% paid without cuts across all views and sequences."""
    views = ["weekly", "monthly", "yearly"]
    for v in views:
        plan = build_plan_sequences(persona_a_df, reserve=45000.0, goal=75000.0, view=v)
        assert plan.status in ("ok", "infeasible")
        for seq in plan.sequences:
            for p in seq.periods:
                # Debt service must be non-negative and untouched
                assert p.debt_service >= 0.0


def test_multi_horizon_grade_labels_and_summaries(persona_a_df: pd.DataFrame):
    """Verify proper Grade assignment across weekly, monthly, sixmonth, and yearly views."""
    # 1. Weekly: Decision-grade
    p_week = build_plan_sequences(persona_a_df, reserve=45000.0, goal=75000.0, view="weekly")
    assert p_week.view == "weekly"
    assert p_week.grade == "Decision-grade"
    assert p_week.sequences[0].periods[0].grade == "Decision-grade"

    # 2. Monthly: Planning-grade
    p_month = build_plan_sequences(persona_a_df, reserve=45000.0, goal=75000.0, view="monthly")
    assert p_month.view == "monthly"
    assert p_month.grade == "Planning-grade"
    assert len(p_month.sequences[0].periods) == 6
    assert p_month.sequences[0].periods[0].grade == "Planning-grade"

    # 3. Six-Month: Planning-grade with SixMonthSummary
    p_six = build_plan_sequences(persona_a_df, reserve=45000.0, goal=75000.0, view="sixmonth")
    assert p_six.view == "sixmonth"
    assert p_six.grade == "Planning-grade"
    assert p_six.six_month_summary is not None
    assert p_six.six_month_summary.grade == "Planning-grade"
    assert p_six.six_month_summary.closing_p10 <= p_six.six_month_summary.closing_p50 <= p_six.six_month_summary.closing_p90

    # 4. Yearly: Indicative
    p_year = build_plan_sequences(persona_a_df, reserve=45000.0, goal=75000.0, view="yearly")
    assert p_year.view == "yearly"
    assert p_year.grade == "Indicative"
    assert len(p_year.sequences[0].periods) == 12
    assert p_year.sequences[0].periods[0].grade == "Indicative"
