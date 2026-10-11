"""
categoriser.py — Stage 2a of the FIN-02 pipeline.

Classifies each transaction into a spending category using rule-based
keyword matching against the merchant string. Anything the rules can't
confidently classify is routed through an ML model (TF-IDF + LR) and then
an LLM-fallback hook. If still uncertain, it is flagged `needs_review`.
"""

from __future__ import annotations

from typing import Callable, Optional, Tuple, Union
import warnings

import pandas as pd
import numpy as np

# Suppress sklearn warnings if they occur during cold start
warnings.filterwarnings('ignore', category=UserWarning)
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

CATEGORY_RULES: list[tuple[str, list[str]]] = [
    ("Income", ["SALARY", "PAYROLL", "STIPEND"]),
    ("Housing", ["RENT", "LANDLORD", "HOUSING SOCIETY"]),
    ("Debt Payment", ["EMI", "LOAN", "HOME LOAN", "CREDIT CARD BILL PAYMENT"]),
    ("Subscriptions", ["NETFLIX", "SPOTIFY", "PRIME VIDEO", "HOTSTAR", "CULT.FIT", "GYM"]),
    ("Utilities", ["ELECTRICITY", "MSEB", "BROADBAND", "AIRTEL", "JIO", "PIPED GAS", "WATER BILL"]),
    ("Food & Dining", ["SWIGGY", "ZOMATO", "STARBUCKS", "RESTAURANT", "CAFE", "DOMINOS", "MCDONALD"]),
    ("Groceries", ["BIGBASKET", "GROFERS", "BLINKIT", "DMART", "GROCERY"]),
    ("Shopping", ["AMAZON", "MYNTRA", "H&M", "FLIPKART", "AJIO"]),
    ("Entertainment", ["PVR", "CINEMA", "BOOKMYSHOW", "INOX"]),
    ("Transport", ["UBER", "OLA", "RAPIDO", "PETROL", "FUEL", "METRO"]),
    ("Travel", ["MAKEMYTRIP", "IRCTC", "AIRLINE", "GOIBIBO", "YATRA"]),
    ("Health", ["PHARMACY", "APOLLO", "HOSPITAL", "CLINIC", "DIAGNOSTIC"]),
]

HIGH_CONFIDENCE = 0.95
REVIEW_THRESHOLD = 0.60  # below this, row is flagged needs_review

# --- Feature 4: Self-Learning Categoriser State ---
_vectorizer = TfidfVectorizer(ngram_range=(2, 5), analyzer='char_wb')
# We use probability calibration to ensure our confidence scores are well-calibrated for the UI
_classifier = CalibratedClassifierCV(LogisticRegression(class_weight='balanced', max_iter=1000))
_is_trained = False
_training_data: list[dict] = []
_learning_curve: list[dict] = []

def _bootstrap_model():
    """Seeds the ML model with real mapped Kaggle data so it has a robust baseline."""
    global _is_trained
    import os
    import pandas as pd
    
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "kaggle_transactions_mapped.csv")
    
    if os.path.exists(data_path):
        df = pd.read_csv(data_path)
        # Randomly sample up to 5000 rows to keep boot times under a second
        if len(df) > 5000:
            df = df.sample(5000, random_state=42)
            
        for _, row in df.iterrows():
            _training_data.append({'narration': str(row['Narration']), 'category': str(row['Category'])})
    else:
        # Fallback to rules if Kaggle pipeline hasn't been run yet
        for cat, kws in CATEGORY_RULES:
            for kw in kws:
                _training_data.append({'narration': kw, 'category': cat})
                _training_data.append({'narration': f"UPI-{kw}-123", 'category': cat})
                _training_data.append({'narration': f"POS {kw} MUMBAI", 'category': cat})
            
    X = [d['narration'] for d in _training_data]
    y = [d['category'] for d in _training_data]
    X_vec = _vectorizer.fit_transform(X)
    _classifier.fit(X_vec, y)
    _is_trained = True

# Initialize model
_bootstrap_model()


def apply_correction_and_retrain(tx_id: str, narration: str, corrected_category: str):
    """
    Appends the user correction to the training data, retrains in under a second,
    and updates the learning curve metrics (held-out accuracy).
    """
    global _is_trained
    _training_data.append({'narration': narration, 'category': corrected_category})
    
    X = [d['narration'] for d in _training_data]
    y = [d['category'] for d in _training_data]
    
    # Calculate learning curve point (held-out accuracy)
    # We use a simple 80-20 split to evaluate how the model improves over time
    if len(X) > 20:
        try:
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
            X_train_vec = _vectorizer.fit_transform(X_train)
            clf = CalibratedClassifierCV(LogisticRegression(class_weight='balanced', max_iter=1000))
            clf.fit(X_train_vec, y_train)
            X_test_vec = _vectorizer.transform(X_test)
            acc = accuracy_score(y_test, clf.predict(X_test_vec))
        except ValueError:
            acc = 0.0 # E.g., if a class has only 1 member and cannot be split safely
    else:
        acc = 0.0 
        
    _learning_curve.append({'num_corrections': len(_training_data), 'accuracy': acc})
    
    # Final retrain on all data
    X_vec = _vectorizer.fit_transform(X)
    _classifier.fit(X_vec, y)
    _is_trained = True
    
    return {"status": "success", "new_accuracy": acc}


def _rule_based_category(merchant: str) -> tuple[Optional[str], float]:
    """Returns (category, confidence) from keyword rules, or (None, 0.0) if no match."""
    for category, keywords in CATEGORY_RULES:
        if any(kw in merchant for kw in keywords):
            return category, HIGH_CONFIDENCE
    return None, 0.0


def categorise_transaction(
    merchant: str,
    llm_fallback: Optional[Callable[[str], tuple[str, float]]] = None,
) -> tuple[str, float, bool, str]:
    """
    Categorise a single merchant string.

    Returns:
        (category, confidence, needs_review, why_tooltip)
    """
    # 1. Rules
    category, confidence = _rule_based_category(merchant)
    why_tooltip = "matched by rule" if category else ""

    # 2. ML Model (Character n-gram TF-IDF + LogisticRegression)
    if category is None and _is_trained:
        try:
            vec = _vectorizer.transform([merchant])
            probs = _classifier.predict_proba(vec)[0]
            max_idx = probs.argmax()
            confidence = float(probs[max_idx])
            category = _classifier.classes_[max_idx]
            why_tooltip = f"model confidence {confidence*100:.0f}%"
        except Exception:
            pass

    # 3. LLM Fallback
    if category is None and llm_fallback is not None:
        try:
            category, confidence = llm_fallback(merchant)
            why_tooltip = "llm fallback"
        except Exception:
            category, confidence = "Uncategorised", 0.0

    if category is None:
        category, confidence = "Uncategorised", 0.0
        why_tooltip = "uncategorised"

    needs_review = confidence < REVIEW_THRESHOLD
    
    return category, confidence, needs_review, why_tooltip


def categorise_dataframe(
    df: pd.DataFrame,
    llm_fallback: Optional[Callable[[str], tuple[str, float]]] = None,
) -> pd.DataFrame:
    """
    Applies categorise_transaction to every row of an ingested DataFrame.
    """
    df = df.copy()
    results = df["merchant"].apply(lambda m: categorise_transaction(m, llm_fallback))
    df["category"] = results.apply(lambda r: r[0])
    df["category_confidence"] = results.apply(lambda r: r[1])
    df["needs_review"] = results.apply(lambda r: r[2])
    # Safely extract why_tooltip keeping backward compatibility
    df["why_tooltip"] = results.apply(lambda r: r[3] if len(r) > 3 else "")
    return df


def category_summary(df: pd.DataFrame) -> pd.DataFrame:
    """Quick sanity-check helper: total spend per category, sorted descending."""
    if "category" not in df.columns:
        return pd.DataFrame()
    spend = df[df["type"] == "debit"].groupby("category")["amount"].sum().sort_values(ascending=False)
    return spend.reset_index().rename(columns={"amount": "total_spend"})


if __name__ == "__main__":
    import os
    from ingestion import load_transactions

    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "persona_a_transactions.csv")
    clean = load_transactions(data_path)
    categorised = categorise_dataframe(clean)

    print(categorised[["merchant", "category", "category_confidence", "why_tooltip", "needs_review"]].head(12))
    print(f"\n{categorised['needs_review'].sum()} row(s) flagged needs_review out of {len(categorised)}.")
    print("\nSpend by category:")
    print(category_summary(categorised).to_string(index=False))
    
    # Test correction loop
    print("\nApplying a correction for 'UPI-PAYTM-SHOP'...")
    apply_correction_and_retrain("test-id-1", "UPI-PAYTM-SHOP", "Shopping")
    cat_res = categorise_transaction("UPI-PAYTM-SHOP")
    print(f"New prediction for 'UPI-PAYTM-SHOP': {cat_res[0]} (conf {cat_res[1]:.2f}) - {cat_res[3]}")

