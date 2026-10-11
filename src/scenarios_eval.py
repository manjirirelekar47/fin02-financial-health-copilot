"""src/scenarios_eval.py — Evaluator for 15 labelled ground-truth test scenarios.

Measures:
- Match rate (Accuracy vs ground-truth needs_review label, required >= 80%)
- False-positive rate (Safe transactions wrongly flagged for review, required <= 20%)
"""

from __future__ import annotations

from typing import Any
from src.categoriser import categorise_transaction

# 15 Labelled Ground-Truth Scenarios
LABELLED_SCENARIOS = [
    # Clearly Safe (Standard, easily matched by rule)
    {"merchant": "AMAZON RETAIL", "type": "safe", "expected_needs_review": False, "expected_category": "Shopping"},
    {"merchant": "NETFLIX.COM", "type": "safe", "expected_needs_review": False, "expected_category": "Subscriptions"},
    {"merchant": "HDFC HOME LOAN EMI", "type": "safe", "expected_needs_review": False, "expected_category": "Debt Payment"},
    {"merchant": "UBER TRIP", "type": "safe", "expected_needs_review": False, "expected_category": "Transport"},
    {"merchant": "ZOMATO ONLINE", "type": "safe", "expected_needs_review": False, "expected_category": "Food & Dining"},

    # Clearly Risky / Noisy (Random strings, highly unknown -> should flag review)
    {"merchant": "UPI-UNKNOWN-MCHNT-99812", "type": "risky", "expected_needs_review": True, "expected_category": "Uncategorised"},
    {"merchant": "POS TXN 11112222", "type": "risky", "expected_needs_review": True, "expected_category": "Uncategorised"},
    {"merchant": "TRANSFER TO VISHAL", "type": "risky", "expected_needs_review": True, "expected_category": "Uncategorised"},
    {"merchant": "NEFT INDIVIDUAL", "type": "risky", "expected_needs_review": True, "expected_category": "Uncategorised"},
    {"merchant": "CASH WITHDRAWAL ATM", "type": "risky", "expected_needs_review": True, "expected_category": "Uncategorised"},

    # Borderline (One-off purchase, ambiguous, or seasonal expense)
    {"merchant": "DIWALI MELA STALL UPI", "type": "borderline", "expected_needs_review": True, "expected_category": "Uncategorised"},
    {"merchant": "FINAL LOAN SETTLEMENT", "type": "borderline", "expected_needs_review": False, "expected_category": "Debt Payment"},
    {"merchant": "RARE ANTIQUE SHOP", "type": "borderline", "expected_needs_review": True, "expected_category": "Uncategorised"},
    {"merchant": "LOCAL PHARMACY MEDS", "type": "borderline", "expected_needs_review": False, "expected_category": "Health"},
    {"merchant": "AIRLINE TICKET UPGRADE", "type": "borderline", "expected_needs_review": False, "expected_category": "Travel"},
]


def evaluate_labelled_scenarios() -> dict[str, Any]:
    """Runs evaluation across all 15 labelled scenarios and returns metrics."""
    total = len(LABELLED_SCENARIOS)
    matches = 0
    false_positives = 0
    true_negatives = 0

    results = []
    for sc in LABELLED_SCENARIOS:
        cat, conf, needs_review, why = categorise_transaction(sc["merchant"])
        matched = (needs_review == sc["expected_needs_review"])
        if matched:
            matches += 1

        if sc["type"] == "safe" and needs_review:
            false_positives += 1
        elif sc["type"] == "safe" and not needs_review:
            true_negatives += 1

        results.append({
            "merchant": sc["merchant"],
            "type": sc["type"],
            "expected_review": sc["expected_needs_review"],
            "actual_review": needs_review,
            "category": cat,
            "confidence": round(conf, 2),
            "matched": matched,
        })

    match_rate = round((matches / total) * 100, 1)
    denom = false_positives + true_negatives
    fp_rate = round((false_positives / denom) * 100, 1) if denom > 0 else 0.0

    return {
        "total_scenarios": total,
        "matches": matches,
        "match_rate_pct": match_rate,
        "false_positive_rate_pct": fp_rate,
        "results": results,
    }


if __name__ == "__main__":
    res = evaluate_labelled_scenarios()
    print("=" * 60)
    print("SPENDSHIELD LABELLED SCENARIO EVALUATION")
    print("=" * 60)
    print(f"Total Scenarios: {res['total_scenarios']}")
    print(f"Match Rate: {res['match_rate_pct']}% (Target >= 80%)")
    print(f"False-Positive Rate: {res['false_positive_rate_pct']}% (Target <= 20%)")
    print("=" * 60)
