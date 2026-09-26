"""
categoriser.py — Stage 2a of the FIN-02 pipeline.

Classifies each transaction into a spending category using rule-based
keyword matching against the merchant string. Anything the rules can't
confidently classify is routed through an LLM-fallback hook and, if still
uncertain, flagged `needs_review` rather than silently mis-categorised.

This mirrors FIN-01's confidence + needs_review pattern: every category
assignment carries a confidence score, and low-confidence rows are surfaced
explicitly, not hidden — which is what the FIN-02 problem statement's
"confidence shown where information is incomplete" requirement asks for.
"""

from __future__ import annotations

from typing import Callable, Optional

import pandas as pd

# Ordered rule table: (category, [keywords]). Checked top-down; first match wins.
# Keywords are matched as case-insensitive substrings against the (already
# upper-cased) merchant string from the ingestion stage.
CATEGORY_RULES: list[tuple[str, list[str]]] = [
    ("Income", ["SALARY", "PAYROLL", "STIPEND"]),
    ("Housing", ["RENT", "LANDLORD", "HOUSING SOCIETY"]),
    ("Debt Payment", ["EMI", "LOAN", "HOME LOAN", "CREDIT CARD BILL PAYMENT"]),
    ("Subscriptions", ["NETFLIX", "SPOTIFY", "PRIME VIDEO", "HOTSTAR", "CULT.FIT", "GYM"]),
    ("Utilities", ["ELECTRICITY", "MSEB", "BROADBAND", "AIRTEL", "JIO", "PIPED GAS", "WATER BILL"]),
    ("Food & Dining", ["SWIGGY", "ZOMATO", "STARBUCKS", "RESTAURANT", "CAFE", "DOMINOS", "MCDONALD"]),
    ("Groceries", ["BIGBASKET", "GROFERS", "BLINKIT", "DMART", "GROCERY"]),
    ("Shopping", ["AMAZON", "MYNTRA", "H&M", "FLIPKART", "AJIO"]),
    ("Entertainment", ["PVR", "CINEMA", "BOOKMYSHOW", "INOX"]),
    ("Transport", ["UBER", "OLA", "RAPIDO", "PETROL", "FUEL", "METRO"]),
    ("Travel", ["MAKEMYTRIP", "IRCTC", "AIRLINE", "GOIBIBO", "YATRA"]),
    ("Health", ["PHARMACY", "APOLLO", "HOSPITAL", "CLINIC", "DIAGNOSTIC"]),
]

HIGH_CONFIDENCE = 0.95
REVIEW_THRESHOLD = 0.60  # below this, row is flagged needs_review


def _rule_based_category(merchant: str) -> tuple[Optional[str], float]:
    """Returns (category, confidence) from keyword rules, or (None, 0.0) if no match."""
    for category, keywords in CATEGORY_RULES:
        if any(kw in merchant for kw in keywords):
            return category, HIGH_CONFIDENCE
    return None, 0.0


def categorise_transaction(
    merchant: str,
    llm_fallback: Optional[Callable[[str], tuple[str, float]]] = None,
) -> tuple[str, float, bool]:
    """
    Categorise a single merchant string.

    Args:
        merchant: normalised (upper-cased) merchant string from ingestion.
        llm_fallback: optional callable(merchant) -> (category, confidence),
            used only when the rule table has no match. Kept pluggable so
            the 24-hour build can wire in a real LLM call without touching
            this function's contract.

    Returns:
        (category, confidence, needs_review)
    """
    category, confidence = _rule_based_category(merchant)

    if category is None and llm_fallback is not None:
        try:
            category, confidence = llm_fallback(merchant)
        except Exception:
            category, confidence = "Uncategorised", 0.0

    if category is None:
        category, confidence = "Uncategorised", 0.0

    needs_review = confidence < REVIEW_THRESHOLD
    return category, confidence, needs_review


def categorise_dataframe(
    df: pd.DataFrame,
    llm_fallback: Optional[Callable[[str], tuple[str, float]]] = None,
) -> pd.DataFrame:
    """
    Applies categorise_transaction to every row of an ingested DataFrame.

    Expects a `merchant` column (as produced by ingestion.load_transactions).
    Returns a copy of df with three new columns: category, category_confidence,
    needs_review.
    """
    df = df.copy()
    results = df["merchant"].apply(lambda m: categorise_transaction(m, llm_fallback))
    df["category"] = results.apply(lambda r: r[0])
    df["category_confidence"] = results.apply(lambda r: r[1])
    df["needs_review"] = results.apply(lambda r: r[2])
    return df


def category_summary(df: pd.DataFrame) -> pd.DataFrame:
    """Quick sanity-check helper: total spend per category, sorted descending."""
    spend = df[df["type"] == "debit"].groupby("category")["amount"].sum().sort_values(ascending=False)
    return spend.reset_index().rename(columns={"amount": "total_spend"})


if __name__ == "__main__":
    from ingestion import load_transactions

    clean = load_transactions("../data/persona_a_transactions.csv")
    categorised = categorise_dataframe(clean)

    print(categorised[["merchant", "category", "category_confidence", "needs_review"]].head(12))
    print(f"\n{categorised['needs_review'].sum()} row(s) flagged needs_review out of {len(categorised)}.")
    print("\nSpend by category:")
    print(category_summary(categorised).to_string(index=False))
