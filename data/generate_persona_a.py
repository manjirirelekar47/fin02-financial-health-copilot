"""
generate_persona_a.py
----------------------
Generates a synthetic 6-month transaction history for Persona A:
a salaried professional with a growing EMI burden and declining savings rate.

This is deliberately NOT random noise — it encodes a specific, engineered
story (EMI share of income rising month over month) so that the downstream
health-ratio and forecasting stages have a real, detectable pattern to surface
in the demo. Output columns are intentionally uncategorised (no `category`
column) so the ingestion + categoriser stages have real work to do on raw data.

Output: data/persona_a_transactions.csv
Columns: date, merchant, amount, type, account_type
    date         - YYYY-MM-DD
    merchant     - raw merchant/description string, as it would appear on a
                   real statement (unnormalised on purpose)
    amount       - always positive; direction is given by `type`
    type         - 'credit' (money in) or 'debit' (money out)
    account_type - 'bank' or 'credit_card'
"""

import csv
import random
from datetime import date, timedelta

random.seed(42)  # reproducible — important for back-testing consistency

START_DATE = date(2026, 3, 1)
MONTHS = 6
MONTHLY_SALARY = 68000

# EMI grows as a share of income over the 6 months — this is the "rising EMI
# burden" pattern Persona A is designed around.
EMI_BY_MONTH = [12000, 12000, 13500, 13500, 15000, 16500]

RENT = 18000
SUBSCRIPTIONS = [
    ("NETFLIX.COM", 199),
    ("SPOTIFY INDIA", 119),
    ("CULT.FIT MEMBERSHIP", 1499),
]
UTILITY_MERCHANTS = ["MSEB ELECTRICITY", "AIRTEL BROADBAND", "PIPED GAS CORP"]
DISCRETIONARY_MERCHANTS = [
    "SWIGGY", "ZOMATO", "AMAZON.IN", "BIGBASKET", "H&M INDIA",
    "PVR CINEMAS", "STARBUCKS", "UBER TRIP", "MYNTRA",
]


def month_dates(month_index: int):
    """First calendar day of the given 0-indexed month offset from START_DATE."""
    year = START_DATE.year + (START_DATE.month - 1 + month_index) // 12
    month = (START_DATE.month - 1 + month_index) % 12 + 1
    return date(year, month, 1)


def add_days(d: date, days: int) -> date:
    return d + timedelta(days=days)


def generate() -> list[dict]:
    rows = []

    for m in range(MONTHS):
        m_start = month_dates(m)

        # --- Salary credit: 1st of month, fixed ---
        rows.append({
            "date": m_start.isoformat(),
            "merchant": "ACME CORP SALARY",
            "amount": MONTHLY_SALARY,
            "type": "credit",
            "account_type": "bank",
        })

        # --- Rent: 3rd of month, fixed ---
        rows.append({
            "date": add_days(m_start, 2).isoformat(),
            "merchant": "RENT - LANDLORD TRANSFER",
            "amount": RENT,
            "type": "debit",
            "account_type": "bank",
        })

        # --- EMI: 5th of month, rising over time (small jitter on exact day) ---
        emi_amount = EMI_BY_MONTH[m]
        emi_day = 4 + random.choice([-1, 0, 0, 1])  # ±1 day jitter, interval tolerance test
        rows.append({
            "date": add_days(m_start, max(emi_day, 0)).isoformat(),
            "merchant": "HDFC HOME LOAN EMI",
            "amount": emi_amount,
            "type": "debit",
            "account_type": "bank",
        })

        # --- Subscriptions: recurring, ~same day each month, small amount jitter ---
        for merchant, base_amount in SUBSCRIPTIONS:
            jitter = random.choice([-1, 0, 0, 1])
            day_offset = 9 + jitter
            amount = round(base_amount * random.uniform(0.98, 1.02), 2)
            rows.append({
                "date": add_days(m_start, day_offset).isoformat(),
                "merchant": merchant,
                "amount": amount,
                "type": "debit",
                "account_type": "credit_card",
            })

        # --- Utilities: monthly, some amount variance (usage-based) ---
        for merchant in UTILITY_MERCHANTS:
            day_offset = random.randint(12, 18)
            amount = round(random.uniform(600, 1800), 2)
            rows.append({
                "date": add_days(m_start, day_offset).isoformat(),
                "merchant": merchant,
                "amount": amount,
                "type": "debit",
                "account_type": "bank",
            })

        # --- Discretionary spend: rises slightly as savings discipline erodes ---
        n_discretionary = 10 + m  # 10 in month 0, 15 in month 5 — mild creep
        for _ in range(n_discretionary):
            merchant = random.choice(DISCRETIONARY_MERCHANTS)
            day_offset = random.randint(0, 27)
            amount = round(random.uniform(150, 2200), 2)
            rows.append({
                "date": add_days(m_start, day_offset).isoformat(),
                "merchant": merchant,
                "amount": amount,
                "type": "debit",
                "account_type": "credit_card",
            })

        # --- One occasional irregular large expense (not every month) ---
        if m in (2, 4):
            rows.append({
                "date": add_days(m_start, random.randint(15, 25)).isoformat(),
                "merchant": "APOLLO PHARMACY" if m == 2 else "MAKEMYTRIP",
                "amount": round(random.uniform(3000, 9000), 2),
                "type": "debit",
                "account_type": "credit_card",
            })

    rows.sort(key=lambda r: r["date"])
    return rows


def main():
    rows = generate()
    out_path = "persona_a_transactions.csv"
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["date", "merchant", "amount", "type", "account_type"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} transactions to {out_path}")


if __name__ == "__main__":
    main()
