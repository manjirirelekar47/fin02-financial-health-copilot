import csv
import random
from datetime import datetime, timedelta
import os
import pandas as pd

def generate_persona_b():
    raw_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "kaggle_indian_personal_finance_raw.csv")
    df = pd.read_csv(raw_path)
    
    # Filter to Self_Employed to represent the Gig Worker / Self Employed persona
    self_employed_df = df[df["Occupation"] == "Self_Employed"]
    
    # Pick a random 6 months worth of data (we'll just pick 6 random rows representing 6 months of a single persona)
    if len(self_employed_df) < 6:
        sample_rows = df.sample(6, random_state=42)
    else:
        sample_rows = self_employed_df.sample(6, random_state=42)
    
    start_date = datetime(2025, 10, 1)
    
    transactions = []
    
    # Load real Kaggle narrations
    mapped_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "kaggle_transactions_mapped.csv")
    mapped_df = pd.read_csv(mapped_path)
    
    # Load Official Calibration Benchmarks
    calib_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "rbi_nha_official_benchmarks.csv")
    calib_df = pd.read_csv(calib_path)
    
    # Extract target ratios
    debt_service_target = calib_df.loc[calib_df['metric'] == 'Debt service ratio', 'value'].values[0] / 100.0
    oop_target = calib_df.loc[calib_df['metric'] == 'Out-of-pocket (OOP) health spending', 'value'].values[0] / 100.0
    savings_buffer_target = calib_df.loc[calib_df['metric'] == 'Savings buffer (Months of expenses)', 'value'].values[0]
    
    # Pre-group narrations by our target categories
    def get_merchant(cat, default_list):
        opts = mapped_df[mapped_df["Category"] == cat]["Narration"].dropna().tolist()
        return random.choice(opts) if opts else random.choice(default_list)
    
    month_offset = 0
    total_health_spend = 0
    total_debt_spend = 0
    
    for _, row in sample_rows.iterrows():
        current_month = start_date + timedelta(days=30 * month_offset)
        month_offset += 1
        
        # Income - split into multiple volatile gig payouts
        income = row.get("Income", 0)
        if income > 0:
            num_gigs = random.randint(2, 5)
            gig_amount = income / num_gigs
            for _ in range(num_gigs):
                gig_date = current_month + timedelta(days=random.randint(0, 27))
                merchant = get_merchant("Income", ["GIG PAYOUT", "FREELANCE INCOME"])
                transactions.append((gig_date.strftime("%Y-%m-%d"), merchant, round(gig_amount, 2), "credit", "bank"))
                
        # Expenses - mapped exactly from Kaggle, calibrated against RBI/NHA bounds
        kaggle_to_shield = {
            "Rent": "Housing",
            "Loan_Repayment": "Debt Payment",
            "Insurance": "Health",
            "Groceries": "Groceries",
            "Transport": "Transport",
            "Eating_Out": "Food & Dining",
            "Entertainment": "Entertainment",
            "Utilities": "Utilities",
            "Healthcare": "Health",
            "Education": "Education"
        }
        
        for kaggle_col, shield_cat in kaggle_to_shield.items():
            amount = row.get(kaggle_col, 0)
            if pd.isna(amount) or amount <= 0:
                continue
                
            # RBI / NHA Calibration overrides for specific categories to ensure realistic alignment
            if shield_cat == "Debt Payment" and income > 0:
                # Ensure the loan repayment aligns with the RBI debt service ratio (approx 12%)
                # We blend the Kaggle amount with the RBI target to create a calibrated realistic number
                rbi_amount = income * debt_service_target
                amount = (amount + rbi_amount) / 2
                
            if shield_cat == "Health":
                # Ensure OOP health spending reflects NHA vulnerability (approx 39.4% of total health expenditure)
                # For a gig worker, we simulate a shock that scales with the OOP vulnerability
                if random.random() < oop_target:
                    amount = amount * random.uniform(1.5, 3.0) # Simulate an OOP medical shock
            
            splits = random.randint(1, 4) if kaggle_col in ["Groceries", "Transport", "Eating_Out"] else 1
            split_amount = amount / splits
            
            for _ in range(splits):
                tx_date = current_month + timedelta(days=random.randint(0, 27))
                merchant = get_merchant(shield_cat, [shield_cat.upper()])
                acc = "credit_card" if random.random() < 0.5 else "bank"
                transactions.append((tx_date.strftime("%Y-%m-%d"), merchant, round(split_amount, 2), "debit", acc))
                
    # Sort by date
    transactions.sort(key=lambda x: x[0])
    
    out_path = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'persona_b_transactions.csv')
    with open(out_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['date', 'merchant', 'amount', 'type', 'account_type'])
        writer.writerows(transactions)
        
    print(f"Generated {len(transactions)} transactions for Persona B directly from Kaggle Self_Employed data.")

if __name__ == "__main__":
    generate_persona_b()
