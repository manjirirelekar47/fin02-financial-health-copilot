"""engine/stopwatch.py — Repeatable engine speed and telemetry harness.

Benchmarks:
1. Ingestion & Analysis latency
2. Decision simulation latency
3. New transaction -> drift alert latency
4. New transaction -> updated recommendation (replan) latency
5. Total end-to-end pipeline latency

Run with:
    python -m engine.stopwatch
"""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path
from time import perf_counter
from typing import Any
import pandas as pd

from contracts.schemas import BufferQuantiles, LockedPath
from .real_engine import RealEngine


def run(path: str | Path | None = None) -> dict[str, float]:
    path = Path(
        path
        or Path(__file__).parents[1]
        / "data"
        / "persona_a_transactions.csv"
    )

    rows = pd.read_csv(path).to_dict(orient="records")
    engine = RealEngine()

    # 1. Ingestion
    t0 = perf_counter()
    ingested = engine.ingest(rows)
    data = ingested["accepted"]
    ingest_seconds = perf_counter() - t0

    # 2. Analysis
    t0 = perf_counter()
    analysis = engine.analyze(data)
    analyze_seconds = perf_counter() - t0

    # 3. Decision simulation
    t0 = perf_counter()
    engine.simulate(
        data,
        {"kind": "medical", "params": {"amount": 25_000}},
    )
    simulate_seconds = perf_counter() - t0

    # 4. Locked Path & New transaction injection -> Drift Alert
    locked = LockedPath(
        id="lock_stopwatch_1",
        goal="Emergency Buffer",
        deadline=date(2027, 3, 1),
        required_balance=75000.0,
        band=BufferQuantiles(p10=65000.0, p50=75000.0, p90=90000.0),
        reserve=45000.0,
        max_risk=0.15,
    )

    new_txn = {
        "id": "live_shock_001",
        "date": "2027-01-15",
        "narration": "APOLLO HOSPITAL EMERGENCY",
        "amount": 28000.0,
        "type": "debit",
        "category": "health",
        "account_type": "savings",
    }

    t0 = perf_counter()
    refresh_result = engine.refresh(data, new_txn, locks=[locked])
    drift_alert_seconds = perf_counter() - t0

    # 5. New transaction -> Updated Recommendation (Replan)
    t0 = perf_counter()
    replan_result = engine.replan(
        data,
        plan=locked,
        change={
            "trigger": "new_expense",
            "amount": 28000.0,
            "category": "health",
            "week": 2,
            "reserve": 45000.0,
            "goal": 75000.0,
        },
    )
    replan_seconds = perf_counter() - t0

    total_pipeline_seconds = drift_alert_seconds + replan_seconds

    metrics = {
        "ingest_seconds": round(ingest_seconds, 4),
        "analyze_seconds": round(analyze_seconds, 4),
        "simulate_seconds": round(simulate_seconds, 4),
        "new_txn_to_drift_seconds": round(drift_alert_seconds, 4),
        "new_txn_to_replan_seconds": round(replan_seconds, 4),
        "total_new_txn_to_recommendation_seconds": round(total_pipeline_seconds, 4),
    }
    return metrics


if __name__ == "__main__":
    res = run()
    print("=" * 65)
    print("SPENDSHIELD STOPWATCH HARNESS — EXECUTION TELEMETRY")
    print("=" * 65)
    for k, v in res.items():
        print(f"{k:<45}: {v:.4f}s ({v*1000:.1f}ms)")
    print("=" * 65)
