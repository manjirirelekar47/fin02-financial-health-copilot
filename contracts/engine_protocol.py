"""One-way protocol implemented by the engine and consumed by the product layer."""

from __future__ import annotations

from typing import Any, Mapping, Protocol, Sequence, runtime_checkable

from .schemas import LockedPath, Plan, Scenario, Sequence as PlanSequence


@runtime_checkable
class EngineProtocol(Protocol):
    def ingest(
        self,
        rows: Sequence[Mapping[str, Any]],
        source: str = "upload",
    ) -> dict[str, Any]: ...

    def analyze(self, user_data: Any) -> dict[str, Any]: ...

    def forecast(
        self,
        user_data: Any,
        horizon_days: int = 90,
    ) -> dict[str, Any]: ...

    def simulate(
        self,
        user_data: Any,
        scenario: Scenario | Mapping[str, Any],
    ) -> dict[str, Any]: ...

    def compare_paths(
        self,
        user_data: Any,
        scenarios: Sequence[Scenario | Mapping[str, Any]],
        priority: str = "safest",
    ) -> dict[str, Any]: ...

    def shock_capacity(
        self,
        user_data: Any,
        limit: float = 0.10,
    ) -> dict[str, Any]: ...

    def optimize(
        self,
        user_data: Any,
        target_risk: float = 0.10,
    ) -> dict[str, Any]: ...

    def evaluate_lock(
        self,
        user_data: Any,
        locked_path: LockedPath | Mapping[str, Any],
    ) -> dict[str, Any]: ...

    def refresh(
        self,
        user_data: Any,
        new_txn: Mapping[str, Any],
        locks: Sequence[LockedPath | Mapping[str, Any]],
    ) -> dict[str, Any]: ...

    # --- Addition 1 & 2 Engine Methods ---
    def plan(
        self,
        user_data: Any,
        sequences: Sequence[PlanSequence | Mapping[str, Any]] = (),
        reserve: float = 0.0,
        goal: float = 0.0,
        view: str = "weekly",
    ) -> dict[str, Any]: ...

    def replan(
        self,
        user_data: Any,
        plan: Plan | Mapping[str, Any],
        change: Mapping[str, Any],
    ) -> dict[str, Any]: ...

    def forecast_report(
        self,
        user_data: Any,
        horizon_weeks: int = 8,
        view: str = "weekly",
    ) -> dict[str, Any]: ...
