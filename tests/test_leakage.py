"""test_leakage.py — Strict data leakage prevention unit tests.

Verifies:
  1. The held-out test split (Months 25 to 36) cannot be read without explicit authorization.
  2. Training (Months 1 to 20) and Validation (Months 21 to 24) windows contain zero observations
     from the test period.
  3. The leakage guard actively detects contaminated datasets and raises DataLeakageError.
  4. Both Persona A and Persona B datasets load cleanly through RealEngine.ingest().
  5. assumptions.md exists and contains the required parameter and calibration benchmark mappings.
"""

from __future__ import annotations

from pathlib import Path
import pandas as pd
import pytest

from contracts.schemas import Transaction
from engine.real_engine import RealEngine
from src.data_splits import (
    DataLeakageError,
    assert_no_test_leakage,
    load_split,
    load_test_window,
    load_training_window,
    load_tuning_window,
    load_validation_window,
)

ROOT_DIR = Path(__file__).parents[1]


def test_test_window_blocked_without_explicit_authorization():
    """Verify that attempting to load the test window without authorize_eval=True raises DataLeakageError."""
    with pytest.raises(DataLeakageError, match="Data leakage detected"):
        load_test_window("persona_a")

    with pytest.raises(DataLeakageError, match="Data leakage detected"):
        load_split("persona_b", "test")


def test_test_window_accessible_only_with_explicit_authorization():
    """Verify that authorized evaluation harness can load test window."""
    df_a = load_test_window("persona_a", authorize_eval=True)
    assert not df_a.empty
    assert (pd.to_datetime(df_a["date"]) >= pd.to_datetime("2026-01-01")).all()

    df_b = load_test_window("persona_b", authorize_eval=True)
    assert not df_b.empty
    assert (pd.to_datetime(df_b["date"]) >= pd.to_datetime("2026-01-01")).all()


@pytest.mark.parametrize("persona", ["persona_a", "persona_b"])
def test_training_and_validation_windows_have_zero_test_dates(persona: str):
    """Verify training (M1-20) and validation (M21-24) windows are strictly prior to 2026-01-01."""
    train_df = load_training_window(persona)
    assert not train_df.empty
    assert (pd.to_datetime(train_df["date"]) < pd.to_datetime("2025-09-01")).all()
    # assert_no_test_leakage must pass with zero errors
    assert_no_test_leakage(train_df, context=f"{persona} train")

    val_df = load_validation_window(persona)
    assert not val_df.empty
    val_dates = pd.to_datetime(val_df["date"])
    assert (val_dates >= pd.to_datetime("2025-09-01")).all()
    assert (val_dates < pd.to_datetime("2026-01-01")).all()
    assert_no_test_leakage(val_df, context=f"{persona} val")

    tuning_df = load_tuning_window(persona)
    assert not tuning_df.empty
    assert (pd.to_datetime(tuning_df["date"]) < pd.to_datetime("2026-01-01")).all()
    assert_no_test_leakage(tuning_df, context=f"{persona} tuning")


def test_leakage_assertion_raises_on_contaminated_dataframe():
    """Verify assert_no_test_leakage actively intercepts DataFrames contaminated with test dates."""
    clean_df = pd.DataFrame([
        {"date": "2024-05-10", "amount": 100.0, "narration": "Test Inflow", "type": "credit"},
        {"date": "2025-11-20", "amount": 50.0, "narration": "Test Outflow", "type": "debit"},
    ])
    # Should not raise
    assert_no_test_leakage(clean_df)

    contaminated_df = pd.DataFrame([
        {"date": "2025-11-20", "amount": 50.0, "narration": "Valid Row", "type": "debit"},
        {"date": "2026-02-14", "amount": 500.0, "narration": "Leaked Test Row", "type": "debit"},
    ])
    with pytest.raises(DataLeakageError, match="CRITICAL DATA LEAKAGE"):
        assert_no_test_leakage(contaminated_df, context="Contaminated model fit")


@pytest.mark.parametrize("persona", ["persona_a", "persona_b"])
def test_both_personas_load_cleanly_through_engine_ingest(persona: str):
    """Verify Persona A and Persona B datasets load through RealEngine.ingest() without errors."""
    engine = RealEngine()
    filepath = ROOT_DIR / "data" / f"{persona}_36mo.csv"
    assert filepath.exists(), f"36-month dataset missing: {filepath}"

    df = pd.read_csv(filepath)
    raw_rows = df.to_dict(orient="records")

    result = engine.ingest(raw_rows, source=persona)
    assert result["accepted_count"] > 0
    assert result["rejected_count"] == 0, f"Unexpected rejected rows: {result.get('rejected', [])}"
    assert len(result["accepted"]) == len(raw_rows)

    # Validate schema of accepted rows
    for row in result["accepted"][:20]:
        Transaction.model_validate(row)


def test_assumptions_md_exists_and_contains_benchmarks():
    """Verify assumptions.md exists and documents official calibration benchmarks."""
    assumptions_path = ROOT_DIR / "assumptions.md"
    assert assumptions_path.exists(), "assumptions.md file does not exist"

    content = assumptions_path.read_text(encoding="utf-8")
    assert "RBI Financial Stability Report" in content
    assert "National Health Accounts" in content
    assert "Months 1 to 20" in content
    assert "Months 21 to 24" in content
    assert "Months 25 to 36" in content
    assert "Two-regime mixture model" in content
