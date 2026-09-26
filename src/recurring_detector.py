"""
recurring_detector.py — Stage 2b of the FIN-02 pipeline.

Detects recurring payments (EMIs, subscriptions, rent, and similar
periodic debits) from the categorised transaction table produced by
ingestion.load_transactions() + categoriser.categorise_dataframe().

Detection rule (per spec):
    - amount stable within ±5%
    - interval stable within ±3 days
    - minimum 3 occurrences

Design notes:
    - Operates on `signed_amount`/`is_duplicate` as produced by ingestion —
      duplicate rows (re-uploaded statement lines) are excluded before
      detection so they can't inflate the occurrence count.
    - Only debit transactions are considered recurring candidates (EMIs,
      rent, subscriptions are all outflows). Recurring credits — e.g. a
      fixed monthly stipend — are a plausible future extension but are out
      of scope for the 40% prototype.
    - Clustering is amount-first (group same-merchant transactions whose
      amounts stay within tolerance of a running cluster mean), then each
      resulting cluster is checked for interval consistency. This handles
      merchants that legitimately bill more than one distinct recurring
      amount (rare, but cheap to support correctly).
"""

from __future__ import annotations

import statistics

import pandas as pd

AMOUNT_TOLERANCE = 0.05        # ±5%
INTERVAL_TOLERANCE_DAYS = 3    # ±3 days
MIN_OCCURRENCES = 3

REQUIRED_COLUMNS = ["date", "merchant", "amount", "type", "is_duplicate"]


class RecurringDetectionError(Exception):
    """Raised when the input DataFrame doesn't carry the expected contract."""


def _cluster_by_amount(amounts: list[float], tolerance: float = AMOUNT_TOLERANCE) -> list[list[int]]:
    """
    Greedily groups the *positional indices* of `amounts` (assumed already
    sorted by date) into clusters whose members stay within `tolerance` of
    the cluster's running mean amount. Returns a list of index-lists.
    """
    clusters: list[dict] = []  # each: {"mean": float, "indices": [int, ...]}

    for i, amt in enumerate(amounts):
        best_cluster = None
        best_diff = None
        for cluster in clusters:
            diff = abs(amt - cluster["mean"]) / cluster["mean"]
            if diff <= tolerance and (best_diff is None or diff < best_diff):
                best_cluster = cluster
                best_diff = diff

        if best_cluster is not None:
            best_cluster["indices"].append(i)
            n = len(best_cluster["indices"])
            best_cluster["mean"] += (amt - best_cluster["mean"]) / n  # running mean
        else:
            clusters.append({"mean": amt, "indices": [i]})

    return [c["indices"] for c in clusters]


def _is_interval_consistent(dates: list[pd.Timestamp], tolerance_days: int = INTERVAL_TOLERANCE_DAYS) -> bool:
    """
    True if every consecutive gap between sorted `dates` sits within
    `tolerance_days` of the median gap. Requires at least 2 gaps
    (i.e. at least 3 dates) to be meaningful.
    """
    if len(dates) < 2:
        return False
    gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
    median_gap = statistics.median(gaps)
    return all(abs(g - median_gap) <= tolerance_days for g in gaps)


def detect_recurring_payments(
    df: pd.DataFrame,
    amount_tolerance: float = AMOUNT_TOLERANCE,
    interval_tolerance_days: int = INTERVAL_TOLERANCE_DAYS,
    min_occurrences: int = MIN_OCCURRENCES,
) -> pd.DataFrame:
    """
    Identify recurring payments in a categorised transaction table.

    Args:
        df: output of categorise_dataframe() — must contain at least
            date, merchant, amount, type, is_duplicate. `category` is
            used if present, to label each recurring group.
        amount_tolerance: fractional tolerance for amount matching (0.05 = ±5%).
        interval_tolerance_days: allowed deviation from the median interval.
        min_occurrences: minimum transactions required to call a group recurring.

    Returns:
        DataFrame, one row per detected recurring payment, with columns:
            merchant, category, occurrences, avg_amount, min_amount,
            max_amount, median_interval_days, first_date, last_date
        Sorted by avg_amount descending. Empty (but correctly-shaped) if
        nothing qualifies.
    """
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise RecurringDetectionError(
            f"Missing required column(s): {missing}. Found columns: {list(df.columns)}"
        )

    has_category = "category" in df.columns

    working = df[(df["is_duplicate"] == False) & (df["type"] == "debit")].copy()  # noqa: E712
    working = working.sort_values("date")

    results = []

    for merchant, group in working.groupby("merchant"):
        if len(group) < min_occurrences:
            continue

        group = group.reset_index(drop=True)
        amounts = group["amount"].tolist()
        dates = group["date"].tolist()

        for indices in _cluster_by_amount(amounts, amount_tolerance):
            if len(indices) < min_occurrences:
                continue

            cluster_dates = sorted(dates[i] for i in indices)
            if not _is_interval_consistent(cluster_dates, interval_tolerance_days):
                continue

            cluster_amounts = [amounts[i] for i in indices]
            gaps = [(cluster_dates[k + 1] - cluster_dates[k]).days for k in range(len(cluster_dates) - 1)]

            category = None
            if has_category:
                cats = group.loc[indices, "category"]
                category = cats.mode().iat[0] if not cats.mode().empty else cats.iat[0]

            results.append({
                "merchant": merchant,
                "category": category,
                "occurrences": len(indices),
                "avg_amount": round(sum(cluster_amounts) / len(cluster_amounts), 2),
                "min_amount": round(min(cluster_amounts), 2),
                "max_amount": round(max(cluster_amounts), 2),
                "median_interval_days": round(statistics.median(gaps), 1),
                "first_date": cluster_dates[0],
                "last_date": cluster_dates[-1],
            })

    columns = [
        "merchant", "category", "occurrences", "avg_amount", "min_amount",
        "max_amount", "median_interval_days", "first_date", "last_date",
    ]
    if not results:
        return pd.DataFrame(columns=columns)

    return pd.DataFrame(results, columns=columns).sort_values("avg_amount", ascending=False).reset_index(drop=True)


if __name__ == "__main__":
    from ingestion import load_transactions
    from categoriser import categorise_dataframe

    clean = load_transactions("../data/persona_a_transactions.csv")
    categorised = categorise_dataframe(clean)
    recurring = detect_recurring_payments(categorised)

    print(f"Detected {len(recurring)} recurring payment(s):\n")
    print(recurring.to_string(index=False))
