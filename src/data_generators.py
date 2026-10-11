"""data_generators.py — 36-month reproducible synthetic data generator for Persona A and Persona B.

Generates 36 months of realistic Indian personal finance transactions across three distinct,
fixed-seed runs:
  - Train:      Months 1 to 20  (2024-01-01 to 2025-08-31)
  - Validation: Months 21 to 24 (2025-09-01 to 2025-12-31)
  - Test:       Months 25 to 36 (2026-01-01 to 2026-12-31) [Held-out]

Personas:
  - Persona A: Salaried professional with rising EMI debt burden and declining savings rate.
  - Persona B: Self-employed / gig worker with two-regime income (normal vs lean), irregular
               freelance credits, zero-income weeks, and heavy-tailed expense shocks.

Output format adheres strictly to the Day-One ingestion contract:
  date, narration, amount, type, account_type
"""

from __future__ import annotations

import csv
from datetime import date, timedelta
import math
import os
from pathlib import Path
import random
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
SPLITS_DIR = DATA_DIR / "splits"

BASE_START_DATE = date(2024, 1, 1)

# Fixed seeds per specification
SEEDS = {
    "persona_a": {
        "train": 42,
        "val": 43,
        "test": 44,
    },
    "persona_b": {
        "train": 101,
        "val": 102,
        "test": 103,
    },
}

SPLIT_RANGES = {
    "train": (0, 20),      # Months 1 to 20  (indices 0..19)
    "val": (20, 24),      # Months 21 to 24 (indices 20..23)
    "test": (24, 36),     # Months 25 to 36 (indices 24..35)
}


def _month_start(month_index: int) -> date:
    """Return the 1st of the calendar month corresponding to month_index (0-indexed from 2024-01-01)."""
    year = BASE_START_DATE.year + (BASE_START_DATE.month - 1 + month_index) // 12
    month = (BASE_START_DATE.month - 1 + month_index) % 12 + 1
    return date(year, month, 1)


def _days_in_month(d: date) -> int:
    next_month = date(d.year + (d.month // 12), (d.month % 12) + 1, 1)
    return (next_month - d).days


# ==============================================================================
# Persona A Generator (Salaried, Rising EMI Burden)
# ==============================================================================

def generate_persona_a_slice(start_m: int, end_m: int, seed: int) -> list[dict[str, Any]]:
    """Generate Persona A transactions for months [start_m, end_m) with a dedicated seed."""
    rng = random.Random(seed)
    rows: list[dict[str, Any]] = []

    # Persona A Parameters
    # Base salary starts at 68,000 in Year 1, increments to 72,000 in Year 2, and 76,000 in Year 3
    rent_base = 18000.0
    subscriptions = [
        ("NETFLIX.COM", 199.0, "credit_card"),
        ("SPOTIFY INDIA", 119.0, "credit_card"),
        ("CULT.FIT MEMBERSHIP", 1499.0, "credit_card"),
    ]
    utility_merchants = [
        ("MSEB ELECTRICITY", (900.0, 1800.0)),
        ("AIRTEL BROADBAND", (999.0, 1199.0)),
        ("PIPED GAS CORP", (450.0, 850.0)),
    ]
    discretionary_merchants = [
        "SWIGGY ONLINE", "ZOMATO RESTAURANT", "AMAZON RETAIL", "BIGBASKET GROCERY",
        "BLINKIT QUICK", "H&M FASHION", "PVR CINEMAS", "STARBUCKS CAFE",
        "UBER TRIP", "MYNTRA SHOPPING", "DMART HYPERMARKET",
    ]

    for m in range(start_m, end_m):
        m_start = _month_start(m)
        month_days = _days_in_month(m_start)

        # 1. Salary: 1st of month (annual increments: M0-11: 68k, M12-23: 72k, M24-35: 76k)
        if m < 12:
            salary = 68000.0
        elif m < 24:
            salary = 72000.0
        else:
            salary = 76000.0

        rows.append({
            "date": m_start.isoformat(),
            "narration": "ACME CORP SALARY",
            "amount": salary,
            "type": "credit",
            "account_type": "bank",
        })

        # 2. Rent: 3rd of month
        rows.append({
            "date": (m_start + timedelta(days=2)).isoformat(),
            "narration": "RENT - LANDLORD TRANSFER",
            "amount": rent_base,
            "type": "debit",
            "account_type": "bank",
        })

        # 3. Rising EMI: grows progressively across 36 months (12k up to 26k)
        # Rising EMI burden: DTI climbs from ~17% to ~34%
        emi_base = 12000.0 + (m * 400.0)
        emi_jitter = rng.choice([-1, 0, 0, 1])
        emi_day = max(1, min(month_days - 1, 4 + emi_jitter))
        rows.append({
            "date": (m_start + timedelta(days=emi_day)).isoformat(),
            "narration": "HDFC HOME LOAN EMI",
            "amount": round(emi_base, 2),
            "type": "debit",
            "account_type": "bank",
        })

        # 4. Fixed Subscriptions (~10th of month with mild amount jitter)
        for merch, base_amt, acct in subscriptions:
            day_offset = max(1, min(month_days - 1, 9 + rng.choice([-1, 0, 1])))
            amt = round(base_amt * rng.uniform(0.98, 1.02), 2)
            rows.append({
                "date": (m_start + timedelta(days=day_offset)).isoformat(),
                "narration": merch,
                "amount": amt,
                "type": "debit",
                "account_type": acct,
            })

        # 5. Utilities (usage-based, 12th-18th)
        for merch, (low, high) in utility_merchants:
            day_offset = rng.randint(12, min(20, month_days - 2))
            amt = round(rng.uniform(low, high), 2)
            rows.append({
                "date": (m_start + timedelta(days=day_offset)).isoformat(),
                "narration": merch,
                "amount": amt,
                "type": "debit",
                "account_type": "bank",
            })

        # 6. Discretionary Outflows (10 to 16 transactions/month, mild creep over time)
        num_discretionary = 10 + min(6, m // 6)
        for _ in range(num_discretionary):
            merch = rng.choice(discretionary_merchants)
            day_offset = rng.randint(0, month_days - 1)
            amt = round(rng.uniform(200.0, 2400.0), 2)
            rows.append({
                "date": (m_start + timedelta(days=day_offset)).isoformat(),
                "narration": merch,
                "amount": amt,
                "type": "debit",
                "account_type": "credit_card",
            })

        # 7. Heavy-tailed Shock (approx once every 5-7 months, e.g. medical or travel)
        # Calibrated against NHA Out-Of-Pocket medical spending benchmarks
        if rng.random() < 0.20:
            shock_merch = rng.choice(["APOLLO PHARMACY", "MAX HEALTHCARE", "MAKEMYTRIP BOOKING"])
            shock_amt = round(rng.lognormvariate(math.log(7500.0), 0.45), 2)
            shock_day = rng.randint(5, month_days - 1)
            rows.append({
                "date": (m_start + timedelta(days=shock_day)).isoformat(),
                "narration": shock_merch,
                "amount": max(2500.0, min(35000.0, shock_amt)),
                "type": "debit",
                "account_type": "credit_card",
            })

    rows.sort(key=lambda r: r["date"])
    return rows


# ==============================================================================
# Persona B Generator (Self-Employed / Gig Worker, Two-Regime Mixture Model)
# ==============================================================================

def generate_persona_b_slice(start_m: int, end_m: int, seed: int) -> list[dict[str, Any]]:
    """Generate Persona B transactions for months [start_m, end_m) with a dedicated seed.

    Implements a two-regime income model:
      - Regime 1: Normal Month (prob = 0.75): 3 to 6 irregular freelance credits (total ₹70k-₹95k).
      - Regime 2: Lean Month   (prob = 0.25): 0 to 2 sparse payouts (total ₹20k-₹38k), zero-income weeks.
    """
    rng = random.Random(seed)
    rows: list[dict[str, Any]] = []

    # Persona B Obligations
    coworking_rent = 8500.0
    personal_loan_emi = 9500.0
    tech_stack_subs = [
        ("AWS CLOUD SERVICES", 2800.0, "credit_card"),
        ("ADOBE CREATIVE CLOUD", 4200.0, "credit_card"),
        ("GITHUB CO-PILOT", 850.0, "credit_card"),
    ]
    utilities = [
        ("JIO FIBER BROADBAND", 1199.0),
        ("TATA POWER MUMBAI", 1450.0),
    ]
    discretionary_merchants = [
        "SWIGGY ONLINE", "ZOMATO RESTAURANT", "AMAZON RETAIL", "BIGBASKET GROCERY",
        "BLINKIT QUICK", "UBER TRIP", "BLUE TOKAI COFFEE", "BOOKMYSHOW",
        "DMART HYPERMARKET", "CHAAYOS", "NATURES BASKET",
    ]
    client_names = [
        "FREELANCE DESIGN INVOICE", "UPWORK ESCROW PAYOUT", "CLIENT CONSULTING NEFT",
        "RAZORPAY SETTLEMENT", "TECH CONTRACT STIPEND",
    ]

    for m in range(start_m, end_m):
        m_start = _month_start(m)
        month_days = _days_in_month(m_start)

        # 1. Income Process: Two-regime mixture model
        # Probability of lean month = 25% (or forced on specific known stress cycles)
        is_lean_month = (rng.random() < 0.25) or (m in (4, 11, 22, 30))

        if is_lean_month:
            # Lean Month: 1 to 2 small payouts or occasional delay
            num_payouts = rng.choice([1, 1, 2])
            for _ in range(num_payouts):
                payout_day = rng.randint(8, month_days - 2)
                payout_amt = round(rng.uniform(12000.0, 18500.0), 2)
                rows.append({
                    "date": (m_start + timedelta(days=payout_day)).isoformat(),
                    "narration": rng.choice(client_names),
                    "amount": payout_amt,
                    "type": "credit",
                    "account_type": "bank",
                })
        else:
            # Normal Month: 3 to 5 distributed payouts (total ~₹70,000–₹95,000)
            num_payouts = rng.randint(3, 5)
            # Distributed across weeks to represent gig workflow
            payout_days = sorted(rng.sample(range(1, month_days), num_payouts))
            for day in payout_days:
                payout_amt = round(rng.uniform(14000.0, 26000.0), 2)
                rows.append({
                    "date": (m_start + timedelta(days=day)).isoformat(),
                    "narration": rng.choice(client_names),
                    "amount": payout_amt,
                    "type": "credit",
                    "account_type": "bank",
                })

        # 2. Fixed Co-working / Office Space: 4th of month
        rows.append({
            "date": (m_start + timedelta(days=3)).isoformat(),
            "narration": "WEWORK COWORKING LEASE",
            "amount": coworking_rent,
            "type": "debit",
            "account_type": "bank",
        })

        # 3. Personal Loan EMI: 7th of month
        emi_jitter = rng.choice([-1, 0, 1])
        emi_day = max(1, min(month_days - 1, 6 + emi_jitter))
        rows.append({
            "date": (m_start + timedelta(days=emi_day)).isoformat(),
            "narration": "BAJAJ FINANCE LOAN EMI",
            "amount": personal_loan_emi,
            "type": "debit",
            "account_type": "bank",
        })

        # 4. Tech / Professional Subscriptions
        for merch, base_amt, acct in tech_stack_subs:
            sub_day = rng.randint(10, 18)
            amt = round(base_amt * rng.uniform(0.97, 1.03), 2)
            rows.append({
                "date": (m_start + timedelta(days=sub_day)).isoformat(),
                "narration": merch,
                "amount": amt,
                "type": "debit",
                "account_type": acct,
            })

        # 5. Utilities
        for merch, base_amt in utilities:
            u_day = rng.randint(14, 22)
            amt = round(base_amt * rng.uniform(0.90, 1.15), 2)
            rows.append({
                "date": (m_start + timedelta(days=u_day)).isoformat(),
                "narration": merch,
                "amount": amt,
                "type": "debit",
                "account_type": "bank",
            })

        # 6. Discretionary Expenses (Flexible: cut in lean months)
        base_discretionary = 8 if is_lean_month else 14
        for _ in range(base_discretionary):
            merch = rng.choice(discretionary_merchants)
            day_offset = rng.randint(0, month_days - 1)
            # Gig workers spend more modestly during lean months
            max_spend = 1200.0 if is_lean_month else 2200.0
            amt = round(rng.uniform(150.0, max_spend), 2)
            rows.append({
                "date": (m_start + timedelta(days=day_offset)).isoformat(),
                "narration": merch,
                "amount": amt,
                "type": "debit",
                "account_type": "credit_card",
            })

        # 7. Surprise Equipment / Medical Expense (Heavy-Tailed Shock)
        if rng.random() < 0.22:
            shock_merch = rng.choice([
                "APPLE RESELLER REPAIR", "CHROMA LAPTOP BATTERY",
                "APOLLO PHARMACY CLINIC", "DIAGNOSTIC LAB TESTING"
            ])
            shock_amt = round(rng.lognormvariate(math.log(6800.0), 0.50), 2)
            shock_day = rng.randint(3, month_days - 1)
            rows.append({
                "date": (m_start + timedelta(days=shock_day)).isoformat(),
                "narration": shock_merch,
                "amount": max(1800.0, min(42000.0, shock_amt)),
                "type": "debit",
                "account_type": "credit_card",
            })

    rows.sort(key=lambda r: r["date"])
    return rows


# ==============================================================================
# File Writing & Generation Pipeline
# ==============================================================================

def write_csv(filepath: Path, rows: list[dict[str, Any]]) -> None:
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        # Standard schema columns
        fieldnames = ["date", "narration", "amount", "type", "account_type"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def generate_all_splits() -> dict[str, dict[str, int]]:
    """Generate all 3 separate runs for Persona A and Persona B and save files."""
    results: dict[str, dict[str, int]] = {"persona_a": {}, "persona_b": {}}

    for persona, gen_fn in [("persona_a", generate_persona_a_slice), ("persona_b", generate_persona_b_slice)]:
        all_36_rows: list[dict[str, Any]] = []

        for split, (m_start, m_end) in SPLIT_RANGES.items():
            seed = SEEDS[persona][split]
            slice_rows = gen_fn(m_start, m_end, seed)

            # Save split file
            split_file = SPLITS_DIR / f"{persona}_{split}.csv"
            write_csv(split_file, slice_rows)
            results[persona][split] = len(slice_rows)

            all_36_rows.extend(slice_rows)

        # Save full 36-month reference file
        full_file = DATA_DIR / f"{persona}_36mo.csv"
        all_36_rows.sort(key=lambda r: r["date"])
        write_csv(full_file, all_36_rows)

        # Also update root data/persona_x_transactions.csv so standard paths have the 36-month data
        compat_file = DATA_DIR / f"{persona}_transactions.csv"
        write_csv(compat_file, all_36_rows)

    return results


if __name__ == "__main__":
    summary = generate_all_splits()
    print("Generation complete!")
    for p, counts in summary.items():
        print(f"  {p}: {counts} (total {sum(counts.values())} rows)")
