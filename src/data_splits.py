"""data_splits.py — Safe dataset split loaders with leakage prevention boundaries.

Enforces strict train-validation-test separation:
  - Train:      Months 1 to 20  (2024-01-01 to 2025-08-31)
  - Validation: Months 21 to 24 (2025-09-01 to 2025-12-31)
  - Test:       Months 25 to 36 (2026-01-01 to 2026-12-31) [HELD-OUT]

Rule:
  The test window (Months 25 to 36) must NEVER be read or referenced by any
  training, hyperparameter tuning, model selection, or interval calibration code.
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
SPLITS_DIR = DATA_DIR / "splits"

TEST_START_DATE = "2026-01-01"
VAL_START_DATE = "2025-09-01"


class DataLeakageError(RuntimeError):
    """Raised when training or tuning code attempts to access or ingest held-out test data."""


def load_split(
    persona: Literal["persona_a", "persona_b"] | str,
    split: Literal["train", "val", "test"] | str,
    *,
    authorize_eval: bool = False,
) -> pd.DataFrame:
    """Load a specific split for a persona.

    Access to the 'test' split requires explicit authorization (authorize_eval=True),
    intended only for the final evaluation harness on untouched test periods.
    """
    clean_split = split.lower().strip()
    clean_persona = persona.lower().strip()

    if clean_split == "test" and not authorize_eval:
        raise DataLeakageError(
            f"Data leakage detected! Attempted to read held-out test split for {clean_persona} "
            f"without explicit evaluation authorization (authorize_eval=True). "
            f"Test data (Months 25-36) is strictly forbidden during training or tuning."
        )

    split_file = SPLITS_DIR / f"{clean_persona}_{clean_split}.csv"
    if not split_file.exists():
        # Fallback to generating on demand if splits dir missing
        from src.data_generators import generate_all_splits
        generate_all_splits()

    df = pd.read_csv(split_file)
    df["date"] = pd.to_datetime(df["date"])
    return df


def load_training_window(persona: str = "persona_a") -> pd.DataFrame:
    """Load Months 1 to 20 (Train split) for the given persona."""
    df = load_split(persona, "train")
    assert_no_test_leakage(df, context=f"{persona} training window")
    return df


def load_validation_window(persona: str = "persona_a") -> pd.DataFrame:
    """Load Months 21 to 24 (Validation split for model selection & interval calibration)."""
    df = load_split(persona, "val")
    assert_no_test_leakage(df, context=f"{persona} validation window")
    return df


def load_tuning_window(persona: str = "persona_a") -> pd.DataFrame:
    """Load combined Train + Validation window (Months 1 to 24) for final model fit before test."""
    train_df = load_training_window(persona)
    val_df = load_validation_window(persona)
    combined = pd.concat([train_df, val_df], ignore_index=True)
    combined = combined.sort_values("date").reset_index(drop=True)
    assert_no_test_leakage(combined, context=f"{persona} combined tuning window")
    return combined


def load_test_window(persona: str = "persona_a", *, authorize_eval: bool = False) -> pd.DataFrame:
    """Load held-out Months 25 to 36 for evaluation only."""
    return load_split(persona, "test", authorize_eval=authorize_eval)


def assert_no_test_leakage(df: pd.DataFrame, context: str = "Dataset") -> None:
    """Verify that a DataFrame contains zero observations from the held-out test window."""
    if df.empty or "date" not in df.columns:
        return

    dates = pd.to_datetime(df["date"])
    test_threshold = pd.to_datetime(TEST_START_DATE)
    leaked_mask = dates >= test_threshold

    if leaked_mask.any():
        num_leaked = int(leaked_mask.sum())
        earliest_leaked = dates[leaked_mask].min().strftime("%Y-%m-%d")
        raise DataLeakageError(
            f"CRITICAL DATA LEAKAGE: {context} contains {num_leaked} observations from the "
            f"held-out test period (earliest: {earliest_leaked}, threshold: {TEST_START_DATE}). "
            f"Training or calibration on held-out test periods is strictly prohibited."
        )
