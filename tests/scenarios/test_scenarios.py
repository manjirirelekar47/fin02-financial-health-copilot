import unittest
import pandas as pd
from typing import Dict, Any

from src.categoriser import categorise_transaction, categorise_dataframe

class TestScenarios(unittest.TestCase):
    def setUp(self):
        # 15 Labelled Scenarios
        # Each scenario has a merchant narration, a "type" of case, and expected `needs_review` outcome
        self.scenarios = [
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
            {"merchant": "DIWALI MELA STALL UPI", "type": "borderline", "expected_needs_review": True, "expected_category": "Uncategorised"}, # Seasonal
            {"merchant": "FINAL LOAN SETTLEMENT", "type": "borderline", "expected_needs_review": False, "expected_category": "Debt Payment"}, # Loan about to end - matched by "LOAN" rule
            {"merchant": "RARE ANTIQUE SHOP", "type": "borderline", "expected_needs_review": True, "expected_category": "Uncategorised"}, # One-off purchase
            {"merchant": "LOCAL PHARMACY MEDS", "type": "borderline", "expected_needs_review": False, "expected_category": "Health"}, # Matched by "PHARMACY" rule
            {"merchant": "AIRLINE TICKET UPGRADE", "type": "borderline", "expected_needs_review": False, "expected_category": "Travel"}, # Matched by "AIRLINE"
        ]

    def test_scenarios_and_metrics(self):
        total = len(self.scenarios)
        matches = 0
        false_positives = 0
        true_negatives = 0
        
        for sc in self.scenarios:
            merchant = sc["merchant"]
            expected_review = sc["expected_needs_review"]
            
            cat, conf, needs_review, why = categorise_transaction(merchant)
            
            # Match rate calculation
            if needs_review == expected_review:
                matches += 1
            
            # False positive: It was safe/standard but got flagged for review
            if sc["type"] == "safe" and needs_review:
                false_positives += 1
                
            # True negative: It was safe and did not get flagged
            if sc["type"] == "safe" and not needs_review:
                true_negatives += 1
                
        match_rate = (matches / total) * 100
        # FP Rate = FP / (FP + TN)
        fp_rate = (false_positives / (false_positives + true_negatives)) * 100 if (false_positives + true_negatives) > 0 else 0
        
        print("\n=== Scenario Test Set Metrics ===")
        print(f"Total Scenarios Evaluated: {total}")
        print(f"Match Rate (Accuracy vs Expected): {match_rate:.1f}%")
        print(f"False-Positive Rate (Safe txns wrongly flagged): {fp_rate:.1f}%")
        print("=================================\n")
        
        # We assert reasonable bounds for a successful CI pipeline run
        self.assertGreaterEqual(match_rate, 80.0, "Match rate should be at least 80%")
        self.assertLessEqual(fp_rate, 20.0, "False positive rate should be under 20%")

if __name__ == '__main__':
    unittest.main()
