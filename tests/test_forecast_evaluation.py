"""test_forecast_evaluation.py — Tests for Stage 4 Probabilistic Forecasting & 4-Baseline Evaluation."""

from __future__ import annotations

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api.main import app
from contracts.schemas import ForecastReport
from src.data_splits import (
    assert_no_test_leakage,
    load_test_window,
    load_training_window,
    load_tuning_window,
    load_validation_window,
)
from src.probabilistic_forecast import (
    aggregate_streams,
    calibrate_residual_quantiles,
    evaluate_baselines_on_test,
    generate_forecast_report,
    select_best_model_on_validation,
)


@pytest.fixture()
def client():
    return TestClient(app)


def test_stream_aggregation_preserves_cashflow_totals():
    """Verify weekly aggregation properly preserves raw income and debit totals."""
    train_df = load_training_window("persona_a")
    weekly_agg = aggregate_streams(train_df, freq="W")

    assert not weekly_agg.empty
    assert "income" in weekly_agg.columns
    assert "expenses" in weekly_agg.columns
    assert "net_cashflow" in weekly_agg.columns

    # Sum of streams should closely match raw totals
    raw_credit_sum = float(train_df.loc[train_df["type"] == "credit", "amount"].sum())
    agg_credit_sum = float(weekly_agg["income"].sum())
    assert abs(raw_credit_sum - agg_credit_sum) < 1.0


def test_model_selection_operates_strictly_on_validation_window():
    """Verify select_best_model_on_validation tunes solely on train/validation slices with zero leakage."""
    train_df = load_training_window("persona_a")
    val_df = load_validation_window("persona_a")

    # Verify no test leakage before selection
    assert_no_test_leakage(train_df)
    assert_no_test_leakage(val_df)

    train_agg = aggregate_streams(train_df, freq="W")
    val_agg = aggregate_streams(val_df, freq="W")

    best_model, val_mae = select_best_model_on_validation(train_agg["expenses"], val_agg["expenses"])
    assert best_model in ("Moving Average", "Linear Regression")
    assert val_mae > 0.0


@pytest.mark.parametrize("persona", ["persona_a", "persona_b"])
def test_four_baselines_evaluated_on_test_window(persona: str):
    """Verify all 4 required baselines are evaluated on untouched test window."""
    train_val = load_tuning_window(persona)
    test_df = load_test_window(persona, authorize_eval=True)

    baselines, per_horizon, method_card = evaluate_baselines_on_test(
        train_val, test_df, stream="expenses", horizon_weeks=8
    )

    assert len(baselines) == 4
    baseline_names = [b.name for b in baselines]
    assert any("Historical Average" in name for name in baseline_names)
    assert any("Recurring-Payment-Only" in name for name in baseline_names)
    assert any("Moving Average" in name for name in baseline_names)
    assert any("Linear Regression" in name for name in baseline_names)

    for b in baselines:
        assert b.mae > 0.0, f"MAE must be positive for {b.name}"
        assert b.mase > 0.0, f"MASE must be positive for {b.name}"
        assert 0.0 <= b.coverage <= 1.0, f"Coverage out of bounds for {b.name}"
        assert b.mean_width > 0.0, f"Interval width must be positive for {b.name}"

    assert len(per_horizon) == 3
    assert per_horizon[0].grade == "Decision-grade"
    assert per_horizon[1].grade == "Planning-grade"
    assert per_horizon[2].grade == "Indicative"
    assert "Declared Method" in method_card


def test_forecast_report_contract_generation():
    """Verify generate_forecast_report produces a fully schema-valid ForecastReport."""
    train_df = load_training_window("persona_a")
    report_dict = generate_forecast_report(train_df, horizon_weeks=8, persona="persona_a")

    report = ForecastReport.model_validate(report_dict)
    assert report.horizon_weeks == 8
    assert report.nominal_level == 0.80
    assert len(report.income_stream.p50) == 8
    assert len(report.expense_stream.p50) == 8
    assert len(report.baselines) == 4
    assert len(report.per_horizon) == 3


def test_api_get_forecast_report_endpoint(client: TestClient):
    """Verify GET /api/forecast-report endpoint returns 200 with schema conformance."""
    resp = client.get("/api/forecast-report?session_id=demo&horizon_weeks=8")
    assert resp.status_code == 200
    data = resp.json()

    # Validate with contract schema
    report = ForecastReport.model_validate(data)
    assert report.horizon_weeks == 8
    assert len(report.income_stream.p50) == 8
    assert len(report.expense_stream.p50) == 8
