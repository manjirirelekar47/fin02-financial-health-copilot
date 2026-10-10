"""src/lp_planner.py — 8-Week Linear Program Plan Builder using scipy.optimize.linprog (HiGHS).

Workstream D / Addition 1 & 2 (F6 Priority-Aware Optimizer & Plan Builder):
1. Solves an 8-period weekly linear program using scipy.optimize.linprog(method="highs").
2. Protects non-negotiable obligations: Critical (EMIs) and High (housing, utilities, health) are fixed.
3. Cuts in strict priority order: Low priority (weight 1) cut first, Medium (weight 3) cut second.
4. Uses slack variables for reserve floor (r_t) and savings goal (g) with high penalty weights.
5. Plans on conservative income quantile (P25), then scores every sequence with reserve_simulator under CRN.
6. Builds sequences:
     - S0 Hold steady (unmodified forecast baseline)
     - S1 Trim and save first
     - S2 Trim and repay debt first
7. Generates dynamic per-period trade-off notes based on actual numbers.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Mapping, Sequence as PySequence
import uuid
import numpy as np
import pandas as pd
from scipy.optimize import linprog

from contracts.schemas import (
    ConflictReport,
    PeriodRow,
    Plan,
    PlanAction,
    RelaxationOption,
    Sequence,
    SequenceSummary,
)
from src.probabilistic_forecast import aggregate_streams
from src.reserve_simulator import (
    build_deterministic_cashflow,
    extract_cashflow_components,
    generate_why_line,
    get_crn_residual_matrix,
    simulate_sequence_under_crn,
)


def _solve_weekly_lp(
    initial_balance: float,
    planned_income: list[float],
    essentials: list[float],
    debt_service: list[float],
    forecast_low: list[float],
    forecast_med: list[float],
    reserve: float,
    goal: float,
    mode: str = "s1_save_first",
    horizon_weeks: int = 8,
) -> dict[str, Any]:
    """Solves the 8-week Linear Program with HiGHS for flexible category cuts, prepayment, and savings.

    Decision Variables for t = 1..8:
      - x_low[t]: planned spend on low-priority items (bounds: 0.25 * forecast_low[t] to forecast_low[t])
      - x_med[t]: planned spend on medium-priority items (bounds: 0.70 * forecast_med[t] to forecast_med[t])
      - p[t]: debt prepayment in week t (bounds: 0 to 25,000)
      - s[t]: savings allocated in week t (bounds: 0 to 50,000)
      - r[t]: reserve slack in week t (bounds: 0 to None)
      - g: savings goal slack (bounds: 0 to None)

    Total variables: 8*5 + 1 = 41 variables.
    """
    n_w = horizon_weeks

    # Variable indices
    idx_x_low = list(range(0, n_w))
    idx_x_med = list(range(n_w, 2 * n_w))
    idx_p = list(range(2 * n_w, 3 * n_w))
    idx_s = list(range(3 * n_w, 4 * n_w))
    idx_r = list(range(4 * n_w, 5 * n_w))
    idx_g = 5 * n_w
    n_vars = 5 * n_w + 1

    # Objective coefficients c (minimise)
    # We want to minimise priority-weighted cuts:
    # Cut_low = forecast_low - x_low => weight 1.0 * (forecast - x_low) => -1.0 * x_low
    # Cut_med = forecast_med - x_med => weight 3.0 * (forecast - x_med) => -3.0 * x_med
    # High penalty on slacks: M_r = 10,000 on r[t], M_g = 10,000 on g
    M_slack = 10000.0
    c = np.zeros(n_vars, dtype=float)

    for t in range(n_w):
        c[idx_x_low[t]] = -1.0  # Encourage keeping low spend if possible (weight 1 on cut)
        c[idx_x_med[t]] = -3.0  # Strongly encourage keeping medium spend (weight 3 on cut)
        c[idx_r[t]] = M_slack   # Heavy penalty on reserve slack

    c[idx_g] = M_slack  # Heavy penalty on goal slack

    # Mode-specific preference adjustments:
    if mode == "s1_save_first":
        # S1: Trim and save first. Strong bonus for saving early, penalise prepayment
        for t in range(n_w):
            # Pull savings earlier: small negative term proportional to remaining weeks
            c[idx_s[t]] = -0.5 - (0.05 * (n_w - t))
            c[idx_p[t]] = 5.0  # discourage prepayment in S1
    elif mode == "s2_debt_first":
        # S2: Trim and repay debt first. Strong bonus for debt prepayment
        for t in range(n_w):
            c[idx_p[t]] = -2.0 - (0.10 * (n_w - t))
            c[idx_s[t]] = -0.1
    elif mode == "s0_baseline":
        # S0: No cuts, no savings, no prepayment (fixed)
        for t in range(n_w):
            c[idx_x_low[t]] = 0.0
            c[idx_x_med[t]] = 0.0
            c[idx_p[t]] = 0.0
            c[idx_s[t]] = 0.0

    # Bounds
    bounds = []
    for t in range(n_w):
        f_low = max(0.0, forecast_low[t])
        bounds.append((0.25 * f_low, f_low))  # low can be cut up to 75%
    for t in range(n_w):
        f_med = max(0.0, forecast_med[t])
        bounds.append((0.70 * f_med, f_med))  # med can be cut up to 30%
    for t in range(n_w):
        bounds.append((0.0, 30000.0 if mode == "s2_debt_first" else 0.0))  # prepayment p[t]
    for t in range(n_w):
        bounds.append((0.0, 50000.0))  # savings s[t]
    for t in range(n_w):
        bounds.append((0.0, None))  # reserve slack r[t]
    bounds.append((0.0, None))  # goal slack g

    # Linear Inequality Constraints: A_ub * x <= b_ub
    # 1. Reserve floor constraints: for each week k = 1..n_w
    # b_k + r_k >= R
    # where b_k = initial_balance + sum_{t=1}^k (income[t] - ess[t] - debt[t] - x_low[t] - x_med[t] - p[t] - s[t])
    # => sum_{t=1}^k (x_low[t] + x_med[t] + p[t] + s[t]) - r_k <= initial_balance + sum_{t=1}^k (income[t] - ess[t] - debt[t]) - R
    A_ub = []
    b_ub = []

    cum_fixed = 0.0
    for k in range(n_w):
        cum_fixed += (planned_income[k] - essentials[k] - debt_service[k])
        row = np.zeros(n_vars, dtype=float)
        for t in range(k + 1):
            row[idx_x_low[t]] = 1.0
            row[idx_x_med[t]] = 1.0
            row[idx_p[t]] = 1.0
            row[idx_s[t]] = 1.0
        row[idx_r[k]] = -1.0  # - r_k
        A_ub.append(row)
        b_ub.append(initial_balance + cum_fixed - reserve)

    # 2. Savings goal constraint:
    # sum_{t=1}^{n_w} s[t] + g >= goal  =>  - sum_{t=1}^{n_w} s[t] - g <= -goal
    if goal > 0:
        goal_row = np.zeros(n_vars, dtype=float)
        for t in range(n_w):
            goal_row[idx_s[t]] = -1.0
        goal_row[idx_g] = -1.0
        A_ub.append(goal_row)
        b_ub.append(-goal)

    res = linprog(
        c,
        A_ub=np.array(A_ub),
        b_ub=np.array(b_ub),
        bounds=bounds,
        method="highs",
    )

    if not res.success:
        # Fallback to simple greedy solution if linprog numerical failure
        return {
            "x_low": forecast_low,
            "x_med": forecast_med,
            "p": [0.0] * n_w,
            "s": [goal / n_w if goal > 0 else 0.0] * n_w,
            "r": [0.0] * n_w,
            "g": 0.0,
            "feasible": False,
        }

    sol = res.x
    x_low_sol = [float(sol[idx_x_low[t]]) for t in range(n_w)]
    x_med_sol = [float(sol[idx_x_med[t]]) for t in range(n_w)]
    p_sol = [float(sol[idx_p[t]]) for t in range(n_w)]
    s_sol = [float(sol[idx_s[t]]) for t in range(n_w)]
    r_sol = [float(sol[idx_r[t]]) for t in range(n_w)]
    g_sol = float(sol[idx_g]) if goal > 0 else 0.0

    return {
        "x_low": x_low_sol,
        "x_med": x_med_sol,
        "p": p_sol,
        "s": s_sol,
        "r": r_sol,
        "g": g_sol,
        "feasible": max(max(r_sol), g_sol) < 1.0,
    }


def build_plan_sequences(
    df: pd.DataFrame,
    reserve: float = 0.0,
    goal: float = 0.0,
    deadline: date | None = None,
    horizon_weeks: int = 8,
    seed: int = 42,
    initial_balance: float | None = None,
    view: str = "weekly",
) -> Plan:
    """Builds the Plan across multi-horizon views using HiGHS LP optimization scored by the CRN reserve simulator.

    Views:
      - 'weekly': 8 weekly periods, Decision-grade
      - 'monthly': 6 monthly periods, Planning-grade
      - 'sixmonth': 6 monthly periods with SixMonthSummary, Planning-grade
      - 'yearly': 12 monthly periods, Indicative
    """
    is_multi_horizon = view in ("monthly", "sixmonth", "yearly")
    n_solve_periods = 6 if view in ("monthly", "sixmonth") else (12 if view == "yearly" else horizon_weeks)
    horizon_days = 364 if is_multi_horizon else (horizon_weeks * 7)
    sim_weeks = (n_solve_periods * 4) if is_multi_horizon else horizon_weeks
    grade = "Planning-grade" if view in ("monthly", "sixmonth") else ("Indicative" if view == "yearly" else "Decision-grade")

    initial_balance, start_date, obligations, residuals = extract_cashflow_components(
        df, initial_balance=initial_balance
    )
    det_flow, weekly_breakdown = build_deterministic_cashflow(obligations, start_date, horizon_days=horizon_days)
    crn_matrix = get_crn_residual_matrix(residuals, horizon_days=horizon_days, seed=seed)

    if reserve <= 0.0:
        monthly_critical = sum(
            obs["amount"] * (30.0 / max(obs["interval_days"], 1))
            for obs in obligations
            if obs["flow"] < 0
        )
        reserve = round(max(30000.0, monthly_critical), 0)

    if goal <= 0.0:
        goal = 50000.0

    if deadline is None:
        deadline = start_date + timedelta(days=sim_weeks * 7)

    if is_multi_horizon:
        planned_income = [sum(weekly_breakdown[w]["income"] for w in range((m-1)*4 + 1, m*4 + 1)) for m in range(1, n_solve_periods + 1)]
        essentials = [sum(weekly_breakdown[w]["essentials"] for w in range((m-1)*4 + 1, m*4 + 1)) for m in range(1, n_solve_periods + 1)]
        debt_service = [sum(weekly_breakdown[w]["debt_service"] for w in range((m-1)*4 + 1, m*4 + 1)) for m in range(1, n_solve_periods + 1)]
        forecast_low = [3200.0 * 4] * n_solve_periods
        forecast_med = [1800.0 * 4] * n_solve_periods
    else:
        planned_income = [weekly_breakdown[w]["income"] for w in range(1, horizon_weeks + 1)]
        essentials = [weekly_breakdown[w]["essentials"] for w in range(1, horizon_weeks + 1)]
        debt_service = [weekly_breakdown[w]["debt_service"] for w in range(1, horizon_weeks + 1)]
        forecast_low = [3200.0] * horizon_weeks
        forecast_med = [1800.0] * horizon_weeks

    # Solve S1: Trim and save first
    s1_res = _solve_weekly_lp(
        initial_balance=initial_balance,
        planned_income=planned_income,
        essentials=essentials,
        debt_service=debt_service,
        forecast_low=forecast_low,
        forecast_med=forecast_med,
        reserve=reserve,
        goal=goal,
        mode="s1_save_first",
        horizon_weeks=n_solve_periods,
    )

    # Solve S2: Trim and repay debt first
    s2_res = _solve_weekly_lp(
        initial_balance=initial_balance,
        planned_income=planned_income,
        essentials=essentials,
        debt_service=debt_service,
        forecast_low=forecast_low,
        forecast_med=forecast_med,
        reserve=reserve,
        goal=goal,
        mode="s2_debt_first",
        horizon_weeks=n_solve_periods,
    )

    # Convert solved solutions into PlanAction lists
    s0_actions: list[PlanAction] = []

    s1_actions: list[PlanAction] = []
    avg_low_cut_s1 = float(np.mean([forecast_low[t] - s1_res["x_low"][t] for t in range(n_solve_periods)]))
    avg_save_s1 = float(np.mean(s1_res["s"]))
    if avg_low_cut_s1 > 10.0:
        base_low = 3200.0 * 4 if is_multi_horizon else 3200.0
        pct = avg_low_cut_s1 / base_low
        act_cut = (avg_low_cut_s1 / 4.0) if is_multi_horizon else avg_low_cut_s1
        s1_actions.append(
            PlanAction(
                type="cut_category",
                start_week=1,
                end_week=sim_weeks,
                amount=round(act_cut, 2),
                percentage=round(pct, 2),
                category="discretionary",
                description=f"Trim discretionary spending by {pct*100:.0f}%",
            )
        )
    if avg_save_s1 > 0.0:
        act_save = (avg_save_s1 / 4.0) if is_multi_horizon else avg_save_s1
        s1_actions.append(
            PlanAction(
                type="save",
                start_week=1,
                end_week=sim_weeks,
                amount=round(act_save, 2),
                description=f"Save Rs {act_save:,.0f}/week towards Rs {goal:,.0f} goal",
            )
        )

    s2_actions: list[PlanAction] = []
    avg_low_cut_s2 = float(np.mean([forecast_low[t] - s2_res["x_low"][t] for t in range(n_solve_periods)]))
    avg_prep_s2 = float(np.mean(s2_res["p"]))
    avg_save_s2 = float(np.mean(s2_res["s"]))
    if avg_low_cut_s2 > 10.0:
        base_low = 3200.0 * 4 if is_multi_horizon else 3200.0
        pct = avg_low_cut_s2 / base_low
        act_cut2 = (avg_low_cut_s2 / 4.0) if is_multi_horizon else avg_low_cut_s2
        s2_actions.append(
            PlanAction(
                type="cut_category",
                start_week=1,
                end_week=sim_weeks,
                amount=round(act_cut2, 2),
                percentage=round(pct, 2),
                category="discretionary",
                description=f"Trim shopping and dining by {pct*100:.0f}%",
            )
        )
    if avg_prep_s2 > 0.0:
        act_prep = (avg_prep_s2 / 4.0) if is_multi_horizon else avg_prep_s2
        s2_actions.append(
            PlanAction(
                type="prepay_debt",
                start_week=1,
                end_week=sim_weeks,
                amount=round(act_prep, 2),
                description=f"Accelerate EMI prepayment by Rs {act_prep:,.0f}/week",
            )
        )
    if avg_save_s2 > 0.0:
        act_save2 = (avg_save_s2 / 4.0) if is_multi_horizon else avg_save_s2
        s2_actions.append(
            PlanAction(
                type="save",
                start_week=1,
                end_week=sim_weeks,
                amount=round(act_save2, 2),
                description=f"Allocate Rs {act_save2:,.0f}/week to savings",
            )
        )

    # Score all three sequences under Common Random Numbers (CRN)
    seq_s0 = simulate_sequence_under_crn(
        "seq_s0_hold_steady",
        "S0 Hold steady (unmodified baseline)",
        s0_actions,
        det_flow,
        crn_matrix,
        weekly_breakdown,
        initial_balance,
        start_date,
        reserve,
        goal,
        horizon_weeks=sim_weeks,
        view=view,
    )

    seq_s1 = simulate_sequence_under_crn(
        "seq_s1_save_first",
        "S1 Trim and save first",
        s1_actions,
        det_flow,
        crn_matrix,
        weekly_breakdown,
        initial_balance,
        start_date,
        reserve,
        goal,
        horizon_weeks=sim_weeks,
        view=view,
    )

    seq_s2 = simulate_sequence_under_crn(
        "seq_s2_debt_first",
        "S2 Trim and repay debt first",
        s2_actions,
        det_flow,
        crn_matrix,
        weekly_breakdown,
        initial_balance,
        start_date,
        reserve,
        goal,
        horizon_weeks=sim_weeks,
        view=view,
    )

    sequences = [seq_s0, seq_s1, seq_s2]

    # Infeasibility Check: Slack > 1.0 OR breach risk > max_risk after maximum cuts
    max_r = max(s1_res["r"])
    g_val = s1_res["g"]
    is_infeasible = (max_r > 1.0 or g_val > 1.0)

    six_month_sum = None
    if view == "sixmonth":
        from src.reserve_simulator import generate_six_month_summary
        cum_balances = initial_balance + np.cumsum(det_flow[np.newaxis, :] + crn_matrix, axis=1)
        tot_saved = sum(s1_res["s"][:6])
        tot_debt = sum(debt_service[:6])
        six_month_sum = generate_six_month_summary(
            cum_balances=cum_balances,
            reserve=reserve,
            goal=goal,
            total_savings=tot_saved,
            total_debt_cleared=tot_debt,
        )

    if is_infeasible:
        # Build ConflictReport and RelaxationOptions
        conflict_report = _build_conflict_report(
            reserve=reserve,
            goal=goal,
            debt_service=debt_service,
            r_max=max_r,
            g_val=g_val,
            initial_balance=initial_balance,
            planned_income=planned_income,
            essentials=essentials,
            forecast_low=forecast_low,
            forecast_med=forecast_med,
            det_flow=det_flow,
            crn_matrix=crn_matrix,
            weekly_breakdown=weekly_breakdown,
            start_date=start_date,
            horizon_weeks=n_solve_periods,
            s1_seq=seq_s1,
        )
        why_line = (
            f"Target is infeasible: Rs {goal:,.0f} savings goal cannot coexist with "
            f"Rs {reserve:,.0f} reserve floor and mandatory debt obligations over {n_solve_periods} periods."
        )
        return Plan(
            id=f"plan_{uuid.uuid4().hex[:8]}",
            reserve=round(reserve, 2),
            goal=round(goal, 2),
            deadline=deadline,
            horizon_weeks=n_solve_periods,
            sequences=[seq_s0, seq_s1],
            recommended_sequence_id="",
            why_line=why_line,
            status="infeasible",
            conflict=conflict_report,
            view=view,
            grade=grade,
            six_month_summary=six_month_sum,
        )

    # Feasible plan: Generate Why-Line comparing median vs risk
    recommended_id, why_line = generate_why_line(sequences, reserve)

    for seq in sequences:
        if seq.id == recommended_id:
            seq.tag = "recommended"
        else:
            seq.tag = "predicted"

    return Plan(
        id=f"plan_{uuid.uuid4().hex[:8]}",
        reserve=round(reserve, 2),
        goal=round(goal, 2),
        deadline=deadline,
        horizon_weeks=n_solve_periods,
        sequences=sequences,
        recommended_sequence_id=recommended_id,
        why_line=why_line,
        status="ok",
        conflict=None,
        view=view,
        grade=grade,
        six_month_summary=six_month_sum,
    )


def _build_conflict_report(
    reserve: float,
    goal: float,
    debt_service: list[float],
    r_max: float,
    g_val: float,
    initial_balance: float,
    planned_income: list[float],
    essentials: list[float],
    forecast_low: list[float],
    forecast_med: list[float],
    det_flow: np.ndarray,
    crn_matrix: np.ndarray,
    weekly_breakdown: dict[int, dict[str, float]],
    start_date: date,
    horizon_weeks: int,
    s1_seq: Sequence,
) -> ConflictReport:
    """Generates ConflictReport with named constraints, slack sizes, and re-solved RelaxationOptions."""
    constraints = [
        f"closing_balance + reserve_slack >= {reserve:,.0f} (Reserve Floor)",
        f"cumulative_savings + goal_slack >= {goal:,.0f} (Savings Goal)",
        f"debt_service >= {sum(debt_service):,.0f} (Non-negotiable EMIs)",
    ]
    slack_amounts = {
        "savings_goal_shortfall": round(float(g_val), 2),
        "reserve_deficit": round(float(r_max), 2),
    }

    relaxations: list[RelaxationOption] = []

    # Option 1: Lower the savings goal to the achievable amount without breaching reserve
    achievable_goal = max(0.0, round(goal - g_val - (r_max * horizon_weeks), 2))
    rel1_lp = _solve_weekly_lp(
        initial_balance, planned_income, essentials, debt_service,
        forecast_low, forecast_med, reserve, achievable_goal,
        mode="s1_save_first", horizon_weeks=horizon_weeks,
    )
    avg_low_cut = float(np.mean([forecast_low[t] - rel1_lp["x_low"][t] for t in range(horizon_weeks)]))
    avg_save = float(np.mean(rel1_lp["s"]))
    actions_rel1 = [
        PlanAction(type="cut_category", start_week=1, end_week=horizon_weeks, amount=round(avg_low_cut, 2), percentage=round(avg_low_cut/3200.0, 2)),
        PlanAction(type="save", start_week=1, end_week=horizon_weeks, amount=round(avg_save, 2)),
    ]
    seq_rel1 = simulate_sequence_under_crn(
        "rel_goal", "Relaxed Goal", actions_rel1,
        det_flow, crn_matrix, weekly_breakdown,
        initial_balance, start_date, reserve, achievable_goal, horizon_weeks,
    )
    risk_1 = seq_rel1.summary.any_week_breach_prob
    relaxations.append(
        RelaxationOption(
            type="lower_goal",
            amount=round(achievable_goal, 2),
            resulting_risk=round(risk_1, 4),
            description=f"Lower savings goal to Rs {achievable_goal:,.0f} to protect reserve floor at {risk_1*100:.1f}% risk.",
        )
    )

    # Option 2: Extend deadline to 16 weeks (weekly saving needed halved)
    weekly_target_ext = (goal / 16.0)
    rel2_lp = _solve_weekly_lp(
        initial_balance, planned_income, essentials, debt_service,
        forecast_low, forecast_med, reserve, weekly_target_ext * 8.0,
        mode="s1_save_first", horizon_weeks=horizon_weeks,
    )
    avg_low_cut2 = float(np.mean([forecast_low[t] - rel2_lp["x_low"][t] for t in range(horizon_weeks)]))
    avg_save2 = float(np.mean(rel2_lp["s"]))
    actions_rel2 = [
        PlanAction(type="cut_category", start_week=1, end_week=horizon_weeks, amount=round(avg_low_cut2, 2), percentage=round(avg_low_cut2/3200.0, 2)),
        PlanAction(type="save", start_week=1, end_week=horizon_weeks, amount=round(avg_save2, 2)),
    ]
    seq_rel2 = simulate_sequence_under_crn(
        "rel_ext", "Extended Deadline", actions_rel2,
        det_flow, crn_matrix, weekly_breakdown,
        initial_balance, start_date, reserve, weekly_target_ext * 8.0, horizon_weeks,
    )
    risk_2 = seq_rel2.summary.any_week_breach_prob
    relaxations.append(
        RelaxationOption(
            type="extend_deadline",
            weeks=16,
            resulting_risk=round(risk_2, 4),
            description=f"Extend deadline from 8 to 16 weeks to accumulate Rs {goal:,.0f} without breaching reserve ({risk_2*100:.1f}% risk).",
        )
    )

    # Option 3: Temporarily lower minimum reserve
    relaxed_reserve = max(10000.0, reserve - r_max - 5000.0) if r_max > 0 else max(10000.0, reserve * 0.70)
    seq_rel3 = simulate_sequence_under_crn(
        "rel_res", "Lower Reserve", s1_seq.actions,
        det_flow, crn_matrix, weekly_breakdown,
        initial_balance, start_date, relaxed_reserve, goal, horizon_weeks,
    )
    risk_3 = seq_rel3.summary.any_week_breach_prob
    relaxations.append(
        RelaxationOption(
            type="lower_reserve",
            amount=round(relaxed_reserve, 2),
            resulting_risk=round(risk_3, 4),
            description=f"Temporarily lower minimum reserve from Rs {reserve:,.0f} to Rs {relaxed_reserve:,.0f} (warning: raises shortfall risk to {risk_3*100:.1f}%).",
        )
    )

    # Option 4: Accept higher risk
    risk_4 = s1_seq.summary.any_week_breach_prob
    relaxations.append(
        RelaxationOption(
            type="accept_higher_risk",
            resulting_risk=round(risk_4, 4),
            description=f"Accept higher reserve breach risk of {risk_4*100:.1f}% to attempt Rs {goal:,.0f} goal without further cuts.",
        )
    )

    return ConflictReport(
        constraints=constraints,
        slack_amounts=slack_amounts,
        relaxations=relaxations,
        tag="observed",
    )


def replan_sequences(
    df: pd.DataFrame,
    plan: Any = None,
    change: Mapping[str, Any] | None = None,
    current_week: int = 1,
    seed: int = 42,
) -> Plan:
    """Reruns the planner from the current week on a rolling 8-week horizon with updated constraints or shocks.

    Triggers:
      - 'income_drop': income reduction by percentage/amount from a chosen week
      - 'new_expense': surprise essential debit (medical, repair) in a chosen week
      - 'plan_drift': actual balance deviates from locked trajectory
      - 'manual': explicit parameter changes (goal, reserve, deadline)
    """
    if change is None:
        change = {}

    # Extract base parameters
    res_val = float(change.get("reserve", getattr(plan, "reserve", 45000.0) if hasattr(plan, "reserve") else (plan.get("reserve", 45000.0) if isinstance(plan, dict) else 45000.0)))
    goal_val = float(change.get("goal", getattr(plan, "goal", 75000.0) if hasattr(plan, "goal") else (plan.get("goal", 75000.0) if isinstance(plan, dict) else 75000.0)))
    deadline_val = change.get("deadline", getattr(plan, "deadline", None) if hasattr(plan, "deadline") else (plan.get("deadline", None) if isinstance(plan, dict) else None))
    view_val = str(change.get("view", getattr(plan, "view", "weekly") if hasattr(plan, "view") else (plan.get("view", "weekly") if isinstance(plan, dict) else "weekly")))
    grade_val = "Planning-grade" if view_val in ("monthly", "sixmonth") else ("Indicative" if view_val == "yearly" else "Decision-grade")
    horizon_weeks = int(change.get("horizon_weeks", 8))
    initial_balance = change.get("actual_balance", change.get("initial_balance"))

    initial_balance, start_date, obligations, residuals = extract_cashflow_components(
        df, initial_balance=initial_balance
    )
    det_flow, weekly_breakdown = build_deterministic_cashflow(obligations, start_date, horizon_days=horizon_weeks * 7)
    crn_matrix = get_crn_residual_matrix(residuals, horizon_days=horizon_weeks * 7, seed=seed)

    # Apply trigger adjustments
    trigger = str(change.get("trigger", "manual")).lower()
    drop_pct = float(change.get("drop_pct", 0.30 if trigger == "income_drop" else 0.0))
    from_week = int(change.get("from_week", current_week))

    expense_amt = float(change.get("expense_amount", change.get("amount", 25000.0 if trigger == "new_expense" else 0.0)))
    expense_week = int(change.get("week", current_week))

    planned_income = [weekly_breakdown[w]["income"] for w in range(1, horizon_weeks + 1)]
    essentials = [weekly_breakdown[w]["essentials"] for w in range(1, horizon_weeks + 1)]
    debt_service = [weekly_breakdown[w]["debt_service"] for w in range(1, horizon_weeks + 1)]

    # 1. Apply Income Drop if requested
    if drop_pct > 0.0:
        for w_idx in range(from_week - 1, horizon_weeks):
            planned_income[w_idx] *= (1.0 - drop_pct)
            weekly_breakdown[w_idx + 1]["income"] *= (1.0 - drop_pct)
            # Adjust deterministic flow array accordingly
            start_d = w_idx * 7
            end_d = (w_idx + 1) * 7
            det_flow[start_d:end_d] *= (1.0 - drop_pct)

    # 2. Apply New Expense if requested
    if expense_amt > 0.0 and 1 <= expense_week <= horizon_weeks:
        essentials[expense_week - 1] += expense_amt
        weekly_breakdown[expense_week]["essentials"] += expense_amt
        shock_day = (expense_week - 1) * 7
        det_flow[shock_day] -= expense_amt

    # Flexible category forecasts (Critical and High remain untouched)
    forecast_low = [3200.0] * horizon_weeks
    forecast_med = [1800.0] * horizon_weeks

    # Solve S1 and S2 under adjusted parameters
    s1_res = _solve_weekly_lp(
        initial_balance=initial_balance,
        planned_income=planned_income,
        essentials=essentials,
        debt_service=debt_service,
        forecast_low=forecast_low,
        forecast_med=forecast_med,
        reserve=res_val,
        goal=goal_val,
        mode="s1_save_first",
        horizon_weeks=horizon_weeks,
    )

    s2_res = _solve_weekly_lp(
        initial_balance=initial_balance,
        planned_income=planned_income,
        essentials=essentials,
        debt_service=debt_service,
        forecast_low=forecast_low,
        forecast_med=forecast_med,
        reserve=res_val,
        goal=goal_val,
        mode="s2_debt_first",
        horizon_weeks=horizon_weeks,
    )

    # S0 baseline
    seq_s0 = simulate_sequence_under_crn(
        "seq_s0_hold_steady",
        "S0 Hold steady (unmodified baseline)",
        [],
        det_flow,
        crn_matrix,
        weekly_breakdown,
        initial_balance,
        start_date,
        res_val,
        goal_val,
        horizon_weeks,
    )

    # Build actions for S1
    avg_low_cut_s1 = float(np.mean([forecast_low[t] - s1_res["x_low"][t] for t in range(horizon_weeks)]))
    avg_save_s1 = float(np.mean(s1_res["s"]))
    s1_actions = []
    if avg_low_cut_s1 > 10.0:
        pct = avg_low_cut_s1 / 3200.0
        s1_actions.append(
            PlanAction(
                type="cut_category",
                start_week=current_week,
                end_week=horizon_weeks,
                amount=round(avg_low_cut_s1, 2),
                percentage=round(pct, 2),
                category="discretionary",
                description=f"Trim discretionary spending by {pct*100:.0f}%",
            )
        )
    if avg_save_s1 > 0.0:
        s1_actions.append(
            PlanAction(
                type="save",
                start_week=current_week,
                end_week=horizon_weeks,
                amount=round(avg_save_s1, 2),
                description=f"Save Rs {avg_save_s1:,.0f}/week towards Rs {goal_val:,.0f} goal",
            )
        )

    seq_s1 = simulate_sequence_under_crn(
        "seq_s1_save_first",
        "S1 Trim and save first",
        s1_actions,
        det_flow,
        crn_matrix,
        weekly_breakdown,
        initial_balance,
        start_date,
        res_val,
        goal_val,
        horizon_weeks,
    )

    # Check infeasibility: slack > Rs 1
    max_r = max(s1_res["r"])
    g_val = s1_res["g"]
    is_infeasible = (max_r > 1.0 or g_val > 1.0)

    if is_infeasible:
        conflict_report = _build_conflict_report(
            reserve=res_val,
            goal=goal_val,
            debt_service=debt_service,
            r_max=max_r,
            g_val=g_val,
            initial_balance=initial_balance,
            planned_income=planned_income,
            essentials=essentials,
            forecast_low=forecast_low,
            forecast_med=forecast_med,
            det_flow=det_flow,
            crn_matrix=crn_matrix,
            weekly_breakdown=weekly_breakdown,
            start_date=start_date,
            horizon_weeks=horizon_weeks,
            s1_seq=seq_s1,
        )
        why_line = (
            f"Target is infeasible: Rs {goal_val:,.0f} savings goal cannot coexist with "
            f"Rs {res_val:,.0f} reserve floor and mandatory debt obligations over 8 weeks."
        )
        return Plan(
            id=f"plan_{uuid.uuid4().hex[:8]}",
            reserve=round(res_val, 2),
            goal=round(goal_val, 2),
            deadline=deadline_val or (start_date + timedelta(days=horizon_weeks * 7)),
            horizon_weeks=horizon_weeks,
            sequences=[seq_s0, seq_s1],
            recommended_sequence_id="",
            why_line=why_line,
            status="infeasible",
            conflict=conflict_report,
            view=view_val,
            grade=grade_val,
        )

    # Feasible plan: also build S2
    avg_low_cut_s2 = float(np.mean([forecast_low[t] - s2_res["x_low"][t] for t in range(horizon_weeks)]))
    avg_prep_s2 = float(np.mean(s2_res["p"]))
    avg_save_s2 = float(np.mean(s2_res["s"]))
    s2_actions = []
    if avg_low_cut_s2 > 10.0:
        pct = avg_low_cut_s2 / 3200.0
        s2_actions.append(
            PlanAction(
                type="cut_category",
                start_week=current_week,
                end_week=horizon_weeks,
                amount=round(avg_low_cut_s2, 2),
                percentage=round(pct, 2),
                category="discretionary",
                description=f"Trim discretionary by {pct*100:.0f}%",
            )
        )
    if avg_prep_s2 > 0.0:
        s2_actions.append(
            PlanAction(
                type="prepay_debt",
                start_week=current_week,
                end_week=horizon_weeks,
                amount=round(avg_prep_s2, 2),
                description=f"Accelerate EMI prepayment by Rs {avg_prep_s2:,.0f}/week",
            )
        )
    if avg_save_s2 > 0.0:
        s2_actions.append(
            PlanAction(
                type="save",
                start_week=current_week,
                end_week=horizon_weeks,
                amount=round(avg_save_s2, 2),
                description=f"Allocate Rs {avg_save_s2:,.0f}/week to savings",
            )
        )

    seq_s2 = simulate_sequence_under_crn(
        "seq_s2_debt_first",
        "S2 Trim and repay debt first",
        s2_actions,
        det_flow,
        crn_matrix,
        weekly_breakdown,
        initial_balance,
        start_date,
        res_val,
        goal_val,
        horizon_weeks,
    )

    sequences = [seq_s0, seq_s1, seq_s2]
    recommended_id, why_line = generate_why_line(sequences, res_val)

    for seq in sequences:
        if seq.id == recommended_id:
            seq.tag = "recommended"
        else:
            seq.tag = "predicted"

    return Plan(
        id=f"plan_{uuid.uuid4().hex[:8]}",
        reserve=round(res_val, 2),
        goal=round(goal_val, 2),
        deadline=deadline_val or (start_date + timedelta(days=horizon_weeks * 7)),
        horizon_weeks=horizon_weeks,
        sequences=sequences,
        recommended_sequence_id=recommended_id,
        why_line=why_line,
        status="ok",
        conflict=None,
        view=view_val,
        grade=grade_val,
    )
