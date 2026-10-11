import numpy as np
import pandas as pd
from api.schemas import SimulatorPreset, SimulatorRequest, DataState
from src.simulator import simulate_scenario, get_model_components, compute_emi

def optimize_plan(
    df: pd.DataFrame,
    target_purchase: float,
    flexibility_weights: dict,
    constraints: dict,
    target_months: int = 4
):
    """
    Minimum-Change Optimizer using bounded search across realistic financial levers:
    - Discretionary cuts weighted by category flexibility
    - Purchase delay (weeks)
    - Tenure adjustments or downpayment to satisfy DTI and shortfall probability
    """
    state, obligations, residuals = get_model_components(df)
    if state != DataState.ok:
        return None, None
        
    start_date = df["date"].max() + pd.Timedelta(days=1)
    work = df.copy()
    work["signed_amount"] = np.where(work["type"] == "credit", work["amount"], -work["amount"])
    initial_balance = float(work["signed_amount"].sum())
    days_in_history = max((df["date"].max() - df["date"].min()).days, 1)
    avg_monthly_expenses = df[df["type"] == "debit"]["amount"].sum() / (days_in_history / 30.0)
    
    categories = list(flexibility_weights.keys()) if flexibility_weights else [
        "Food & Dining", "Shopping", "Entertainment", "Travel", "Utilities"
    ]
    
    max_shortfall = constraints.get("max_shortfall_prob", 0.10)
    max_dti = constraints.get("max_dti", 0.50)
    minimum_buffer = max(0.0, float(constraints.get("min_p10_buffer_amount", 0.0)))

    monthly_income = sum(
        float(item["amount"]) * (30.0 / max(float(item["interval_days"]), 1.0))
        for item in obligations
        if item["type"] == "Income" and item["flow"] > 0
    )
    monthly_existing_debt = sum(
        float(item["amount"]) * (30.0 / max(float(item["interval_days"]), 1.0))
        for item in obligations
        if item["type"] == "EMI" and item["flow"] < 0
    )
    
    best_plan = None
    best_score = float('inf')
    
    closest_plan = None
    closest_violation = float('inf')
    
    cut_options = [0.0, 0.05, 0.10, 0.15, 0.20, 0.30]
    delay_options = [0, 2, 4, 8]
    
    # Check requested tenure and safe tenure options if needed to respect DTI
    # Include longer repayment terms. The old search stopped at target + 12
    # months, which left common goals infeasible even when a 24–36 month EMI
    # would satisfy the user's DTI limit.
    tenure_options = sorted({
        max(1, min(36, target_months)),
        *[month for month in (6, 9, 12, 18, 24, 30, 36) if month >= target_months],
    })
            
    candidates = []
    max_new_emi = max(0.0, monthly_income * max_dti - monthly_existing_debt)
    if monthly_income and monthly_existing_debt / monthly_income > max_dti:
        max_new_emi = 0.0
    for delay in delay_options:
        for cut in cut_options:
            # Weighted cut dictionary per category (higher flexibility = slightly higher cut)
            cats_cut = {}
            total_weighted_cut = 0.0
            for cat in categories:
                w = flexibility_weights.get(cat, 0.5)
                cat_cut = min(0.60, round(cut * (w / 0.5), 2))
                cats_cut[cat] = cat_cut
                total_weighted_cut += w * cat_cut
                
            sim_res = residuals * (1.0 - cut)
            # Delayed purchase allows accumulated savings from discretionary spend reductions
            savings_acc = (avg_monthly_expenses * cut * (delay * 7.0 / 30.0)) if delay > 0 else 0.0
            
            for tenure in tenure_options:
                emi_per_rupee = compute_emi(1.0, 0.12, tenure)
                affordable_principal = min(
                    target_purchase,
                    max_new_emi / emi_per_rupee if emi_per_rupee > 0 else 0.0,
                )
                # A small rounding margin keeps the simulated DTI on the safe
                # side of the user's limit after currency rounding.
                amount_drawn = max(0.0, round(target_purchase - affordable_principal + 1.0, 2))
                amount_drawn = min(target_purchase, amount_drawn)
                draw_fraction = amount_drawn / max(float(target_purchase), 1.0)
                disruption = (total_weighted_cut * 35.0) + (delay * 2.5) + ((tenure - target_months) * 1.5) + (draw_fraction * 20.0)
                candidates.append({
                    "cuts": cats_cut,
                    "total_weighted_cut": total_weighted_cut,
                    "sim_res": sim_res,
                    "savings_acc": savings_acc,
                    "tenure": tenure,
                    "delay": delay,
                    "amount_drawn": amount_drawn,
                    "disruption": disruption,
                })

    # Candidates are already scored by change size. The first feasible one is
    # therefore the minimum-change solution; this avoids running hundreds of
    # equivalent 1,000-path simulations after a solution has been found.
    for candidate in sorted(candidates, key=lambda item: item["disruption"]):
        if best_plan is not None and candidate["disruption"] >= best_score:
            break
        tenure = candidate["tenure"]
        delay = candidate["delay"]
        amount_drawn = candidate["amount_drawn"]
        savings_acc = candidate["savings_acc"]
        disruption = candidate["disruption"]
        req = SimulatorRequest(custom_amount=max(0.0, target_purchase - amount_drawn), custom_months=tenure)
        out = simulate_scenario(
            SimulatorPreset.buy_or_new_emi,
            obligations,
            candidate["sim_res"],
            start_date,
            initial_balance + savings_acc - amount_drawn,
            avg_monthly_expenses,
            req,
        )

        shortfall_ok = out.shortfall_prob_90d <= max_shortfall
        dti_ok = out.new_dti <= max_dti
        buffer_ok = out.buffer.p10 >= minimum_buffer
        if shortfall_ok and dti_ok and buffer_ok:
            best_score = disruption
            best_plan = {
                "cuts": candidate["cuts"],
                "purchase_delay_weeks": delay,
                "tenure_months": tenure,
                "extra_monthly_saving": round(savings_acc / max(1, tenure), 2),
                "amount_drawn_from_savings": round(amount_drawn, 2),
                "sim_result": out,
                "disruption_score": round(disruption, 1),
            }
            continue

        violation = (
            max(0, out.shortfall_prob_90d - max_shortfall) * 100
            + max(0, out.new_dti - max_dti) * 50
            + max(0, minimum_buffer - out.buffer.p10) / max(float(target_purchase), 1.0) * 100
        )
        if violation < closest_violation:
            closest_violation = violation
            closest_plan = {
                "cuts": candidate["cuts"],
                "purchase_delay_weeks": delay,
                "tenure_months": tenure,
                "extra_monthly_saving": round(savings_acc / max(1, tenure), 2),
                "amount_drawn_from_savings": round(amount_drawn, 2),
                "sim_result": out,
                "disruption_score": round(disruption, 1),
            }
                        
    if best_plan is not None:
        return best_plan, best_plan["disruption_score"]
        
    return None, closest_plan
