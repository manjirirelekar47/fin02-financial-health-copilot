import json
import os
import pandas as pd

def load_calibration_table():
    path = os.path.join(os.path.dirname(__file__), "..", "data", "calibration_table.json")
    with open(path, "r") as f:
        return json.load(f)

def get_calibration_tags(df_persona: pd.DataFrame, annual_income: float = None):
    """
    Check the persona's transaction history against the RBI/NHA calibration table.
    Returns a list of source tags and flags for the UI to display.
    """
    calib = load_calibration_table()
    tags = []
    
    debits = df_persona[df_persona["type"] == "debit"]
    if "category" in debits.columns:
        total_spend = debits["amount"].sum()
        health_spend = debits[debits["category"] == "Health"]["amount"].sum()
        oop_pct = (health_spend / total_spend) * 100 if total_spend > 0 else 0
        
        nha_oop = next((item for item in calib if "OOP" in item["metric"] and "Target" not in item["metric"]), None)
        if nha_oop:
            nha_val = float(nha_oop["value"])
            status = "warning" if oop_pct > nha_val else "ok"
            tags.append({
                "metric": "Out-of-pocket (OOP) Medical Spend",
                "computed_persona_value": f"{oop_pct:.1f}%",
                "rbi_benchmark_value": f"{nha_val}%",
                "source": nha_oop["report_name"],
                "status": status,
                "tooltip": f"National average is {nha_val}%. Calculated as Health Spend / Total Spend."
            })

    if annual_income is None:
        credits = df_persona[df_persona["type"] == "credit"]
        annual_income = credits["amount"].sum() * (365 / df_persona["date"].nunique()) if not credits.empty else 1
        
    if "category" in debits.columns:
        debt_payments = debits[debits["category"] == "Debt Payment"]["amount"].sum()
        days_in_data = df_persona["date"].nunique()
        annual_debt_payments = debt_payments * (365 / days_in_data) if days_in_data > 0 else 0
        
        debt_to_income = (annual_debt_payments / annual_income) * 100 if annual_income > 0 else 0
        
        rbi_dsr = next((item for item in calib if "Debt service ratio" in item["metric"]), None)
        if rbi_dsr:
             rbi_val = float(rbi_dsr["value"])
             status = "warning" if debt_to_income > rbi_val else "ok"
             tags.append({
                "metric": "Debt Service Ratio",
                "computed_persona_value": f"{debt_to_income:.1f}%",
                "rbi_benchmark_value": f"{rbi_val}%",
                "source": rbi_dsr["report_name"],
                "status": status,
                "tooltip": f"National Debt Service Ratio average is {rbi_val}% of income."
            })
            
    return tags
