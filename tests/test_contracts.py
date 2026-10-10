"""Contract tests verifying Pydantic v2 schemas, fixtures, and engine protocol conformance."""

from __future__ import annotations

import json
from pathlib import Path
import pytest

from api.mock_engine import MockEngine
from contracts.engine_protocol import EngineProtocol
from contracts.schemas import (
    ConflictReport,
    DriftResult,
    ForecastReport,
    LockedPath,
    PeriodRow,
    Plan,
    PlanAction,
    RecurringPayment,
    RelaxationOption,
    Scenario,
    Sequence,
    SequenceSummary,
    SimulationResult,
    SixMonthSummary,
    Transaction,
)

FIXTURES_DIR = Path(__file__).parents[1] / "fixtures"


def test_mock_engine_satisfies_engine_protocol():
    """Verify MockEngine structurally implements EngineProtocol."""
    engine = MockEngine()
    assert isinstance(engine, EngineProtocol)


def test_plan_two_sequences_fixture():
    """Verify fixtures/plan.two_sequences.json conforms to the Plan schema."""
    path = FIXTURES_DIR / "plan.two_sequences.json"
    assert path.exists(), "plan.two_sequences.json fixture missing"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    plan = Plan.model_validate(data)
    assert plan.status == "ok"
    assert plan.reserve == 45000.0
    assert plan.goal == 75000.0
    assert len(plan.sequences) >= 2
    assert plan.recommended_sequence_id != ""

    for seq in plan.sequences:
        assert isinstance(seq, Sequence)
        assert len(seq.periods) == 8
        for p in seq.periods:
            assert isinstance(p, PeriodRow)
            assert p.week in range(1, 9)
            assert p.closing_p10 <= p.closing_p50 <= p.closing_p90
            assert 0.0 <= p.reserve_breach_prob <= 1.0


def test_plan_infeasible_fixture():
    """Verify fixtures/plan.infeasible.json conforms to the Plan schema with ConflictReport."""
    path = FIXTURES_DIR / "plan.infeasible.json"
    assert path.exists(), "plan.infeasible.json fixture missing"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    plan = Plan.model_validate(data)
    assert plan.status == "infeasible"
    assert plan.conflict is not None
    assert isinstance(plan.conflict, ConflictReport)
    assert len(plan.conflict.constraints) > 0
    assert len(plan.conflict.relaxations) >= 2
    for rel in plan.conflict.relaxations:
        assert isinstance(rel, RelaxationOption)
        assert 0.0 <= rel.resulting_risk <= 1.0


def test_forecast_report_fixture():
    """Verify fixtures/forecast_report.json conforms to the ForecastReport schema."""
    path = FIXTURES_DIR / "forecast_report.json"
    assert path.exists(), "forecast_report.json fixture missing"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    report = ForecastReport.model_validate(data)
    assert report.nominal_level == 0.80
    assert len(report.income_stream.p50) == 8
    assert len(report.expense_stream.p50) == 8
    assert len(report.baselines) >= 4
    baseline_names = [b.name for b in report.baselines]
    assert any("Historical" in name for name in baseline_names)
    assert any("Recurring" in name for name in baseline_names)
    assert any("Moving Average" in name for name in baseline_names)
    assert any("Linear Regression" in name for name in baseline_names)

    assert len(report.per_horizon) >= 3
    for b in report.per_horizon:
        assert b.grade in ("Decision-grade", "Planning-grade", "Indicative")


def test_mock_engine_contract_methods():
    """Verify MockEngine outputs valid contract models for plan, replan, and forecast_report."""
    engine = MockEngine()
    user_data = {"session_id": "demo", "transactions": []}

    plan_res = engine.plan(user_data, reserve=45000.0, goal=75000.0)
    plan_obj = Plan.model_validate(plan_res)
    assert plan_obj.status == "ok"

    infeasible_res = engine.plan(user_data, reserve=50000.0, goal=300000.0)
    infeasible_obj = Plan.model_validate(infeasible_res)
    assert infeasible_obj.status == "infeasible"
    assert infeasible_obj.conflict is not None

    forecast_res = engine.forecast_report(user_data, horizon_weeks=8)
    forecast_obj = ForecastReport.model_validate(forecast_res)
    assert forecast_obj.horizon_weeks == 8


def test_locked_path_and_simulation_result_additions():
    """Verify reserve on LockedPath and reserve_breach_prob on SimulationResult."""
    locked = LockedPath(
        id="lp_test",
        goal="Save 50k",
        deadline="2026-12-31",
        required_balance=50000.0,
        band={"p10": 45000, "p50": 52000, "p90": 60000},
        reserve=40000.0,
    )
    assert locked.reserve == 40000.0

    sim = SimulationResult(
        status="ok",
        shortfall_prob=0.08,
        reserve_breach_prob=0.05,
        buffer={"p10": 42000, "p50": 48000, "p90": 55000},
        runway_days=90,
    )
    assert sim.reserve_breach_prob == 0.05


def test_six_month_summary_model():
    """Verify SixMonthSummary schema validates and enforces constraints."""
    summary = SixMonthSummary(
        closing_p10=45000.0,
        closing_p50=52000.0,
        closing_p90=60000.0,
        lowest_p10_balance=41000.0,
        lowest_p10_week=3,
        reserve_breach_prob=0.06,
        cumulative_saving=35000.0,
        debt_cleared=24000.0,
        goal_met=True,
        grade="Planning-grade",
    )
    assert summary.lowest_p10_week == 3
    assert summary.grade == "Planning-grade"
