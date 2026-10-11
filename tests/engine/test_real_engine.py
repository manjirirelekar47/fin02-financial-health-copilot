from __future__ import annotations

from datetime import date
from pathlib import Path

import pandas as pd
import pytest

from contracts.schemas import DriftResult, LockedPath, SimulationResult, Transaction
from engine import RealEngine
from engine.real_engine import _category


ROOT = Path(__file__).parents[2]


@pytest.fixture()
def engine() -> RealEngine:
    return RealEngine()


@pytest.fixture()
def persona_b() -> list[dict]:
    return pd.read_csv(
        ROOT / "data" / "persona_b_transactions.csv"
    ).to_dict(orient="records")


@pytest.mark.parametrize(
    ("narration", "expected_category", "review"),
    [
        ("AMAZON RETAIL", "shopping", False),
        ("NETFLIX.COM", "subscriptions", False),
        ("HDFC HOME LOAN EMI", "debt_payment", False),
        ("UBER TRIP", "transport", False),
        ("ZOMATO ONLINE", "food_delivery", False),
        ("MSEB ELECTRICITY", "utilities", False),
        ("BIGBASKET ORDER", "groceries", False),
        ("APOLLO PHARMACY", "health", False),
        ("IRCTC BOOKING", "travel", False),
        ("PVR CINEMAS", "entertainment", False),
        ("UPI-UNKNOWN-MCHNT-99812", "uncategorised", True),
        ("POS TXN 11112222", "uncategorised", True),
        ("TRANSFER TO VISHAL", "uncategorised", True),
        ("NEFT INDIVIDUAL", "uncategorised", True),
        ("RARE ANTIQUE SHOP", "uncategorised", True),
    ],
)
def test_rule_categoriser_labelled_scenarios(
    narration: str,
    expected_category: str,
    review: bool,
):
    category, confidence = _category(narration)

    assert category == expected_category
    assert (confidence < 0.60) is review


def test_ingest_lists_bad_rows_and_marks_duplicates(
    engine: RealEngine,
):
    result = engine.ingest(
        [
            {
                "id": "1",
                "date": "2026-01-01",
                "narration": "Salary",
                "amount": 100,
                "type": "credit",
            },
            {
                "id": "2",
                "date": "bad-date",
                "narration": "Broken",
                "amount": 100,
                "type": "debit",
            },
            {
                "id": "3",
                "date": "2026-01-01",
                "narration": "Salary",
                "amount": 100,
                "type": "credit",
            },
            {
                "id": "4",
                "date": "2026-01-02",
                "narration": "Bad amount",
                "amount": -1,
                "type": "debit",
            },
        ]
    )

    assert result["accepted_count"] == 2
    assert result["rejected_count"] == 2
    assert result["accepted"][1]["is_duplicate"] is True

    for row in result["accepted"]:
        Transaction.model_validate(row)


def test_thin_data_is_a_status_not_an_exception(
    engine: RealEngine,
):
    result = engine.analyze(
        [
            {
                "date": "2026-01-01",
                "narration": "Salary",
                "amount": 100,
                "type": "credit",
            },
            {
                "date": "2026-01-15",
                "narration": "Rent",
                "amount": 50,
                "type": "debit",
            },
        ]
    )

    assert result == {
        "status": "insufficient_data",
        "min_days": 60,
        "history_days": 15,
    }


def test_public_engine_contract(
    engine: RealEngine,
    persona_b: list[dict],
):
    ingested = engine.ingest(persona_b, source="persona_b")
    data = ingested["accepted"]

    assert engine.analyze(data)["status"] == "ok"
    assert engine.forecast(data, horizon_days=14)["status"] == "ok"

    scenario = {
        "kind": "medical",
        "params": {"amount": 10_000},
        "horizon_days": 90,
        "seed": 42,
    }

    first = engine.simulate(data, scenario)
    second = engine.simulate(data, scenario)

    assert first == second
    SimulationResult.model_validate(first)

    assert engine.compare_paths(
        data,
        [{"kind": "do_nothing"}, scenario],
    )["status"] == "ok"

    assert engine.shock_capacity(data)["status"] == "ok"

    optimized = engine.optimize(data)
    assert optimized["status"] == "ok"
    assert (
        optimized["flexibility_weights"]["Low"]
        < optimized["flexibility_weights"]["High"]
    )

    locked = LockedPath(
        id="lp_1",
        goal="Save 60000",
        deadline=date(2027, 1, 1),
        required_balance=60_000,
        band={"p10": 52_000, "p50": 61_000, "p90": 68_000},
        category_ceilings={"food_delivery": 3_000},
    )

    drift = engine.evaluate_lock(data, locked)
    DriftResult.model_validate(drift)

    refreshed = engine.refresh(
        data,
        {
            "date": "2026-03-20",
            "narration": "Zomato",
            "amount": 420,
            "type": "debit",
        },
        [locked],
    )

    assert refreshed["status"] == "ok"
    assert refreshed["transaction"]["category"] == "food_delivery"
