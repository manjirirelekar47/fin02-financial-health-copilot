import pandas as pd
import numpy as np
import os

def generate_mapped_transactions():
    data_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data")
    out_path = os.path.join(data_dir, "kaggle_transactions_mapped.csv")
    
    # 1. Load Personal Transactions
    pt_path = os.path.join(data_dir, "personal_transactions.csv")
    if os.path.exists(pt_path):
        pt_df = pd.read_csv(pt_path)
        pt_df = pt_df.rename(columns={"Description": "Narration", "Transaction Type": "Type"})
        pt_df["Source"] = "personal_transactions"
    else:
        pt_df = pd.DataFrame()
        
    # 2. Load Personal Finance Dataset
    pfd_path = os.path.join(data_dir, "Personal_Finance_Dataset.csv")
    if os.path.exists(pfd_path):
        pfd_df = pd.read_csv(pfd_path)
        pfd_df = pfd_df.rename(columns={"Transaction Description": "Narration"})
        pfd_df["Source"] = "Personal_Finance_Dataset"
    else:
        pfd_df = pd.DataFrame()
        
    df = pd.concat([pt_df, pfd_df], ignore_index=True)
    
    # Category Mappings
    mapping = {
        "Credit Card Payment": "Debt Payment",
        "Mortgage & Rent": "Housing",
        "Rent": "Housing",
        "Paycheck": "Income",
        "Salary": "Income",
        "Restaurants": "Food & Dining",
        "Food & Drink": "Food & Dining",
        "Coffee Shops": "Food & Dining",
        "Alcohol & Bars": "Food & Dining",
        "Fast Food": "Food & Dining",
        "Food Dining": "Food & Dining",
        "Groceries": "Groceries",
        "Utilities": "Utilities",
        "Mobile Phone": "Utilities",
        "Internet": "Utilities",
        "Shopping": "Shopping",
        "Home Improvement": "Shopping",
        "Gas & Fuel": "Transport",
        "Auto Insurance": "Transport",
        "Auto Payment": "Debt Payment",
        "Music": "Subscriptions",
        "Movies & DVDs": "Entertainment",
        "Entertainment": "Entertainment",
        "Health & Fitness": "Health",
        "Pharmacy": "Health",
        "Health Insurance": "Health",
        "Doctor": "Health",
        "Travel": "Travel",
        "Airfare": "Travel",
        "Hotel": "Travel",
        "Hair Salon": "Shopping",
        "Clothing": "Shopping"
    }
    
    df["Category"] = df["Category"].map(lambda x: mapping.get(str(x), "Uncategorised") if pd.notnull(x) else "Uncategorised")
    
    # Keep only relevant columns
    cols = ["Date", "Narration", "Amount", "Category", "Type", "Source"]
    final_df = df[[c for c in cols if c in df.columns]]
    
    # Filter out empty narrations
    final_df = final_df.dropna(subset=["Narration", "Amount"])
    
    final_df.to_csv(out_path, index=False)
    print(f"Generated {len(final_df)} transaction-level records from real Kaggle transaction files.")

if __name__ == "__main__":
    generate_mapped_transactions()
