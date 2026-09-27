"""
health_ratios.py — Stage 3a of the FIN-02 pipeline.

Computes debt-to-income ratio and savings rate from the categorised
transaction table (ingestion.load_transactions() + categoriser.categorise_dataframe()).

Definitions:
    debt_to_income = total "Debt Payment" outflows / total income, per month
    savings_rate   = (income − total expenses) / income, per month

Both ratios are computed per calendar month (not just once over the whole
history) because the report's Persona A scenario is specifically about a
*trend* — EMI share of income rising, savings rate declining over time —
so a single aggregate number would hide the thing the dashboard needs to
show. An overall/aggregate summary is also provided for a single headline
figure.

Rows where income is zero for a month are flagged `needs_review` rather
than producing a divide-by-zero or a silently wrong ratio — consistent
with the confidence/needs_review pattern used throughout the pipeline.
"""

from __future__ import annotations

import pandas as pd

REQUIRED_COLUMNS = ["date", "amount", "type", "category", "is_duplicate"]
DEBT_CATEGORY = "Debt Payment"


class HealthRatioError(Exception):
    """Raised when the input DataFrame doesn't carry the expected contract."""


def _validate(df: pd.DataFrame) -> None:
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise HealthRatioError(
            f"Missing required column(s): {missing}. Found columns: {list(df.columns)}"
        )


def compute_monthly_health_ratios(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute debt-to-income ratio and savings rate for each calendar month
    present in the data.

    Returns a DataFrame indexed by month (Period[M]) with columns:
        income, total_expenses, debt_payments, savings,
        debt_to_income_ratio, savings_rate, needs_review
    """
    _validate(df)

    clean = df[df["is_duplicate"] == False].copy()  # noqa: E712
    clean["month"] = clean["date"].dt.to_period("M")

    rows = []
    for month, group in clean.groupby("month"):
        income = group.loc[group["category"] == "Income", "amount"].sum()
        total_expenses = group.loc[group["type"] == "debit", "amount"].sum()
        debt_payments = group.loc[group["category"] == DEBT_CATEGORY, "amount"].sum()
        savings = income - total_expenses

        needs_review = income == 0
        debt_to_income_ratio = (debt_payments / income) if income else None
        savings_rate = (savings / income) if income else None

        rows.append({
            "month": month,
            "income": round(income, 2),
            "total_expenses": round(total_expenses, 2),
            "debt_payments": round(debt_payments, 2),
            "savings": round(savings, 2),
            "debt_to_income_ratio": round(debt_to_income_ratio, 4) if debt_to_income_ratio is not None else None,
            "savings_rate": round(savings_rate, 4) if savings_rate is not None else None,
            "needs_review": needs_review,
        })

    result = pd.DataFrame(rows).sort_values("month").reset_index(drop=True)
    return result


def compute_overall_health_ratios(df: pd.DataFrame) -> dict:
    """
    Single aggregate debt-to-income ratio and savings rate across the
    entire history in `df` — useful for one headline number on the
    dashboard, distinct from the monthly trend.

    Returns a dict: {income, total_expenses, debt_payments, savings,
    debt_to_income_ratio, savings_rate, needs_review}.
    """
    _validate(df)

    clean = df[df["is_duplicate"] == False]

    income = clean.loc[clean["category"] == "Income", "amount"].sum()
    total_expenses = clean.loc[clean["type"] == "debit", "amount"].sum()
    debt_payments = clean.loc[clean["category"] == DEBT_CATEGORY, "amount"].sum()
    savings = income - total_expenses

    needs_review = income == 0
    debt_to_income_ratio = (debt_payments / income) if income else None
    savings_rate = (savings / income) if income else None

    return {
        "income": round(income, 2),
        "total_expenses": round(total_expenses, 2),
        "debt_payments": round(debt_payments, 2),
        "savings": round(savings, 2),
        "debt_to_income_ratio": round(debt_to_income_ratio, 4) if debt_to_income_ratio is not None else None,
        "savings_rate": round(savings_rate, 4) if savings_rate is not None else None,
        "needs_review": needs_review,
    }

def monthly_summary(df):
    """Alias expected by api/main.py."""
    return compute_monthly_health_ratios(df)


def trend_flags(summary):
    """Rule-based trend flags over an already-computed monthly summary."""
    valid = summary.dropna(subset=["savings_rate", "debt_to_income_ratio"])
    if len(valid) < 2:
        return {"savings_rate_declining": False, "debt_to_income_rising": False, "needs_review": True}
    first, last = valid.iloc[0], valid.iloc[-1]
    return {
        "savings_rate_declining": bool(last["savings_rate"] < first["savings_rate"]),
        "debt_to_income_rising": bool(last["debt_to_income_ratio"] > first["debt_to_income_ratio"]),
        "needs_review": bool(valid["needs_review"].any()),
    }


if __name__ == "__main__":
    from ingestion import load_transactions
    from categoriser import categorise_dataframe

    clean = load_transactions("../data/persona_a_transactions.csv")
    categorised = categorise_dataframe(clean)

    print("Monthly health ratios:\n")
    print(compute_monthly_health_ratios(categorised).to_string(index=False))

    print("\nOverall health ratios:\n")
    for k, v in compute_overall_health_ratios(categorised).items():
        print(f"  {k}: {v}")
