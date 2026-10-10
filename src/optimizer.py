import numpy as np
import pandas as pd
from api.schemas import SimulatorPreset, SimulatorRequest, DataState
from src.simulator import simulate_scenario, get_model_components

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
    df["signed_amount"] = np.where(df["type"] == "credit", df["amount"], -df["amount"])
    initial_balance = df["signed_amount"].sum()
    days_in_history = max((df["date"].max() - df["date"].min()).days, 1)
    avg_monthly_expenses = df[df["type"] == "debit"]["amount"].sum() / (days_in_history / 30.0)
    
    categories = list(flexibility_weights.keys()) if flexibility_weights else [
        "Food & Dining", "Shopping", "Entertainment", "Travel", "Utilities"
    ]
    
    max_shortfall = constraints.get("max_shortfall_prob", 0.10)
    max_dti = constraints.get("max_dti", 0.50)
    
    best_plan = None
    best_score = float('inf')
    
    closest_plan = None
    closest_violation = float('inf')
    
    cut_options = [0.0, 0.05, 0.10, 0.15, 0.20, 0.30]
    delay_options = [0, 2, 4, 8]
    
    # Check requested tenure and safe tenure options if needed to respect DTI
    tenure_options = [target_months]
    for extra in [2, 4, 6, 8, 12]:
        cand = target_months + extra
        if cand <= 36 and cand not in tenure_options:
            tenure_options.append(cand)
            
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
                req = SimulatorRequest(custom_amount=target_purchase, custom_months=tenure)
                out = simulate_scenario(
                    SimulatorPreset.buy_or_new_emi,
                    obligations,
                    sim_res,
                    start_date,
                    initial_balance + savings_acc,
                    avg_monthly_expenses,
                    req
                )
                
                # Disruption score (0 to 100 scale): penalizes heavy cuts, long delays, and extended tenures
                disruption = (total_weighted_cut * 35.0) + (delay * 2.5) + ((tenure - target_months) * 1.5)
                
                # Check constraints
                shortfall_ok = out.shortfall_prob_90d <= max_shortfall
                dti_ok = out.new_dti <= max_dti
                
                if shortfall_ok and dti_ok:
                    if disruption < best_score:
                        best_score = disruption
                        best_plan = {
                            "cuts": cats_cut,
                            "purchase_delay_weeks": delay,
                            "tenure_months": tenure,
                            "extra_monthly_saving": round(savings_acc / max(1, tenure), 2),
                            "amount_drawn_from_savings": 0.0,
                            "sim_result": out,
                            "disruption_score": round(disruption, 1)
                        }
                else:
                    # Keep track of closest plan
                    violation = max(0, out.shortfall_prob_90d - max_shortfall) * 100 + max(0, out.new_dti - max_dti) * 50
                    if violation < closest_violation:
                        closest_violation = violation
                        closest_plan = {
                            "cuts": cats_cut,
                            "purchase_delay_weeks": delay,
                            "tenure_months": tenure,
                            "extra_monthly_saving": round(savings_acc / max(1, tenure), 2),
                            "amount_drawn_from_savings": 0.0,
                            "sim_result": out,
                            "disruption_score": round(disruption, 1)
                        }
                        
    if best_plan is not None:
        return best_plan, best_plan["disruption_score"]
        
    return None, closest_plan
