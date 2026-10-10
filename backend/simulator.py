"""backend/simulator.py — Decoupled F5 MVP Simulator.

Compares two sequences:
- S0: Hold Steady (Baseline unmodified cashflow)
- S1: Trim Spend (-25% discretionary spend across all 8 weeks)

Completely decoupled: Zero scipy.optimize.linprog, zero LLM / agent imports.
Uses Common Random Numbers (CRN) Monte Carlo simulation to evaluate P10/P50/P90
and reserve breach probability across 8 weekly periods.
"""

from __future__ import annotations
from datetime import date, timedelta
from typing import Any
import numpy as np
import pandas as pd


def simulate_two_sequences(
    df: pd.DataFrame,
    reserve_floor: float = 45000.0,
    num_paths: int = 500,
    seed: int = 42,
) -> dict[str, Any]:
    """Simulates S0 (Hold Steady) and S1 (Trim Spend) over 8 weekly periods."""
    clean_df = df.copy()
    clean_df["date"] = pd.to_datetime(clean_df["date"])
    clean_df = clean_df.sort_values("date")

    # 1. Starting Balance
    if "balance" in clean_df.columns and clean_df["balance"].dropna().any():
        init_balance = float(clean_df["balance"].dropna().iloc[-1])
    else:
        init_balance = 60000.0

    # 2. Extract weekly flows from transactions
    debits = clean_df[clean_df["type"].astype(str).str.lower() == "debit"]
    credits = clean_df[clean_df["type"].astype(str).str.lower() == "credit"]

    total_days = max(14, (clean_df["date"].max() - clean_df["date"].min()).days)
    weekly_income = float((credits["amount"].sum() / total_days) * 7) if not credits.empty else 20000.0

    # Separate essential fixed obligations vs discretionary
    essential_keywords = ["rent", "housing", "emi", "loan", "utilities", "electricity", "water", "gas"]
    merchant_col = "merchant" if "merchant" in debits.columns else "narration"
    
    is_essential = debits[merchant_col].astype(str).str.lower().apply(
        lambda m: any(kw in m for kw in essential_keywords)
    )
    if "category" in debits.columns:
        is_essential = is_essential | debits["category"].astype(str).str.lower().isin(
            ["debt payment", "housing", "utilities", "health"]
        )

    weekly_essentials = float((debits[is_essential]["amount"].sum() / total_days) * 7) if is_essential.any() else 9000.0
    weekly_discretionary = float((debits[~is_essential]["amount"].sum() / total_days) * 7) if (~is_essential).any() else 7000.0

    # Monte Carlo variance
    residual_std = max(1500.0, weekly_discretionary * 0.25)

    # 3. Common Random Numbers (CRN) matrix: (num_paths, 8)
    rng = np.random.default_rng(seed)
    crn_noise = rng.normal(loc=0.0, scale=residual_std, size=(num_paths, 8))

    # 4. Evaluate S0 and S1
    sequence_defs = [
        {"id": "S0", "name": "Hold Steady (Baseline)", "cut_pct": 0.0, "note": "Unmodified cashflow (no cuts)"},
        {"id": "S1", "name": "Trim Spend (-25%)", "cut_pct": 0.25, "note": "Cuts discretionary spend to protect reserve"},
    ]

    sequences_out = []
    start_dt = date.today()

    for seq in sequence_defs:
        disc_spend = weekly_discretionary * (1.0 - seq["cut_pct"])
        path_balances = np.zeros((num_paths, 9))
        path_balances[:, 0] = init_balance

        periods = []
        for w in range(1, 9):
            net_flow = weekly_income - weekly_essentials - disc_spend
            # Exact same CRN noise applied to both sequences
            path_balances[:, w] = path_balances[:, w - 1] + net_flow + crn_noise[:, w - 1]

            end_w = path_balances[:, w]
            p10 = float(np.percentile(end_w, 10))
            p50 = float(np.percentile(end_w, 50))
            p90 = float(np.percentile(end_w, 90))
            breach_prob = float(np.mean(end_w < reserve_floor))

            periods.append({
                "week": w,
                "period_label": f"Week {w}",
                "start_date": str(start_dt + timedelta(days=(w - 1) * 7)),
                "opening_balance": round(float(np.median(path_balances[:, w - 1])), 2),
                "income_p50": round(weekly_income, 2),
                "essentials": round(weekly_essentials, 2),
                "discretionary": round(disc_spend, 2),
                "closing_p10": round(p10, 2),
                "closing_p50": round(p50, 2),
                "closing_p90": round(p90, 2),
                "reserve_breach_prob": round(breach_prob, 4),
                "tradeoff_note": seq["note"] if w == 1 else ("Protects reserve floor" if breach_prob < 0.10 else "High reserve breach risk"),
            })

        any_week_breach = float(np.mean(np.any(path_balances[:, 1:] < reserve_floor, axis=1)))

        sequences_out.append({
            "id": seq["id"],
            "name": seq["name"],
            "periods": periods,
            "summary": {
                "min_p10_closing": round(float(np.min([p["closing_p10"] for p in periods])), 2),
                "any_week_breach_prob": round(any_week_breach, 4),
                "total_cut": round(weekly_discretionary * seq["cut_pct"] * 8, 2),
            },
        })

    # Pick safer sequence as recommended
    rec_id = "S1" if sequences_out[1]["summary"]["any_week_breach_prob"] < sequences_out[0]["summary"]["any_week_breach_prob"] else "S0"

    return {
        "status": "ok",
        "reserve_floor": reserve_floor,
        "recommended_sequence_id": rec_id,
        "sequences": sequences_out,
    }
