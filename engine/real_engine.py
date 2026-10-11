"""The Part A stateless financial-health engine."""

from __future__ import annotations

from datetime import timedelta
import hashlib
import math
from typing import Any, Mapping, Sequence

import numpy as np
import pandas as pd

from contracts.schemas import (
    LockedPath,
    RecurringPayment,
    Scenario,
    SimulationResult,
    Transaction,
)
from src.recurring_detector import detect_recurring_payments


MIN_HISTORY_DAYS = 60
PATHS = 1_000

_CATEGORY_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("income", ("SALARY", "PAYROLL", "STIPEND", "FREELANCE", "UPWORK")),
    ("housing", ("RENT", "LANDLORD", "HOUSING SOCIETY")),
    ("debt_payment", ("EMI", "LOAN", "CREDIT CARD BILL")),
    ("subscriptions", ("NETFLIX", "SPOTIFY", "PRIME", "HOTSTAR", "GYM", "CULT.FIT")),
    ("utilities", ("ELECTRICITY", "MSEB", "BROADBAND", "AIRTEL", "JIO", "WATER", "GAS")),
    ("food_delivery", ("SWIGGY", "ZOMATO", "RESTAURANT", "CAFE", "DOMINOS", "MCDONALD")),
    ("groceries", ("BIGBASKET", "GROFERS", "BLINKIT", "DMART", "GROCERY")),
    ("shopping", ("AMAZON", "MYNTRA", "FLIPKART", "AJIO", "H&M")),
    ("entertainment", ("PVR", "CINEMA", "BOOKMYSHOW", "INOX")),
    ("transport", ("UBER", "OLA", "RAPIDO", "PETROL", "FUEL", "METRO")),
    ("travel", ("MAKEMYTRIP", "IRCTC", "AIRLINE", "GOIBIBO", "YATRA")),
    ("health", ("PHARMACY", "APOLLO", "HOSPITAL", "CLINIC", "DIAGNOSTIC")),
)

_PRIORITIES = {
    "debt_payment": "Critical",
    "housing": "High",
    "utilities": "High",
    "health": "High",
    "groceries": "Medium",
    "transport": "Medium",
    "subscriptions": "Low",
    "food_delivery": "Low",
    "shopping": "Low",
    "entertainment": "Low",
    "travel": "Low",
    "uncategorised": "Medium",
}


def _category(narration: str) -> tuple[str, float]:
    text = narration.upper()
    for category, terms in _CATEGORY_RULES:
        if any(term in text for term in terms):
            return category, 0.95
    return "uncategorised", 0.0


def _jsonable(value: Any) -> Any:
    if isinstance(value, (np.floating, np.integer)):
        return value.item()
    if isinstance(value, pd.Timestamp):
        return value.date().isoformat()
    return value


class RealEngine:
    """Production engine implementation with deterministic stochastic methods."""

    _optimizer_cache: dict[tuple[str, float], dict[str, Any]] = {}

    def ingest(
        self,
        rows: Sequence[Mapping[str, Any]],
        source: str = "upload",
    ) -> dict[str, Any]:
        accepted: list[dict[str, Any]] = []
        rejected: list[dict[str, Any]] = []
        seen: set[tuple[str, str, float, str]] = set()

        for index, raw in enumerate(rows):
            raw = dict(raw)
            try:
                narration = str(
                    raw.get("narration", raw.get("merchant", raw.get("description", "")))
                ).strip()
                tx_date = pd.to_datetime(raw.get("date"), errors="raise").date()
                amount = float(raw.get("amount"))
                tx_type = str(
                    raw.get("type", raw.get("transaction_type", ""))
                ).strip().lower()

                if not narration:
                    raise ValueError("missing narration")
                if not math.isfinite(amount) or amount <= 0:
                    raise ValueError("amount must be a positive finite number")
                if tx_type not in {"debit", "credit"}:
                    raise ValueError("type must be 'debit' or 'credit'")
            except (TypeError, ValueError, OverflowError) as exc:
                rejected.append({"row": index, "reason": str(exc), "data": raw})
                continue

            category = str(raw.get("category") or "").strip().lower()
            confidence = raw.get("category_confidence")

            if not category:
                category, confidence = _category(narration)

            confidence = float(confidence if confidence is not None else 0.0)
            key = (tx_date.isoformat(), narration.upper(), round(amount, 2), tx_type)
            duplicate = key in seen
            seen.add(key)

            tx_id = str(raw.get("id") or f"{source}_{index + 1:04d}")

            transaction = Transaction(
                id=tx_id,
                date=tx_date,
                narration=narration,
                amount=round(amount, 2),
                type=tx_type,
                category=category,
                category_confidence=max(0, min(1, confidence)),
                priority=_PRIORITIES.get(category, "Medium"),
                balance=raw.get("balance"),
                is_duplicate=duplicate,
            )
            accepted.append(transaction.model_dump(mode="json"))

        accepted.sort(key=lambda row: (row["date"], row["id"]))

        return {
            "status": "ok",
            "source": source,
            "accepted": accepted,
            "rejected": rejected,
            "preview": accepted[:10],
            "accepted_count": len(accepted),
            "rejected_count": len(rejected),
            "duplicate_count": sum(row["is_duplicate"] for row in accepted),
        }

    def _transactions(self, user_data: Any) -> list[dict[str, Any]]:
        if isinstance(user_data, Mapping):
            rows = user_data.get("transactions", user_data.get("accepted", []))
        else:
            rows = user_data

        if isinstance(rows, pd.DataFrame):
            rows = rows.to_dict(orient="records")

        if not isinstance(rows, Sequence) or isinstance(rows, (str, bytes)):
            raise TypeError(
                "user_data must be transaction rows or {'transactions': rows}"
            )

        return self.ingest(rows, source="data")["accepted"]

    @staticmethod
    def _history_days(transactions: Sequence[Mapping[str, Any]]) -> int:
        if not transactions:
            return 0

        dates = pd.to_datetime([tx["date"] for tx in transactions])
        return int((dates.max() - dates.min()).days) + 1

    def _frame(self, transactions: Sequence[Mapping[str, Any]]) -> pd.DataFrame:
        frame = pd.DataFrame(transactions)

        if frame.empty:
            return frame

        frame["date"] = pd.to_datetime(frame["date"])
        frame["amount"] = pd.to_numeric(frame["amount"])
        frame["is_duplicate"] = frame["is_duplicate"].astype(bool)

        return frame.sort_values("date").reset_index(drop=True)

    @staticmethod
    def _insufficient(history_days: int) -> dict[str, Any]:
        return {
            "status": "insufficient_data",
            "min_days": MIN_HISTORY_DAYS,
            "history_days": history_days,
        }

    def _recurring(self, frame: pd.DataFrame) -> list[dict[str, Any]]:
        if frame.empty:
            return []

        detector_frame = frame.rename(columns={"narration": "merchant"})
        recurring = detect_recurring_payments(detector_frame)

        if recurring.empty:
            return []

        items: list[dict[str, Any]] = []

        for _, item in recurring.iterrows():
            merchant = item["merchant"]
            evidence = frame[
                (frame["narration"] == merchant) & (frame["type"] == "debit")
            ]["id"].tolist()

            data = {key: _jsonable(value) for key, value in item.to_dict().items()}
            data["evidence"] = evidence[-3:]
            data["tag"] = "observed"

            items.append(
                RecurringPayment.model_validate(data).model_dump(mode="json")
            )

        return items

    def _health(self, frame: pd.DataFrame) -> dict[str, Any]:
        clean = frame[~frame["is_duplicate"]].copy()

        income = float(clean.loc[clean["type"] == "credit", "amount"].sum())
        expenses = float(clean.loc[clean["type"] == "debit", "amount"].sum())
        debt = float(
            clean.loc[
                (clean["type"] == "debit")
                & (clean["category"] == "debt_payment"),
                "amount",
            ].sum()
        )

        history_days = max(
            self._history_days(clean.to_dict(orient="records")),
            1,
        )
        monthly_factor = 30 / history_days

        monthly_income = income * monthly_factor
        monthly_expenses = expenses * monthly_factor
        monthly_debt = debt * monthly_factor

        balance_series = clean["balance"].dropna()
        balance = (
            float(balance_series.iloc[-1])
            if not balance_series.empty
            else income - expenses
        )

        return {
            "income": round(monthly_income, 2),
            "expenses": round(monthly_expenses, 2),
            "debt_payments": round(monthly_debt, 2),
            "dti": round(monthly_debt / monthly_income, 4)
            if monthly_income
            else None,
            "savings_rate": round(
                (monthly_income - monthly_expenses) / monthly_income,
                4,
            )
            if monthly_income
            else None,
            "buffer_months": round(
                max(balance, 0) / monthly_expenses,
                2,
            )
            if monthly_expenses
            else None,
            "runway_days": int(
                max(balance, 0) / (monthly_expenses / 30)
            )
            if monthly_expenses
            else None,
            "current_balance": round(balance, 2),
        }

    def analyze(self, user_data: Any) -> dict[str, Any]:
        transactions = self._transactions(user_data)
        history_days = self._history_days(transactions)

        if history_days < MIN_HISTORY_DAYS:
            return self._insufficient(history_days)

        frame = self._frame(transactions)
        health = self._health(frame)
        recurring = self._recurring(frame)
        alerts: list[dict[str, Any]] = []

        for item in recurring:
            increase = max(
                0.0,
                float(item["last_amount"]) - float(item["first_amount"]),
            )

            if increase > 0:
                severity = "high" if increase >= 1_000 else "medium"
                alerts.append(
                    {
                        "id": f"silent_creep_{len(alerts) + 1}",
                        "mode": "silent_creep",
                        "title": f"{item['merchant']} costs more than when it started",
                        "extra_per_month": round(increase, 2),
                        "extra_per_year": round(increase * 12, 2),
                        "severity": severity,
                        "evidence": item["evidence"],
                        "tag": "observed",
                    }
                )

        debt_dates = frame[
            (frame["type"] == "debit")
            & (frame["category"] == "debt_payment")
        ][["date", "id"]]

        loan_credits = frame[
            (frame["type"] == "credit")
            & frame["narration"].str.contains(
                "LOAN|CREDIT",
                case=False,
                regex=True,
            )
        ]

        rollover_evidence: list[str] = []

        for _, credit in loan_credits.iterrows():
            near = debt_dates[
                (debt_dates["date"] >= credit["date"])
                & (debt_dates["date"] <= credit["date"] + timedelta(days=5))
            ]

            if not near.empty:
                rollover_evidence = [credit["id"], *near["id"].tolist()]
                break

        if rollover_evidence:
            alerts.append(
                {
                    "id": "rollover_1",
                    "mode": "rollover",
                    "title": "Possible borrowing rollover",
                    "extra_per_month": 0.0,
                    "extra_per_year": 0.0,
                    "severity": "high",
                    "evidence": rollover_evidence,
                    "tag": "observed",
                }
            )

        debit = frame[
            (frame["type"] == "debit") & ~frame["is_duplicate"]
        ]

        priority_list = []

        for category, group in debit.groupby("category", dropna=False):
            priority_list.append(
                {
                    "category": category,
                    "amount": round(float(group["amount"].sum()), 2),
                    "priority": _PRIORITIES.get(category, "Medium"),
                    "evidence": group["id"].tolist(),
                    "tag": "observed",
                }
            )

        rank = {
            "Critical": 0,
            "High": 1,
            "Medium": 2,
            "Low": 3,
        }

        priority_list.sort(
            key=lambda item: (rank[item["priority"]], -item["amount"])
        )

        payment_order = [
            {
                "category": item["category"],
                "priority": item["priority"],
                "amount": item["amount"],
                "evidence": item["evidence"],
            }
            for item in priority_list
        ]

        return {
            "status": "ok",
            "history_days": history_days,
            "ratios": health,
            "recurring": recurring,
            "alerts": alerts,
            "priority_list": priority_list,
            "payment_order": payment_order,
        }

    def _daily_cashflows(
        self,
        frame: pd.DataFrame,
    ) -> tuple[np.ndarray, float, list[str]]:
        signed = np.where(
            frame["type"] == "credit",
            frame["amount"],
            -frame["amount"],
        )

        work = (
            frame.assign(signed_amount=signed)
            .groupby("date")["signed_amount"]
            .sum()
            .sort_index()
        )

        dates = pd.date_range(work.index.min(), work.index.max(), freq="D")
        daily = work.reindex(dates, fill_value=0.0).to_numpy(dtype=float)

        balances = frame["balance"].dropna()
        initial_balance = (
            float(balances.iloc[-1])
            if not balances.empty
            else float(signed.sum())
        )

        return daily, initial_balance, frame["id"].tolist()

    @staticmethod
    def _block_paths(
        daily: np.ndarray,
        horizon: int,
        seed: int,
    ) -> np.ndarray:
        rng = np.random.default_rng(seed)

        if len(daily) == 0:
            daily = np.zeros(7)

        blocks = [
            daily[index:index + 7]
            for index in range(max(1, len(daily) - 6))
        ]

        paths = np.empty((PATHS, horizon), dtype=float)

        for index in range(PATHS):
            selection = rng.integers(
                0,
                len(blocks),
                size=math.ceil(horizon / 7),
            )
            paths[index] = np.concatenate(
                [blocks[item] for item in selection]
            )[:horizon]

        return paths

    def forecast(
        self,
        user_data: Any,
        horizon_days: int = 90,
    ) -> dict[str, Any]:
        transactions = self._transactions(user_data)
        history_days = self._history_days(transactions)

        if history_days < MIN_HISTORY_DAYS:
            return self._insufficient(history_days)

        frame = self._frame(transactions)
        daily, balance, _ = self._daily_cashflows(frame)
        paths = self._block_paths(daily, horizon_days, seed=42)
        cumulative = balance + np.cumsum(paths, axis=1)
        start = frame["date"].max() + timedelta(days=1)

        series = []

        for day in range(horizon_days):
            p10, p50, p90 = np.percentile(
                cumulative[:, day],
                [10, 50, 90],
            )

            series.append(
                {
                    "date": (start + timedelta(days=day)).date().isoformat(),
                    "p10": round(float(p10), 2),
                    "p50": round(float(p50), 2),
                    "p90": round(float(p90), 2),
                    "tag": "predicted",
                }
            )

        return {
            "status": "ok",
            "horizon_days": horizon_days,
            "series": series,
        }

    def forecast_report(
        self,
        user_data: Any,
        horizon_weeks: int = 8,
        view: str = "weekly",
    ) -> dict[str, Any]:
        transactions = self._transactions(user_data)
        history_days = self._history_days(transactions)

        if history_days < MIN_HISTORY_DAYS:
            return self._insufficient(history_days)

        frame = self._frame(transactions)
        from src.probabilistic_forecast import generate_forecast_report
        session_id = user_data.get("session_id", "demo") if isinstance(user_data, dict) else "demo"
        persona = "persona_b" if "persona_b" in str(session_id).lower() else "persona_a"
        report = generate_forecast_report(frame, horizon_weeks=horizon_weeks, view=view, persona=persona)
        report["status"] = "ok"
        return report

    def simulate(
        self,
        user_data: Any,
        scenario: Scenario | Mapping[str, Any],
    ) -> dict[str, Any]:
        scenario = (
            scenario
            if isinstance(scenario, Scenario)
            else Scenario.model_validate(scenario)
        )

        transactions = self._transactions(user_data)
        history_days = self._history_days(transactions)

        if history_days < MIN_HISTORY_DAYS:
            return SimulationResult(
                status="insufficient_data",
                shortfall_prob=0,
                buffer={"p10": 0, "p50": 0, "p90": 0},
                runway_days=0,
                kind=scenario.kind,
            ).model_dump()

        frame = self._frame(transactions)
        daily, balance, evidence = self._daily_cashflows(frame)
        paths = self._block_paths(
            daily,
            scenario.horizon_days,
            scenario.seed,
        )

        health = self._health(frame)
        monthly_income = health["income"] or 0.0
        monthly_debt = health["debt_payments"] or 0.0
        params = scenario.params
        initial_shock = 0.0
        daily_adjustment = 0.0
        added_monthly_debt = 0.0

        if scenario.kind == "cut_spend":
            monthly_saving = params.get("monthly_saving")
            daily_adjustment = (
                float(monthly_saving) / 30
                if monthly_saving is not None
                else abs(min(float(daily.mean()), 0.0))
                * float(params.get("cut_fraction", 0.20))
            )

        elif scenario.kind == "refinance":
            daily_adjustment = (
                monthly_debt
                * float(params.get("saving_fraction", 0.10))
                / 30
            )
            monthly_debt *= 1 - float(
                params.get("saving_fraction", 0.10)
            )

        elif scenario.kind == "new_emi":
            added_monthly_debt = float(params.get("emi", 0.0))
            monthly_debt += added_monthly_debt
            paths[:, ::30] -= added_monthly_debt

        elif scenario.kind in {"purchase", "medical"}:
            initial_shock = float(params.get("amount", 50_000.0))

        elif scenario.kind == "income_drop_30":
            daily_adjustment = -(monthly_income * 0.30 / 30)
            monthly_income *= 0.70

        elif scenario.kind == "job_loss":
            daily_adjustment = -(monthly_income / 30)
            monthly_income = 0.0

        elif scenario.kind == "emi_hike_12":
            added_monthly_debt = monthly_debt * 0.12
            monthly_debt *= 1.12
            paths[:, ::30] -= added_monthly_debt

        cumulative = balance - initial_shock + np.cumsum(
            paths + daily_adjustment,
            axis=1,
        )

        shortfall = np.any(cumulative < 0, axis=1)

        first_negative = np.where(
            shortfall,
            np.argmax(cumulative < 0, axis=1),
            scenario.horizon_days,
        )

        p10, p50, p90 = np.percentile(
            cumulative[:, -1],
            [10, 50, 90],
        )

        result = SimulationResult(
            status="ok",
            shortfall_prob=round(float(shortfall.mean()), 4),
            buffer={
                "p10": round(float(p10), 2),
                "p50": round(float(p50), 2),
                "p90": round(float(p90), 2),
            },
            runway_days=int(np.median(first_negative)),
            new_dti=round(monthly_debt / monthly_income, 4)
            if monthly_income
            else None,
            evidence=evidence[-8:],
            kind=scenario.kind,
        )

        return result.model_dump()

    def compare_paths(
        self,
        user_data: Any,
        scenarios: Sequence[Scenario | Mapping[str, Any]],
        priority: str = "safest",
    ) -> dict[str, Any]:
        results = [
            self.simulate(user_data, scenario)
            for scenario in scenarios
        ]

        if not results or results[0]["status"] == "insufficient_data":
            history = self._history_days(self._transactions(user_data))
            return self._insufficient(history)

        if priority not in {"safest", "cheapest"}:
            raise ValueError("priority must be 'safest' or 'cheapest'")

        if priority == "safest":
            results.sort(
                key=lambda item: (
                    item["shortfall_prob"],
                    -item["buffer"]["p50"],
                )
            )
        else:
            results.sort(
                key=lambda item: (
                    -item["buffer"]["p50"],
                    item["shortfall_prob"],
                )
            )

        return {
            "status": "ok",
            "priority": priority,
            "recommended": results[0]["kind"],
            "results": results,
        }

    def shock_capacity(
        self,
        user_data: Any,
        limit: float = 0.10,
    ) -> dict[str, Any]:
        if not 0 <= limit <= 1:
            raise ValueError("limit must be between 0 and 1")

        transactions = self._transactions(user_data)
        history_days = self._history_days(transactions)

        if history_days < MIN_HISTORY_DAYS:
            return self._insufficient(history_days)

        high = max(
            10_000.0,
            float(self._health(self._frame(transactions))["current_balance"]) * 2,
        )
        low = 0.0

        for _ in range(15):
            candidate = (low + high) / 2

            result = self.simulate(
                transactions,
                {
                    "kind": "medical",
                    "params": {"amount": candidate},
                },
            )

            if result["shortfall_prob"] <= limit:
                low = candidate
            else:
                high = candidate

        return {
            "status": "ok",
            "limit": limit,
            "largest_absorbable_shock": round(low, 2),
            "tag": "predicted",
        }

    def optimize(
        self,
        user_data: Any,
        target_risk: float = 0.10,
    ) -> dict[str, Any]:
        transactions = self._transactions(user_data)
        digest = hashlib.sha256(repr(transactions).encode()).hexdigest()
        key = (digest, float(target_risk))

        if key in self._optimizer_cache:
            return self._optimizer_cache[key]

        history_days = self._history_days(transactions)

        if history_days < MIN_HISTORY_DAYS:
            return self._insufficient(history_days)

        frame = self._frame(transactions)

        monthly_spend = (
            frame[
                (frame["type"] == "debit")
                & ~frame["is_duplicate"]
            ]
            .groupby("category")["amount"]
            .sum()
            .mul(30 / history_days)
            .to_dict()
        )

        priority_penalty = {
            "Low": 1.0,
            "Medium": 3.0,
            "High": 8.0,
            "Critical": 20.0,
        }

        categories = sorted(
            (
                (category, amount, _PRIORITIES.get(category, "Medium"))
                for category, amount in monthly_spend.items()
                if category
                not in {
                    "debt_payment",
                    "housing",
                    "utilities",
                    "health",
                }
            ),
            key=lambda item: priority_penalty[item[2]],
        )

        total_flexible = sum(amount for _, amount, _ in categories)

        def allocate(
            desired_saving: float,
        ) -> tuple[dict[str, float], float, float]:
            remaining = desired_saving
            achieved = 0.0
            disruption = 0.0
            cuts: dict[str, float] = {}

            for category, amount, category_priority in categories:
                saving = min(remaining, amount * 0.30)

                if saving <= 0:
                    continue

                cuts[category] = round(saving / amount, 4)
                achieved += saving
                disruption += (
                    (saving / amount)
                    * priority_penalty[category_priority]
                )
                remaining -= saving

            return cuts, achieved, disruption

        candidates: list[
            tuple[bool, float, float, dict[str, float], dict[str, Any]]
        ] = []

        for fraction in (0.05, 0.10, 0.15, 0.20, 0.25, 0.30):
            cuts, saving, disruption = allocate(
                total_flexible * fraction
            )

            result = self.simulate(
                transactions,
                {
                    "kind": "cut_spend",
                    "params": {"monthly_saving": saving},
                },
            )

            candidates.append(
                (
                    result["shortfall_prob"] <= target_risk,
                    disruption,
                    saving,
                    cuts,
                    result,
                )
            )

        safe = [candidate for candidate in candidates if candidate[0]]

        selected = (
            min(safe, key=lambda item: item[1])
            if safe
            else min(
                candidates,
                key=lambda item: (
                    item[4]["shortfall_prob"],
                    item[1],
                ),
            )
        )

        plan_found, disruption, _, cuts, result = selected

        response = {
            "status": "ok",
            "plan_found": plan_found,
            "target_risk": target_risk,
            "flexibility_weights": priority_penalty,
            "options": (
                [
                    {
                        "action": "cut",
                        "target": category,
                        "amount": round(monthly_spend[category] * cut, 2),
                    }
                    for category, cut in cuts.items()
                ]
                + [{"action": "delay", "days": 14}]
            ),
            "lifestyle_disruption_score": round(disruption, 4),
            "simulation": result,
            "tag": "recommended",
        }

        self._optimizer_cache[key] = response
        return response

    def evaluate_lock(
        self,
        user_data: Any,
        locked_path: LockedPath | Mapping[str, Any],
    ) -> dict[str, Any]:
        lock = (
            locked_path
            if isinstance(locked_path, LockedPath)
            else LockedPath.model_validate(locked_path)
        )

        simulation = self.simulate(
            user_data,
            {"kind": "do_nothing"},
        )

        if simulation["status"] == "insufficient_data":
            return {**simulation, "lock_id": lock.id}

        before = round(1 - lock.max_risk, 4)
        buffer_ok = (
            simulation["buffer"]["p50"] >= lock.required_balance
        )

        success_now = round(
            (1 - simulation["shortfall_prob"])
            if buffer_ok
            else max(0.0, 1 - simulation["shortfall_prob"] - 0.25),
            4,
        )

        deficit = max(
            0.0,
            lock.required_balance - simulation["buffer"]["p50"],
        )

        recovery = (
            []
            if success_now >= before
            else [
                {
                    "action": "cut",
                    "target": "discretionary_spend",
                    "amount": round(deficit / 3, 2),
                },
                {
                    "action": "delay",
                    "days": max(
                        1,
                        int(
                            deficit
                            / max(lock.required_balance, 1)
                            * 30
                        ),
                    ),
                },
                {
                    "action": "reduce_budget",
                    "amount": round(deficit, 2),
                },
            ]
        )

        reason = (
            "Plan remains within its risk limit"
            if not recovery
            else (
                f"Projected median balance is Rs {deficit:,.0f} "
                "below the locked target"
            )
        )

        return {
            "lock_id": lock.id,
            "success_prob_before": before,
            "success_prob_now": success_now,
            "reason": reason,
            "delay_days": recovery[1]["days"] if recovery else 0,
            "recovery": recovery,
            "tag": "recommended",
        }

    def refresh(
        self,
        user_data: Any,
        new_txn: Mapping[str, Any],
        locks: Sequence[LockedPath | Mapping[str, Any]],
    ) -> dict[str, Any]:
        current = self._transactions(user_data)
        ingested = self.ingest([new_txn], source="live")

        if not ingested["accepted"]:
            return {
                "status": "rejected",
                "rejected": ingested["rejected"],
            }

        all_transactions = [*current, *ingested["accepted"]]
        analysis = self.analyze(all_transactions)
        drifts = [
            self.evaluate_lock(all_transactions, lock)
            for lock in locks
        ]

        recommendation = next(
            (
                drift
                for drift in drifts
                if drift.get("success_prob_now", 1)
                < drift.get("success_prob_before", 0)
            ),
            None,
        )

        replanned_plan = None
        if recommendation is not None and locks:
            # Wire replan into existing drift detection
            drift_lock = locks[0]
            try:
                replanned_plan = self.replan(
                    all_transactions,
                    plan=drift_lock,
                    change={
                        "trigger": "plan_drift",
                        "drift_reason": recommendation.get("reason", "Lock drifted"),
                        "reserve": getattr(drift_lock, "reserve", 45000.0) if hasattr(drift_lock, "reserve") else drift_lock.get("reserve", 45000.0),
                        "goal": getattr(drift_lock, "required_balance", 75000.0) if hasattr(drift_lock, "required_balance") else drift_lock.get("required_balance", 75000.0),
                    },
                )
            except Exception:
                replanned_plan = None

        return {
            "status": "ok",
            "transaction": ingested["accepted"][0],
            "analysis": analysis,
            "drifts": drifts,
            "recommendation": recommendation,
            "replanned_plan": replanned_plan,
        }

    def plan(
        self,
        user_data: Any,
        sequences: Sequence[Any] = (),
        reserve: float = 0.0,
        goal: float = 0.0,
        view: str = "weekly",
    ) -> dict[str, Any]:
        transactions = self._transactions(user_data)
        history_days = self._history_days(transactions)

        if history_days < MIN_HISTORY_DAYS:
            return {
                "status": "insufficient_data",
                "history_days": history_days,
                "min_days": MIN_HISTORY_DAYS,
            }

        frame = self._frame(transactions)
        from src.lp_planner import build_plan_sequences

        plan_obj = build_plan_sequences(
            frame,
            reserve=reserve,
            goal=goal,
            horizon_weeks=8,
            view=view,
        )
        plan_dict = plan_obj.model_dump(mode="json")
        return plan_dict

    def replan(
        self,
        user_data: Any,
        plan: Any,
        change: Mapping[str, Any],
    ) -> dict[str, Any]:
        """Re-runs planner from current week with adjusted parameters or new shocks."""
        transactions = self._transactions(user_data)
        frame = self._frame(transactions)
        from src.lp_planner import replan_sequences

        replan_obj = replan_sequences(frame, plan=plan, change=change)
        return replan_obj.model_dump(mode="json")
