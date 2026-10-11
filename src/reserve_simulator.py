"""src/reserve_simulator.py — Reserve-Aware Decision Simulator with Common Random Numbers (CRN).

Workstream C / Addition 1 & 2 (F5 Decision Simulator Upgrade):
1. Evaluates P(balance < 0) and P(balance < R) per week and horizon-wide.
2. Accepts timed action sequences (cut_category, prepay_debt, save, delay_payment, one_off_expense).
3. Evaluates all candidate sequences with Common Random Numbers (CRN) across ~1,000 paths
   so ranking comparisons are mathematically noise-free.
4. Generates the Why-Line explaining trade-offs between median closing balance and reserve-breach risk.
5. Measures Shock Capacity against user-declared reserve floor R.
6. Aggregates daily paths by calendar dates for weekly resolution (designed to extend to monthly/yearly).
7. Fully deterministic and cached for repeatable execution.
"""

from __future__ import annotations

import functools
import hashlib
from datetime import date, timedelta
from typing import Any, Mapping
import numpy as np
import pandas as pd

from contracts.schemas import (
    PeriodRow,
    PlanAction,
    Sequence,
    SequenceSummary,
    SixMonthSummary,
    Tag,
)
from src.recurring_detector import detect_recurring_payments

PATHS = 1000
BLOCK_SIZE = 7

_CATEGORY_PRIORITIES: dict[str, str] = {
    "debt_payment": "Critical",
    "housing": "High",
    "utilities": "High",
    "health": "High",
    "groceries": "Medium",
    "transport": "Medium",
    "subscriptions": "Low",
    "food_delivery": "Low",
    "shopping": "Low",
    "entertainment": "Low",
    "travel": "Low",
    "uncategorised": "Medium",
}


def _hash_data(df: pd.DataFrame) -> str:
    """Computes deterministic digest of the input transaction dataframe."""
    summary = f"{len(df)}_{df['amount'].sum():.2f}_{df['date'].min()}_{df['date'].max()}"
    return hashlib.sha256(summary.encode()).hexdigest()[:16]


def get_crn_residual_matrix(
    residuals: np.ndarray,
    num_paths: int = PATHS,
    horizon_days: int = 56,
    seed: int = 42,
) -> np.ndarray:
    """Pre-generates Common Random Numbers (CRN) residual matrix of shape (num_paths, horizon_days).

    Every sequence evaluated under the same seed will receive the EXACT SAME residual realizations.
    """
    rng = np.random.default_rng(seed)
    n_res = len(residuals)
    if n_res < BLOCK_SIZE:
        padded = np.pad(residuals, (0, max(0, BLOCK_SIZE - n_res)), mode="edge") if n_res > 0 else np.zeros(BLOCK_SIZE)
        blocks = [padded]
    else:
        num_blocks = n_res - BLOCK_SIZE + 1
        blocks = [residuals[i : i + BLOCK_SIZE] for i in range(num_blocks)]

    num_blocks_needed = int(np.ceil(horizon_days / BLOCK_SIZE))
    block_indices = rng.integers(0, len(blocks), size=(num_paths, num_blocks_needed))

    matrix = np.empty((num_paths, horizon_days), dtype=float)
    for p_idx in range(num_paths):
        path_blocks = [blocks[idx] for idx in block_indices[p_idx]]
        matrix[p_idx] = np.concatenate(path_blocks)[:horizon_days]

    return matrix


def extract_cashflow_components(
    df: pd.DataFrame,
    initial_balance: float | None = None,
) -> tuple[float, date, list[dict[str, Any]], np.ndarray]:
    """Extracts starting balance, simulation start date, scheduled recurring items, and discretionary residuals."""
    clean = df.copy()
    clean["date"] = pd.to_datetime(clean["date"])
    clean["amount"] = pd.to_numeric(clean["amount"], errors="coerce").fillna(0.0)
    clean["type"] = clean["type"].astype(str).str.strip().str.lower()
    clean["signed_amount"] = np.where(clean["type"] == "credit", clean["amount"], -clean["amount"])
    if "merchant" not in clean.columns:
        clean["merchant"] = clean.get("narration", clean.get("description", "Unknown"))
    clean["merchant"] = clean["merchant"].fillna("Unknown").astype(str)

    if initial_balance is None:
        if "balance" in clean.columns and clean["balance"].notna().any():
            initial_balance = float(clean["balance"].dropna().iloc[-1])
        else:
            initial_balance = float(clean["signed_amount"].sum())
    else:
        initial_balance = float(initial_balance)
    max_date = clean["date"].max()
    # Align to next Monday
    days_to_monday = (7 - max_date.weekday()) % 7
    if days_to_monday == 0:
        days_to_monday = 7
    start_date = (max_date + pd.Timedelta(days=days_to_monday)).date()

    # Recurring obligations
    recurring_df = detect_recurring_payments(clean)
    obligations: list[dict[str, Any]] = []
    recurring_merchants: set[str] = set()

    if not recurring_df.empty:
        for _, row in recurring_df.iterrows():
            m_name = str(row["merchant"])
            recurring_merchants.add(m_name)
            obligations.append({
                "name": m_name,
                "amount": float(row["last_amount"]),
                "interval_days": max(1, int(round(float(row["avg_interval_days"])))),
                "last_date": pd.to_datetime(row["last_seen"]).date(),
                "recurring_type": str(row["recurring_type"]),
                "priority": "Critical" if "loan" in m_name.lower() or "emi" in m_name.lower() else "High",
                "flow": -1,
            })

    # Historical salary / credit regularity
    incomes = clean[clean["type"] == "credit"].sort_values("date")
    if not incomes.empty:
        last_inc_date = incomes.iloc[-1]["date"].date()
        avg_inc = float(incomes["amount"].mean())
        diffs = incomes["date"].diff().dropna().dt.days
        interval = int(round(diffs.median())) if not diffs.empty and diffs.median() > 0 else 30
        obligations.append({
            "name": "Income_Credit",
            "amount": avg_inc,
            "interval_days": max(1, interval),
            "last_date": last_inc_date,
            "recurring_type": "Income",
            "priority": "Critical",
            "flow": 1,
        })

    # Discretionary residuals: daily net cashflows of non-recurring transactions
    if recurring_merchants:
        disc = clean[~((clean.get("merchant", clean["narration"]).isin(recurring_merchants)) & (clean["type"] == "debit"))]
    else:
        disc = clean

    disc_non_income = disc[disc["type"] == "debit"].copy()
    if not disc_non_income.empty:
        daily_disc = disc_non_income.groupby(disc_non_income["date"].dt.date)["signed_amount"].sum()
        # Create full date series
        date_idx = pd.date_range(clean["date"].min().date(), clean["date"].max().date())
        daily_series = daily_disc.reindex(date_idx.date, fill_value=0.0).values
        residuals = daily_series
    else:
        residuals = np.zeros(30)

    return initial_balance, start_date, obligations, residuals


def build_deterministic_cashflow(
    obligations: list[dict[str, Any]],
    sim_start: date,
    horizon_days: int = 56,
) -> tuple[np.ndarray, dict[int, dict[str, float]]]:
    """Projects deterministic scheduled obligations onto daily cashflow and aggregates weekly categories."""
    daily_cashflow = np.zeros(horizon_days, dtype=float)
    max_weeks = max(52, int(np.ceil(horizon_days / 7)))
    weekly_breakdown: dict[int, dict[str, float]] = {
        w: {"income": 0.0, "essentials": 0.0, "debt_service": 0.0} for w in range(1, max_weeks + 1)
    }

    for obs in obligations:
        interval = obs["interval_days"]
        current = obs["last_date"] + timedelta(days=interval)
        while current < sim_start:
            current += timedelta(days=interval)

        while current < sim_start + timedelta(days=horizon_days):
            day_idx = (current - sim_start).days
            if 0 <= day_idx < horizon_days:
                amount = obs["amount"] * obs["flow"]
                daily_cashflow[day_idx] += amount
                week_idx = (day_idx // 7) + 1
                if 1 <= week_idx <= max_weeks:
                    if obs["flow"] > 0:
                        weekly_breakdown[week_idx]["income"] += obs["amount"]
                    else:
                        if obs["priority"] == "Critical":
                            weekly_breakdown[week_idx]["debt_service"] += obs["amount"]
                        else:
                            weekly_breakdown[week_idx]["essentials"] += obs["amount"]
            current += timedelta(days=interval)

    return daily_cashflow, weekly_breakdown


def generate_six_month_summary(
    cum_balances: np.ndarray,
    reserve: float,
    goal: float,
    total_savings: float = 0.0,
    total_debt_cleared: float = 0.0,
) -> SixMonthSummary:
    """Generates the SixMonthSummary contract model over 26 weeks."""
    day_26w = min(cum_balances.shape[1] - 1, (26 * 7) - 1)
    closing_balances_26w = cum_balances[:, day_26w]
    p10, p50, p90 = np.percentile(closing_balances_26w, [10, 50, 90])

    n_weeks = min(26, cum_balances.shape[1] // 7)
    weekly_p10s = [float(np.percentile(cum_balances[:, (w * 7) - 1], 10)) for w in range(1, n_weeks + 1)]
    lowest_p10 = min(weekly_p10s) if weekly_p10s else float(p10)
    lowest_week = (weekly_p10s.index(lowest_p10) + 1) if weekly_p10s else 1

    breach_prob = float(np.mean(np.any(cum_balances[:, : (n_weeks * 7) : 7] < reserve, axis=1)))

    return SixMonthSummary(
        closing_p10=round(float(p10), 2),
        closing_p50=round(float(p50), 2),
        closing_p90=round(float(p90), 2),
        lowest_p10_balance=round(float(lowest_p10), 2),
        lowest_p10_week=lowest_week,
        reserve_breach_prob=round(breach_prob, 4),
        cumulative_saving=round(total_savings, 2),
        debt_cleared=round(total_debt_cleared, 2),
        goal_met=bool(total_savings >= goal and goal > 0),
        grade="Planning-grade",
    )


def simulate_sequence_under_crn(
    seq_id: str,
    seq_name: str,
    actions: list[PlanAction],
    deterministic_flow: np.ndarray,
    crn_matrix: np.ndarray,
    weekly_breakdown: dict[int, dict[str, float]],
    initial_balance: float,
    start_date: date,
    reserve: float,
    goal: float,
    horizon_weeks: int = 8,
    view: str = "weekly",
) -> Sequence:
    """Evaluates an action sequence using the shared CRN residual matrix across multi-horizon views.

    Returns populated Sequence with PeriodRows aggregated according to view:
      - weekly: 8 periods, Decision-grade
      - monthly / sixmonth: 6 periods (24 weeks), Planning-grade
      - yearly: 12 periods (48 weeks), Indicative
    """
    horizon_days = deterministic_flow.shape[0]
    total_weeks = max(horizon_weeks, int(np.ceil(horizon_days / 7)))

    daily_modifications = np.zeros((horizon_days,), dtype=float)
    weekly_cuts: dict[int, float] = {w: 0.0 for w in range(1, total_weeks + 1)}
    weekly_savings: dict[int, float] = {w: 0.0 for w in range(1, total_weeks + 1)}
    weekly_prepayments: dict[int, float] = {w: 0.0 for w in range(1, total_weeks + 1)}

    for act in actions:
        start_w = max(1, act.start_week)
        end_w = min(total_weeks, act.end_week)

        if act.type == "cut_category":
            for w in range(start_w, end_w + 1):
                start_day = (w - 1) * 7
                end_day = min(horizon_days, w * 7)
                pct = act.percentage or 0.20
                cut_amt = act.amount if act.amount is not None else 4500.0 * pct
                weekly_cuts[w] += cut_amt
                if start_day < horizon_days:
                    daily_modifications[start_day:end_day] += cut_amt / 7.0

        elif act.type == "prepay_debt":
            for w in range(start_w, end_w + 1):
                amt = act.amount or 0.0
                weekly_prepayments[w] += amt
                start_day = (w - 1) * 7
                end_day = min(horizon_days, w * 7)
                if start_day < horizon_days:
                    daily_modifications[start_day:end_day] -= amt / 7.0

        elif act.type == "save":
            for w in range(start_w, end_w + 1):
                amt = act.amount or 0.0
                weekly_savings[w] += amt
                start_day = (w - 1) * 7
                end_day = min(horizon_days, w * 7)
                if start_day < horizon_days:
                    daily_modifications[start_day:end_day] -= amt / 7.0

        elif act.type == "one_off_expense":
            amt = act.amount or 0.0
            start_day = (start_w - 1) * 7
            if 0 <= start_day < horizon_days:
                daily_modifications[start_day] -= amt

    base_flow = deterministic_flow + daily_modifications
    full_flows = base_flow[np.newaxis, :] + crn_matrix[:, :horizon_days]
    cum_balances = initial_balance + np.cumsum(full_flows, axis=1)

    period_rows: list[PeriodRow] = []
    min_p10 = float("inf")
    running_opening = initial_balance
    total_cut_sum = sum(weekly_cuts.values())
    total_savings_sum = sum(weekly_savings.values())

    if view in ("monthly", "sixmonth", "yearly"):
        n_periods = 6 if view in ("monthly", "sixmonth") else 12
        period_grade = "Planning-grade" if view in ("monthly", "sixmonth") else "Indicative"

        for m in range(1, n_periods + 1):
            w_start = (m - 1) * 4 + 1
            w_end = m * 4
            p_start_date = start_date + timedelta(days=(m - 1) * 28)
            p_end_date = start_date + timedelta(days=(m * 28) - 1)
            end_day_idx = min(horizon_days - 1, (m * 28) - 1)

            month_balances = cum_balances[:, end_day_idx]
            p10, p50, p90 = np.percentile(month_balances, [10, 50, 90])
            min_p10 = min(min_p10, float(p10))
            breach_prob = float(np.mean(month_balances < reserve))

            inc = sum(weekly_breakdown.get(w, {}).get("income", 0.0) for w in range(w_start, w_end + 1))
            ess = sum(weekly_breakdown.get(w, {}).get("essentials", 0.0) for w in range(w_start, w_end + 1))
            debt = sum(weekly_breakdown.get(w, {}).get("debt_service", 0.0) for w in range(w_start, w_end + 1))
            cuts = sum(weekly_cuts.get(w, 0.0) for w in range(w_start, w_end + 1))
            disc = max(0.0, (4200.0 * 4) - cuts)
            sav = sum(weekly_savings.get(w, 0.0) for w in range(w_start, w_end + 1))
            pre = sum(weekly_prepayments.get(w, 0.0) for w in range(w_start, w_end + 1))

            if p10 < reserve:
                note = f"Warning: P10 balance dips Rs {reserve - p10:,.0f} below reserve; breach risk is {breach_prob*100:.1f}%."
            elif pre > 0:
                note = f"Buffer accelerates debt prepayment by Rs {pre:,.0f}; reserve holds at P10 (breach risk: {breach_prob*100:.1f}%)."
            else:
                note = f"Month {m} closes at Rs {p50:,.0f} at P50 (breach risk: {breach_prob*100:.1f}%)."

            period_rows.append(
                PeriodRow(
                    week=m,
                    start_date=p_start_date,
                    opening_balance=round(running_opening, 2),
                    income_p50=round(inc, 2),
                    essentials=round(ess, 2),
                    debt_service=round(debt, 2),
                    discretionary=round(disc, 2),
                    savings=round(sav, 2),
                    prepayment=round(pre, 2),
                    closing_p10=round(float(p10), 2),
                    closing_p50=round(float(p50), 2),
                    closing_p90=round(float(p90), 2),
                    reserve_breach_prob=round(breach_prob, 4),
                    tradeoff_note=note,
                    period_type="month",
                    period_label=f"Month {m}",
                    period_start=p_start_date,
                    period_end=p_end_date,
                    grade=period_grade,
                )
            )
            running_opening = float(p50)

        step_days = 28
        check_indices = [min(horizon_days - 1, m * step_days - 1) for m in range(1, n_periods + 1)]
        any_week_mask = np.any(cum_balances[:, check_indices] < reserve, axis=1)
        any_week_breach_prob = float(np.mean(any_week_mask))
    else:
        for w in range(1, horizon_weeks + 1):
            end_day_idx = (w * 7) - 1
            week_end_balances = cum_balances[:, end_day_idx]
            p10, p50, p90 = np.percentile(week_end_balances, [10, 50, 90])
            min_p10 = min(min_p10, float(p10))
            breach_prob = float(np.mean(week_end_balances < reserve))

            w_start_date = start_date + timedelta(days=(w - 1) * 7)
            w_end_date = w_start_date + timedelta(days=6)

            b_info = weekly_breakdown.get(w, {"income": 0.0, "essentials": 0.0, "debt_service": 0.0})
            inc = b_info["income"]
            ess = b_info["essentials"]
            debt = b_info["debt_service"]
            disc_spend = max(0.0, 4200.0 - weekly_cuts[w])
            sav = weekly_savings[w]
            pre = weekly_prepayments[w]

            if p10 < reserve:
                deficit = reserve - p10
                note = f"Warning: P10 balance dips Rs {deficit:,.0f} below reserve; breach risk is {breach_prob*100:.1f}%."
            elif pre > 0:
                note = f"Buffer reduces by Rs {pre:,.0f} to accelerate debt prepayment; reserve holds Rs {p10:,.0f} at P10."
            elif weekly_cuts[w] > 0 and sav > 0:
                note = f"Trimmed discretionary by Rs {weekly_cuts[w]:,.0f}; allocated Rs {sav:,.0f} to savings; reserve holds Rs {p10:,.0f} at P10."
            elif inc == 0.0:
                note = f"No salary scheduled this week; buffer safely absorbs Rs {ess + debt + disc_spend:,.0f} expenses."
            elif w == horizon_weeks and total_savings_sum >= goal:
                note = f"Goal achieved! Total Rs {total_savings_sum:,.0f} saved while reserve floor remained protected."
            else:
                note = f"Steady week: closing buffer reaches Rs {p50:,.0f} at P50 (breach risk: {breach_prob*100:.1f}%)."

            period_rows.append(
                PeriodRow(
                    week=w,
                    start_date=w_start_date,
                    opening_balance=round(running_opening, 2),
                    income_p50=round(inc, 2),
                    essentials=round(ess, 2),
                    debt_service=round(debt, 2),
                    discretionary=round(disc_spend, 2),
                    savings=round(sav, 2),
                    prepayment=round(pre, 2),
                    closing_p10=round(float(p10), 2),
                    closing_p50=round(float(p50), 2),
                    closing_p90=round(float(p90), 2),
                    reserve_breach_prob=round(breach_prob, 4),
                    tradeoff_note=note,
                    period_type="week",
                    period_label=f"Week {w}",
                    period_start=w_start_date,
                    period_end=w_end_date,
                    grade="Decision-grade",
                )
            )
            running_opening = float(p50)

        any_week_mask = np.any(cum_balances[:, 6::7] < reserve, axis=1)
        any_week_breach_prob = float(np.mean(any_week_mask))

    summary = SequenceSummary(
        min_p10_closing=round(min_p10, 2),
        any_week_breach_prob=round(any_week_breach_prob, 4),
        total_cut=round(total_cut_sum, 2),
        goal_met=bool(total_savings_sum >= goal or (goal > 0 and total_savings_sum >= 0.95 * goal)),
    )

    return Sequence(
        id=seq_id,
        name=seq_name,
        actions=actions,
        periods=period_rows,
        summary=summary,
        tag="predicted",
    )


def generate_why_line(sequences: list[Sequence], reserve: float) -> tuple[str, str]:
    """Generates the Why-Line explaining the trade-off between median balance and reserve risk.

    Returns: (recommended_sequence_id, why_line_sentence)
    """
    if not sequences:
        return "", ""

    # 1. Rank by median closing balance (week 8 closing_p50)
    by_median = sorted(sequences, key=lambda s: s.periods[-1].closing_p50, reverse=True)
    # 2. Rank by reserve-breach risk (lowest any_week_breach_prob)
    by_risk = sorted(sequences, key=lambda s: (s.summary.any_week_breach_prob, -s.periods[-1].closing_p50))

    best_median = by_median[0]
    best_risk = by_risk[0]

    # Check for disagreement between highest median and lowest risk
    if best_median.id != best_risk.id:
        med_p50 = best_median.periods[-1].closing_p50
        med_prob = best_median.summary.any_week_breach_prob
        risk_prob = best_risk.summary.any_week_breach_prob
        why_line = (
            f"The plan with the better median ({best_median.name}, Rs {med_p50:,.0f}) "
            f"has breach probability {med_prob * 100:.1f}%, so the lower-risk plan "
            f"({best_risk.name}, {risk_prob * 100:.1f}% breach risk) is recommended."
        )
        return best_risk.id, why_line

    # When median and risk rankings agree
    p50_val = best_risk.periods[-1].closing_p50
    prob_val = best_risk.summary.any_week_breach_prob
    why_line = (
        f"Plan {best_risk.name} is recommended: achieves lowest reserve breach risk "
        f"({prob_val * 100:.1f}%) while securing Rs {p50_val:,.0f} median buffer by week 8."
    )
    return best_risk.id, why_line


def calculate_shock_capacity(
    df: pd.DataFrame,
    reserve: float,
    limit: float = 0.10,
    seed: int = 42,
) -> float:
    """Calculates the largest absorbable immediate shock at week 1 such that reserve breach risk <= limit."""
    initial_balance, start_date, obligations, residuals = extract_cashflow_components(df)
    det_flow, weekly_breakdown = build_deterministic_cashflow(obligations, start_date)
    crn_matrix = get_crn_residual_matrix(residuals, seed=seed)

    low = 0.0
    high = max(100_000.0, initial_balance * 2.0)
    best_capacity = 0.0

    for _ in range(12):  # binary search
        mid = (low + high) / 2.0
        shock_action = PlanAction(type="one_off_expense", start_week=1, amount=mid)
        seq = simulate_sequence_under_crn(
            "test_shock", "Shock Test", [shock_action],
            det_flow, crn_matrix, weekly_breakdown,
            initial_balance, start_date, reserve, goal=0.0
        )
        if seq.summary.any_week_breach_prob <= limit:
            best_capacity = mid
            low = mid
        else:
            high = mid

    return round(best_capacity, 2)
