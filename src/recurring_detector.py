"""
recurring_detector.py — Stage 2b of the FIN-02 pipeline.

Detects recurring payments (EMIs, subscriptions, rent) purely from the
transaction pattern — never from a hardcoded merchant list. Detection uses
CHAIN comparison: each transaction is compared to the one immediately before
it (same merchant, sorted by date), not to a single fixed group average.

Why chain comparison, not a fixed-mean check:
    A fixed mean/tolerance check (e.g. "every occurrence must be within +/-5%
    of the merchant's average amount") breaks on any legitimately drifting
    payment — an EMI after a rate hike, rent after an annual increase —
    because the cumulative drift across several months can exceed the
    tolerance even though each individual step was small and gradual.
    Comparing each transaction only to its immediate predecessor correctly
    recognises "the same ongoing payment, gradually changing" while still
    separating genuinely unrelated transactions that happen to share a
    merchant name.

A merchant's transactions are grouped into a recurring cluster while, for
every consecutive pair:
    - amount step tolerance:   change is within +/-15% of the previous amount
    - interval tolerance:      gap is within +/-3 days of a ~monthly cadence
A cluster qualifies as recurring once it has 3+ occurrences.
"""

from __future__ import annotations

import pandas as pd

THRESHOLDS = {
    "amount_step_tolerance_pct": 0.15,  # +/-15% change from the *previous* occurrence
    "interval_days": 30,                 # target cadence (monthly)
    "interval_tolerance_days": 3,        # +/-3 days
    "min_occurrences": 3,
}

# Lightweight heuristic for labelling *why* something recurs, layered on top
# of the pure pattern-detection logic above (detection does not depend on this).
RECURRING_TYPE_HINTS = [
    ("EMI", ["EMI", "LOAN"]),
    ("Rent", ["RENT", "LANDLORD"]),
    ("Subscription", ["NETFLIX", "SPOTIFY", "PRIME", "HOTSTAR", "GYM", "CULT.FIT"]),
    ("Utility", ["ELECTRICITY", "BROADBAND", "AIRTEL", "JIO", "GAS", "WATER"]),
]


def _label_recurring_type(merchant: str) -> str:
    for label, keywords in RECURRING_TYPE_HINTS:
        if any(kw in merchant for kw in keywords):
            return label
    return "Other recurring"


def _chain_cluster(group: pd.DataFrame) -> list[pd.DataFrame]:
    """
    Splits one merchant's transactions (already sorted by date) into clusters.
    A new cluster starts whenever the step from the previous transaction
    breaks either the amount-step or interval tolerance — so a genuine
    one-off unrelated charge still gets separated out, while a gradually
    drifting recurring payment (e.g. a rate hike) stays in one cluster.
    """
    rows = group.to_dict("records")
    clusters: list[list[dict]] = [[rows[0]]]

    for prev, curr in zip(rows, rows[1:]):
        amount_step = abs(curr["amount"] - prev["amount"]) / prev["amount"] if prev["amount"] else 1.0
        interval_days = (curr["date"] - prev["date"]).days
        within_amount = amount_step <= THRESHOLDS["amount_step_tolerance_pct"]
        within_interval = abs(interval_days - THRESHOLDS["interval_days"]) <= THRESHOLDS["interval_tolerance_days"]

        if within_amount and within_interval:
            clusters[-1].append(curr)
        else:
            clusters.append([curr])

    return [pd.DataFrame(c) for c in clusters]


def detect_recurring_payments(df: pd.DataFrame) -> pd.DataFrame:
    """
    Args:
        df: ingested (and ideally categorised) DataFrame with columns
            date, merchant, amount, type.

    Returns:
        DataFrame — one row per detected recurring cluster, with columns:
        merchant, recurring_type, occurrences, avg_amount, amount_std,
        avg_interval_days, first_seen, last_seen, first_amount, last_amount,
        total_drift_pct.
        A single merchant can appear more than once if it has two genuinely
        separate recurring runs (e.g. an old plan replaced by a new one).
    """
    debits = df[df["type"] == "debit"]
    results = []

    for merchant, group in debits.groupby("merchant"):
        sorted_group = group.sort_values("date").reset_index(drop=True)
        for cluster in _chain_cluster(sorted_group):
            if len(cluster) < THRESHOLDS["min_occurrences"]:
                continue

            dates = cluster["date"]
            avg_interval = dates.diff().dropna().dt.days.mean()
            first_amount = cluster["amount"].iloc[0]
            last_amount = cluster["amount"].iloc[-1]
            total_drift_pct = (
                round((last_amount - first_amount) / first_amount * 100, 1) if first_amount else 0.0
            )

            results.append({
                "merchant": merchant,
                "recurring_type": _label_recurring_type(merchant),
                "occurrences": len(cluster),
                "avg_amount": round(cluster["amount"].mean(), 2),
                "amount_std": round(cluster["amount"].std() or 0.0, 2),
                "avg_interval_days": round(avg_interval, 1),
                "first_seen": dates.min().date().isoformat(),
                "last_seen": dates.max().date().isoformat(),
                "first_amount": round(first_amount, 2),
                "last_amount": round(last_amount, 2),
                "total_drift_pct": total_drift_pct,
            })

    result_df = pd.DataFrame(results)
    if not result_df.empty:
        result_df = result_df.sort_values("avg_amount", ascending=False).reset_index(drop=True)
    return result_df


def monthly_recurring_burden(recurring_df: pd.DataFrame) -> float:
    """Total monthly outflow attributable to recurring payments (uses the
    most recent amount per cluster, since that reflects the current burden
    better than an average across a drifting series)."""
    if recurring_df.empty:
        return 0.0
    return round(recurring_df["last_amount"].sum(), 2)


if __name__ == "__main__":
    from ingestion import load_transactions
    from categoriser import categorise_dataframe

    clean = load_transactions("../data/persona_a_transactions.csv")
    categorised = categorise_dataframe(clean)
    recurring = detect_recurring_payments(categorised)

    print(recurring.to_string(index=False))
    print(f"\nTotal current monthly recurring burden: Rs. {monthly_recurring_burden(recurring):,.2f}")
