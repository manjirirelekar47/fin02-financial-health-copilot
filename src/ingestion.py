"""
ingestion.py — Stage 1 of the FIN-02 pipeline.

Accepts a raw transaction CSV (as a user's bank/credit-card export would look)
and produces a clean, normalised, validated DataFrame that every downstream
stage (categoriser, recurring-payment detector, health-ratio modeling,
forecasting) can trust without re-validating.

Design principle (borrowed from the FIN-01 pipeline pattern): normalise-then-
reason. Nothing downstream should have to guess about types, missing fields,
or malformed rows — that guessing happens exactly once, here.
"""

from __future__ import annotations

import pandas as pd

REQUIRED_COLUMNS = ["date", "merchant", "amount", "type", "account_type"]
VALID_TYPES = {"credit", "debit"}
VALID_ACCOUNT_TYPES = {"bank", "credit_card"}


class TransactionValidationError(Exception):
    """Raised when the input file cannot be safely normalised."""


def load_transactions(path: str) -> pd.DataFrame:
    """
    Load a raw transaction CSV and return a clean, validated DataFrame.

    Returns a DataFrame with columns:
        date (datetime64), merchant (str, stripped), amount (float, >0),
        type ('credit'|'debit'), account_type ('bank'|'credit_card'),
        signed_amount (float — negative for debit, positive for credit)

    Raises:
        TransactionValidationError if required columns are missing or the
        file contains rows that cannot be safely coerced.
    """
    try:
        df = pd.read_csv(path)
    except FileNotFoundError as exc:
        raise TransactionValidationError(f"File not found: {path}") from exc
    except pd.errors.EmptyDataError as exc:
        raise TransactionValidationError(f"File is empty: {path}") from exc

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise TransactionValidationError(
            f"Missing required column(s): {missing}. Found columns: {list(df.columns)}"
        )

    df = df.copy()

    # --- Normalise merchant strings ---
    df["merchant"] = df["merchant"].astype(str).str.strip().str.upper()

    # --- Parse and validate dates ---
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    bad_dates = df["date"].isna().sum()
    if bad_dates:
        raise TransactionValidationError(
            f"{bad_dates} row(s) have an unparseable date. Expected YYYY-MM-DD."
        )

    # --- Validate and coerce amount ---
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    bad_amounts = df["amount"].isna().sum()
    if bad_amounts:
        raise TransactionValidationError(f"{bad_amounts} row(s) have a non-numeric amount.")
    if (df["amount"] <= 0).any():
        raise TransactionValidationError("amount must be strictly positive; direction is carried by `type`.")

    # --- Validate categorical fields ---
    df["type"] = df["type"].astype(str).str.strip().str.lower()
    invalid_types = set(df["type"].unique()) - VALID_TYPES
    if invalid_types:
        raise TransactionValidationError(f"Invalid transaction type(s): {invalid_types}. Expected {VALID_TYPES}.")

    df["account_type"] = df["account_type"].astype(str).str.strip().str.lower()
    invalid_accounts = set(df["account_type"].unique()) - VALID_ACCOUNT_TYPES
    if invalid_accounts:
        raise TransactionValidationError(
            f"Invalid account_type(s): {invalid_accounts}. Expected {VALID_ACCOUNT_TYPES}."
        )

    # --- Derived field: signed amount, useful for every downstream sum ---
    df["signed_amount"] = df.apply(
        lambda r: r["amount"] if r["type"] == "credit" else -r["amount"], axis=1
    )

    # --- Flag exact duplicate rows (same date/merchant/amount/type) — common
    #     in real exports when a statement is re-uploaded ---
    dup_mask = df.duplicated(subset=["date", "merchant", "amount", "type"], keep="first")
    df["is_duplicate"] = dup_mask
    if dup_mask.any():
        print(f"[ingestion] Warning: {dup_mask.sum()} duplicate row(s) flagged (kept, not dropped).")

    df = df.sort_values("date").reset_index(drop=True)
    return df


if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else "../data/persona_a_transactions.csv"
    clean = load_transactions(path)
    print(clean.head())
    print(f"\nLoaded {len(clean)} transactions, {clean['is_duplicate'].sum()} flagged duplicates.")
