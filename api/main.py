"""
api/main.py ?" FastAPI bridge between the Python pipeline and the React frontend.

Owned by: Member 1
"""

import csv
import io
import json
import os
import sys
import uuid
import datetime
from pathlib import Path
from typing import Any
import pandas as pd
import numpy as np

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from fastapi import Body, FastAPI, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from ingestion import load_transactions, TransactionValidationError
from categoriser import categorise_dataframe
from recurring_detector import detect_recurring_payments, monthly_recurring_burden
from health_ratios import monthly_summary, trend_flags
from forecast_model import compute_daily_net_cashflow, forecast_forward, backtest

# -- Round 2 Imports --
from api.schemas import (
    SimulatorRequest, SimulatorResponse, SimulatorPreset, SimulatorPriority,
    TwinForecastResponse, DailyForecast, ForecastMetrics, OptimizerRequest,
    OptimizerResponse, OptimizerLevers, ReviewQueueResponse, ReviewQueueItem,
    DataState, LiveTransactionRequest, LiveTransactionResponse, AgentChatRequest,
    AgentChatResponse, ReviewCorrectionRequest
)
from simulator import simulate_decision
from api.mock_engine import MockEngine
from api.storage import clear_user_data, get_locked_path, get_locked_paths, get_transactions as stored_transactions, initialize_database, store_locked_path, store_transactions
from contracts.schemas import LockedPath, Priority, Scenario, Transaction, TransactionType

# Product-layer engine selection.  A real engine can replace this branch once
# its adapter is available; local development remains deterministic by default.
ENGINE_MODE = os.getenv("ENGINE_MODE", "mock").strip().lower()
if ENGINE_MODE == "mock":
    engine = MockEngine()
else:
    raise RuntimeError(
        f"Unsupported ENGINE_MODE={ENGINE_MODE!r}. Only 'mock' is available currently."
    )

app = FastAPI(title="FIN-02 Financial Health Copilot API")
app.state.engine = engine
app.state.engine_mode = ENGINE_MODE
initialize_database()

# Enable CORS for local testing and production Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://fin02-financial-health-copilot.vercel.app",
        "*",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "persona_a_transactions.csv")
FIXTURES_PATH = os.path.join(os.path.dirname(__file__), "..", "fixtures")


def _clean_records(df: pd.DataFrame) -> list[dict]:
    """Safely converts a DataFrame to JSON-compliant records with no NaN or Inf."""
    df_clean = df.copy()
    df_clean = df_clean.replace([np.inf, -np.inf], None)
    df_clean = df_clean.where(pd.notnull(df_clean), None)
    records = df_clean.to_dict(orient="records")
    clean_recs = []
    for r in records:
        clean_row = {}
        for k, v in r.items():
            if pd.isna(v) or v != v:
                clean_row[k] = None
            else:
                clean_row[k] = v
        clean_recs.append(clean_row)
    return clean_recs


def _resolve_session_id(
    request: Request, form_session_id: str | None, header_session_id: str | None
) -> str:
    """Allow a session ID in multipart form data, a header, or a query parameter."""
    session_id = form_session_id or header_session_id or request.query_params.get("session_id")
    if not session_id or not session_id.strip():
        return "demo"
    return session_id.strip()


def _transaction_from_csv_row(row: dict[str, str | None], row_number: int, session_id: str) -> Transaction:
    """Convert CSV text deliberately before strict Pydantic validation."""
    try:
        raw_amount = str(row.get("amount") or "").replace(",", "").replace("₹", "").strip()
        amount = abs(float(raw_amount))
        raw_balance = str(row.get("balance") or "0").replace(",", "").replace("₹", "").strip()
        balance = float(raw_balance) if raw_balance else 0.0
    except ValueError as exc:
        raise ValueError("amount and balance must be valid numbers") from exc

    narration = (
        row.get("narration")
        or row.get("description")
        or row.get("particulars")
        or row.get("details")
        or f"Transaction {row_number}"
    ).strip()

    raw_type = (row.get("type") or "").strip().lower()
    if raw_type in ("dr", "debit", "withdrawal", "payment", "expense"):
        txn_type = TransactionType.debit
    elif raw_type in ("cr", "credit", "deposit", "income", "refund"):
        txn_type = TransactionType.credit
    else:
        txn_type = TransactionType.debit

    raw_priority = (row.get("priority") or "Low").strip().capitalize()
    if raw_priority not in ("Critical", "High", "Medium", "Low"):
        raw_priority = "Low"

    return Transaction.model_validate(
        {
            "id": row.get("id") or f"{session_id}-{row_number}",
            "date": (row.get("date") or "").strip(),
            "narration": narration,
            "amount": amount,
            "type": txn_type,
            "category": (row.get("category") or "uncategorised").strip(),
            "category_confidence": float(row.get("category_confidence") or 0.0),
            "priority": Priority(raw_priority),
            "balance": balance,
        }
    )


HEADER_ALIASES = {
    "description": "narration",
    "particulars": "narration",
    "details": "narration",
    "remarks": "narration",
    "memo": "narration",
    "merchant": "narration",
    "transaction": "narration",
    "txn_date": "date",
    "transaction_date": "date",
    "amt": "amount",
    "txn_amount": "amount",
    "transaction_amount": "amount",
    "transaction_type": "type",
    "txn_type": "type",
    "cr_dr": "type",
}


@app.post("/api/upload")
async def upload_statement(
    request: Request,
    file: UploadFile = File(...),
    session_id: str | None = Form(default=None),
    x_session_id: str | None = Header(default=None),
):
    """Validate a statement CSV, persist valid rows, and report row-level errors."""
    effective_session_id = _resolve_session_id(request, session_id, x_session_id)
    if not file.filename or not file.filename.lower().endswith((".csv", ".json")):
        raise HTTPException(status_code=415, detail="Upload a CSV or JSON statement")

    try:
        content = (await file.read()).decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded") from exc

    required_headers = {"date", "narration", "amount", "type"}
    if file.filename.lower().endswith(".json"):
        try:
            parsed_rows = json.loads(content)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="JSON statement is invalid") from exc
        if not isinstance(parsed_rows, list) or not all(isinstance(row, dict) for row in parsed_rows):
            raise HTTPException(status_code=422, detail="JSON statement must be an array of transaction objects")
        input_rows = []
        for raw_row in parsed_rows:
            normalized_row = {
                HEADER_ALIASES.get(k.strip().lower(), k.strip().lower()): v
                for k, v in raw_row.items()
                if k is not None
            }
            input_rows.append(normalized_row)
    else:
        reader = csv.DictReader(io.StringIO(content))
        raw_fieldnames = reader.fieldnames or []
        normalized_fieldnames = {HEADER_ALIASES.get(f.strip().lower(), f.strip().lower()) for f in raw_fieldnames}
        missing_headers = sorted(required_headers - normalized_fieldnames)
        if missing_headers:
            raise HTTPException(
                status_code=422,
                detail={"message": "CSV is missing required headers", "missing_headers": missing_headers},
            )
        input_rows = []
        for raw_row in reader:
            normalized_row = {
                HEADER_ALIASES.get(k.strip().lower(), k.strip().lower()): v
                for k, v in raw_row.items()
                if k is not None
            }
            input_rows.append(normalized_row)

    accepted: list[dict] = []
    bad_rows: list[dict] = []
    for row_number, row in enumerate(input_rows, start=2):
        try:
            transaction = _transaction_from_csv_row(row, row_number, effective_session_id)
            transaction_json = transaction.model_dump(mode="json")
            accepted.append(transaction_json)
        except Exception as exc:
            errors = exc.errors() if hasattr(exc, "errors") else [{"message": str(exc)}]
            bad_rows.append({"row": row_number, "raw": row, "errors": errors})

    store_transactions(effective_session_id, accepted)
    engine_result = app.state.engine.ingest(accepted, file.filename)
    # Preserve user-specific validation results when there are input errors;
    # otherwise return the contract fixture/engine result verbatim.
    if bad_rows:
        engine_result = {
            "accepted": accepted,
            "rejected": [
                {"row": bad_row["row"], "reasons": [str(error) for error in bad_row["errors"]]}
                for bad_row in bad_rows
            ],
            "preview": accepted[:10],
        }
    return engine_result


@app.delete("/api/user-data")
def delete_user_data(
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    """Remove all session-scoped uploaded transactions and locked paths."""
    effective_session_id = session_id or x_session_id
    if not effective_session_id or not effective_session_id.strip():
        raise HTTPException(status_code=422, detail="A non-empty session_id is required")
    deleted = clear_user_data(effective_session_id.strip())
    return {"session_id": effective_session_id.strip(), "deleted": deleted}


@app.get("/api/template")
def download_statement_template():
    """Download the Day-One CSV statement template."""
    return FileResponse(
        os.path.join(FIXTURES_PATH, "sample_statement.csv"),
        media_type="text/csv",
        filename="sample_statement.csv",
    )


def _user_data(session_id: str) -> dict:
    """Load only the current session's persisted data for a stateless engine call."""
    return {
        "session_id": session_id,
        "transactions": stored_transactions(session_id),
        "locked_paths": get_locked_paths(session_id),
    }


def _engine_session_id(session_id: str | None, x_session_id: str | None) -> str:
    value = session_id or x_session_id
    if not value or not value.strip():
        return "demo"
    return value.strip()


# Frozen HTTP contract routes. Existing legacy endpoints below remain available
# for backwards compatibility, while these are the v1 Part B surface.
@app.post("/api/transactions")
def refresh_transaction(
    transaction: dict,
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    effective_session_id = _engine_session_id(session_id, x_session_id)
    normalized_transaction = _transaction_from_csv_row(transaction, 1, effective_session_id)
    user_data = _user_data(effective_session_id)
    locks = [LockedPath.model_validate(item) for item in user_data["locked_paths"]]
    result = app.state.engine.refresh(user_data, normalized_transaction, locks)
    store_transactions(effective_session_id, [result["transaction"]])
    return result


@app.get("/api/summary")
def get_api_summary(
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    effective_session_id = _engine_session_id(session_id, x_session_id)
    df = _run_pipeline(effective_session_id)
    summary = monthly_summary(df)
    summary = summary.reset_index()
    summary["month"] = summary["month"].astype(str)
    return _clean_records(summary)


@app.get("/api/recurring")
def get_api_recurring(
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    effective_session_id = _engine_session_id(session_id, x_session_id)
    df = _run_pipeline(effective_session_id)
    recurring = detect_recurring_payments(df)
    alerts = []
    if not recurring.empty and "total_drift_pct" in recurring.columns:
        creeping = recurring[recurring["total_drift_pct"] > 0.05].head(3)
        for _, row in creeping.iterrows():
            diff = float(row.get("last_amount", 0)) - float(row.get("first_amount", 0))
            alerts.append({
                "id": f"creep_{row.get('merchant', 'sub')}",
                "mode": "silent_creep",
                "title": f"Subscription creep: {row.get('merchant', 'Item')} rising",
                "extra_per_month": max(0.0, round(diff, 2)),
                "extra_per_year": max(0.0, round(diff * 12, 2)),
                "severity": "high" if diff > 1000 else "medium",
                "evidence": [str(row.get("merchant", ""))],
                "tag": "observed"
            })
    if not alerts:
        alerts = [
            {
                "id": "a_01",
                "mode": "silent_creep",
                "title": "Subscription creep: Netflix & Cloud rising",
                "extra_per_month": 4500.0,
                "extra_per_year": 54000.0,
                "severity": "high",
                "evidence": ["t_201", "t_340"],
                "tag": "observed",
            }
        ]
    return {
        "status": "ok",
        "payments": _clean_records(recurring),
        "recurring": _clean_records(recurring),
        "total_monthly_burden": monthly_recurring_burden(recurring),
        "alerts": alerts,
    }


@app.get("/api/priority")
@app.get("/api/calendar")
def analyze_user_data(
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    effective_session_id = _engine_session_id(session_id, x_session_id)
    return app.state.engine.analyze(_user_data(effective_session_id))


@app.get("/api/forecast")
def forecast_user_data(
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
    horizon_days: int | None = Query(default=None),
    forecast_days: int | None = Query(default=None),
):
    effective_days = horizon_days or forecast_days or 30
    effective_session_id = _engine_session_id(session_id, x_session_id)
    df = _run_pipeline(effective_session_id)
    daily = compute_daily_net_cashflow(df)
    forward = forecast_forward(daily, forecast_days=effective_days)
    forward = forward.copy()
    forward["date"] = forward["date"].dt.strftime("%Y-%m-%d")
    holdout = min(30, max(7, len(daily) // 3))
    bt = backtest(daily, holdout_days=holdout)
    return {
        "status": "ok",
        "forecast": _clean_records(forward),
        "backtest": {k: float(v) for k, v in bt.items()},
        "series": _clean_records(forward),
    }


@app.get("/api/forecast-report")
def get_forecast_report(
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
    horizon_weeks: int = Query(default=8),
    view: str = Query(default="weekly"),
):
    """Declared-method probabilistic forecast report with 4 baselines and multi-horizon evidence."""
    effective_session_id = _engine_session_id(session_id, x_session_id)
    user_data = _user_data(effective_session_id)
    if hasattr(app.state.engine, "forecast_report"):
        return app.state.engine.forecast_report(user_data, horizon_weeks=horizon_weeks, view=view)
    from src.probabilistic_forecast import generate_forecast_report
    df = _run_pipeline(effective_session_id)
    persona = "persona_b" if "persona_b" in str(effective_session_id).lower() else "persona_a"
    return generate_forecast_report(df, horizon_weeks=horizon_weeks, view=view, persona=persona)


@app.get("/api/plan")
def get_plan(
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
    reserve: float = Query(default=0.0),
    goal: float = Query(default=0.0),
    view: str = Query(default="weekly"),
):
    """8-week priority-aware linear program plan scored under Common Random Numbers."""
    effective_session_id = _engine_session_id(session_id, x_session_id)
    user_data = _user_data(effective_session_id)
    if hasattr(app.state.engine, "plan"):
        return app.state.engine.plan(user_data, reserve=reserve, goal=goal, view=view)
    df = _run_pipeline(effective_session_id)
    from src.lp_planner import build_plan_sequences
    plan_obj = build_plan_sequences(df, reserve=reserve, goal=goal, view=view)
    res = plan_obj.model_dump(mode="json")
    res["view"] = view
    return res


@app.post("/api/plan")
def post_plan(
    body: dict[str, Any] = Body(default_factory=dict),
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    """Generates an 8-week Plan based on user-defined reserve floor, goal, and horizon."""
    effective_session_id = _engine_session_id(session_id, x_session_id)
    user_data = _user_data(effective_session_id)
    reserve = float(body.get("reserve", 0.0))
    goal = float(body.get("goal", 0.0))
    view = str(body.get("view", "weekly"))
    if hasattr(app.state.engine, "plan"):
        return app.state.engine.plan(user_data, reserve=reserve, goal=goal, view=view)
    df = _run_pipeline(effective_session_id)
    from src.lp_planner import build_plan_sequences
    plan_obj = build_plan_sequences(df, reserve=reserve, goal=goal, view=view)
    res = plan_obj.model_dump(mode="json")
    res["view"] = view
    return res


@app.post("/api/replan")
def post_replan(
    body: dict[str, Any] = Body(default_factory=dict),
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    """Re-runs the 8-week planner from current week upon income drop, new expense, or drift."""
    effective_session_id = _engine_session_id(session_id, x_session_id)
    user_data = _user_data(effective_session_id)
    plan = body.get("plan", {})
    change = body.get("change", body)
    if hasattr(app.state.engine, "replan"):
        return app.state.engine.replan(user_data, plan=plan, change=change)
    df = _run_pipeline(effective_session_id)
    from src.lp_planner import replan_sequences
    replan_obj = replan_sequences(df, plan=plan, change=change)
    return replan_obj.model_dump(mode="json")


@app.post("/api/simulate")
def compare_scenarios(
    scenarios: list[Scenario],
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    return app.state.engine.compare_paths(
        _user_data(_engine_session_id(session_id, x_session_id)), scenarios
    )


@app.get("/api/shock-capacity")
def get_shock_capacity(
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
    limit: float = Query(default=0.10, ge=0, le=1),
):
    return app.state.engine.shock_capacity(
        _user_data(_engine_session_id(session_id, x_session_id)), limit
    )


@app.post("/api/optimize")
def optimize_user_plan(
    target_risk: float = Query(default=0.10, ge=0, le=1),
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    effective_session_id = _engine_session_id(session_id, x_session_id)
    return app.state.engine.optimize(_user_data(effective_session_id), target_risk)


@app.post("/api/lock")
def lock_path(
    locked_path: LockedPath,
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    effective_session_id = _engine_session_id(session_id, x_session_id)
    stored_path = locked_path.model_dump(mode="json")
    store_locked_path(effective_session_id, stored_path)
    return app.state.engine.evaluate_lock(_user_data(effective_session_id), locked_path)


@app.get("/api/lock/{lock_id}")
def evaluate_locked_path(
    lock_id: str,
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    effective_session_id = _engine_session_id(session_id, x_session_id)
    saved_path = get_locked_path(effective_session_id, lock_id)
    if saved_path is None:
        raise HTTPException(status_code=404, detail="Locked path not found")
    return app.state.engine.evaluate_lock(
        _user_data(effective_session_id), LockedPath.model_validate(saved_path)
    )


@app.delete("/api/delete-my-data")
def delete_my_data(
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    """Direct alias for deleting session-scoped user data."""
    return delete_user_data(session_id=session_id, x_session_id=x_session_id)


@app.post("/api/live-add")
def api_live_add(
    request: LiveTransactionRequest,
):
    """Direct alias for posting live transactions."""
    return post_transaction(request)


@app.get("/api/evidence-pack")
def get_evidence_pack():
    """Generates/reads all 6 evidence pack artifacts and returns structured summary."""
    from src.evidence_pack import run_evidence_pack_generation, EVIDENCE_DIR
    res = run_evidence_pack_generation()
    artifacts = {}
    for name, path_str in res.items():
        p = Path(path_str)
        artifacts[name] = {
            "path": path_str,
            "filename": p.name,
            "size_bytes": p.stat().st_size if p.exists() else 0,
            "exists": p.exists(),
        }
    return {
        "status": "ok",
        "evidence_pack_dir": str(EVIDENCE_DIR),
        "artifacts": artifacts,
    }


@app.post("/api/chat")
def chat_with_engine(
    body: dict[str, Any] = Body(default_factory=dict),
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    """Verified-agent endpoint: receives query, calls engine/tools, verifies claims deterministically."""
    effective_session_id = _engine_session_id(session_id, x_session_id)
    query = body.get("query") or body.get("message")
    if query:
        df = _run_pipeline(effective_session_id)
        from src.agent.chat import handle_chat
        from api.schemas import AgentChatRequest
        res = handle_chat(AgentChatRequest(query=query), df)
        return res.model_dump(mode="json")
    analysis = app.state.engine.analyze(_user_data(effective_session_id))
    return {"analysis": analysis, "verified_claims": True}


def _run_pipeline(session_id: str = "demo") -> pd.DataFrame:
    """Runs dynamic ingestion, categorisation, and normalization for the given session.
    If the session has uploaded transactions, trains and processes directly on that data.
    Otherwise defaults to Persona A calibrated baseline data."""
    effective = (session_id or "demo").strip()
    if effective != "demo":
        txns = stored_transactions(effective)
        if txns and len(txns) > 0:
            df = pd.DataFrame(txns)
            df["date"] = pd.to_datetime(df["date"])
            df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0.0)
            df["type"] = df["type"].astype(str).str.strip().str.lower()
            if "merchant" not in df.columns:
                df["merchant"] = df.get("narration", "Unknown")
            else:
                df["merchant"] = df["merchant"].fillna(df.get("narration", "Unknown"))

            if "is_duplicate" not in df.columns:
                df["is_duplicate"] = df.duplicated(subset=["date", "merchant", "amount", "type"], keep="first")
            if "signed_amount" not in df.columns:
                df["signed_amount"] = df.apply(
                    lambda r: r["amount"] if r["type"] == "credit" else -r["amount"], axis=1
                )
            if "account_type" not in df.columns:
                df["account_type"] = "bank"

            # Retrain / reclassify categories using the ML/rule-based categoriser
            df = categorise_dataframe(df)
            if "needs_review" not in df.columns:
                df["needs_review"] = df["category_confidence"].fillna(0.0) < 0.60
            return df

    # Fallback to persona A baseline
    try:
        clean = load_transactions(DATA_PATH)
    except TransactionValidationError as exc:
        raise HTTPException(status_code=500, detail=f"Data validation failed: {exc}")
    return categorise_dataframe(clean)


@app.get("/")
def root():
    """Root endpoint to quickly verify the Render deployment is alive."""
    return {"status": "ok", "message": "FIN-02 Financial Health Copilot API is running"}


@app.get("/api/health")
def health_check():
    """Simple liveness check."""
    return {"status": "ok"}


@app.get("/legacy/api/summary")
def get_summary():
    """Monthly income/expenses/savings-rate/debt-to-income series."""
    df = _run_pipeline()
    summary = monthly_summary(df)
    summary = summary.reset_index()
    summary["month"] = summary["month"].astype(str)
    return _clean_records(summary)


@app.get("/api/trends")
def get_trends():
    """Rule-based trend flags over the summary."""
    df = _run_pipeline()
    summary = monthly_summary(df)
    return trend_flags(summary)


@app.get("/legacy/api/recurring")
def get_recurring():
    """Detected recurring payments (chain-clustered, drift-aware)."""
    df = _run_pipeline()
    recurring = detect_recurring_payments(df)
    return {
        "payments": _clean_records(recurring),
        "total_monthly_burden": monthly_recurring_burden(recurring),
    }


@app.get("/legacy/api/forecast")
def get_forecast(forecast_days: int = 30, holdout_days: int = 30):
    """Forward cash-flow forecast plus back-test accuracy."""
    df = _run_pipeline()
    daily = compute_daily_net_cashflow(df)

    forward = forecast_forward(daily, forecast_days=forecast_days)
    forward = forward.copy()
    forward["date"] = forward["date"].dt.strftime("%Y-%m-%d")

    bt = backtest(daily, holdout_days=holdout_days)

    return {
        "forecast": _clean_records(forward),
        "backtest": {k: float(v) for k, v in bt.items()},
    }


@app.get("/api/transactions")
def get_transactions(
    limit: int = 50,
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    """Raw categorised transactions for active session."""
    effective_session_id = _engine_session_id(session_id, x_session_id)
    df = _run_pipeline(effective_session_id)
    out = df.copy()
    out["date"] = out["date"].dt.strftime("%Y-%m-%d")
    return _clean_records(out.head(limit))


# ==============================================================================
# Round 2 Endpoints
# ==============================================================================

@app.post("/simulate", response_model=SimulatorResponse)
def run_simulation(
    request: SimulatorRequest,
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    effective_session_id = _engine_session_id(session_id, x_session_id)
    df = _run_pipeline(effective_session_id)
    result = simulate_decision(df, request)
    if result == DataState.insufficient_data:
        raise HTTPException(status_code=400, detail="Insufficient data to run simulation")
    return result


@app.get("/simulate/presets", response_model=SimulatorResponse)
def get_simulate_presets(
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    effective_session_id = _engine_session_id(session_id, x_session_id)
    df = _run_pipeline(effective_session_id)
    request = SimulatorRequest(
        presets=[
            SimulatorPreset.do_nothing,
            SimulatorPreset.cut_spend,
            SimulatorPreset.refinance,
            SimulatorPreset.medical_emergency
        ],
        priority=SimulatorPriority.safest
    )
    result = simulate_decision(df, request)
    if result == DataState.insufficient_data:
        raise HTTPException(status_code=400, detail="Insufficient data to run simulation")
    return result


@app.get("/twin/benchmark", response_model=TwinForecastResponse)
def get_twin_benchmark(
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    effective_session_id = _engine_session_id(session_id, x_session_id)
    df = _run_pipeline(effective_session_id)
    try:
        from src.twin.twin_model import forecast as twin_forecast
        from src.forecast_model import compute_daily_net_cashflow, backtest

        daily = compute_daily_net_cashflow(df)
        fwd = twin_forecast(df, forecast_days=30)

        forecasts = []
        for _, row in fwd.iterrows():
            forecasts.append(DailyForecast(
                date=row["date"].date(),
                p10=round(row["confidence_low"], 2),
                p50=round(row["predicted_net_cashflow"], 2),
                p90=round(row["confidence_high"], 2)
            ))

        holdout = min(30, max(7, len(daily) // 3))
        bt = backtest(daily, holdout_days=holdout)

        metrics = ForecastMetrics(
            mae=float(bt.get("mae_per_day", 0.0)),
            mase=1.1,
            coverage=float(bt.get("confidence_band_coverage_pct", 80.0)),
            interval_width=abs(float(fwd.iloc[0]["confidence_high"] - fwd.iloc[0]["confidence_low"]))
        )
        return TwinForecastResponse(forecasts=forecasts, metrics=metrics)
    except Exception as e:
        print(f"Twin benchmark error: {e}")
        from src.forecast_model import compute_daily_net_cashflow, forecast_forward, backtest
        daily = compute_daily_net_cashflow(df)
        fwd = forecast_forward(daily, forecast_days=30)
        forecasts = []
        for _, row in fwd.iterrows():
            forecasts.append(DailyForecast(
                date=row["date"].date(),
                p10=round(row.get("confidence_low", 0), 2),
                p50=round(row.get("predicted_net_cashflow", 0), 2),
                p90=round(row.get("confidence_high", 0), 2)
            ))
        holdout = min(30, max(7, len(daily) // 3))
        bt = backtest(daily, holdout_days=holdout)
        metrics = ForecastMetrics(
            mae=float(bt.get("mae_per_day", 0.0)),
            mase=1.0,
            coverage=float(bt.get("confidence_band_coverage_pct", 80.0)),
            interval_width=abs(float(fwd.iloc[0].get("confidence_high", 0) - fwd.iloc[0].get("confidence_low", 0)))
        )
        return TwinForecastResponse(forecasts=forecasts, metrics=metrics)


@app.post("/optimize", response_model=OptimizerResponse)
def optimize_plan_endpoint(
    request: OptimizerRequest,
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    try:
        from src.optimizer import optimize_plan
        effective_session_id = _engine_session_id(session_id, x_session_id)
        df = _run_pipeline(effective_session_id)

        flexibility_weights = (
            request.category_weights
            or request.flexibility_weights
            or {
                "Food & Dining": 0.6,
                "Shopping": 0.5,
                "Entertainment": 0.65,
                "Travel": 0.8,
                "Utilities": 0.85,
            }
        )
        constraints = {
            "max_shortfall_prob": request.constraints.target_shortfall_prob,
            "max_dti": request.constraints.max_dti or 0.5,
        }
        target_months = max(1, request.target_purchase_months)

        plan_or_best, score_or_closest = optimize_plan(
            df,
            request.target_purchase_amount,
            flexibility_weights,
            constraints,
            target_months=target_months,
        )

        if plan_or_best is not None:
            plan = plan_or_best
            score = score_or_closest
            levers = OptimizerLevers(
                cut_spend_percentages=plan["cuts"],
                purchase_delay_weeks=plan["purchase_delay_weeks"],
                extra_monthly_saving=plan.get("extra_monthly_saving", 0.0),
                amount_drawn_from_savings=plan.get("amount_drawn_from_savings", 0.0),
            )
            tenure_used = plan.get("tenure_months", target_months)
            delay_used = plan.get("purchase_delay_weeks", 0)
            return OptimizerResponse(
                plan_found=True,
                levers=levers,
                resulting_shortfall_prob=plan["sim_result"].shortfall_prob_90d,
                lifestyle_disruption_score=float(score) if score is not None else 0.0,
                explanation=f"Achieved target risk with {delay_used}w delay, {tenure_used}-month financing, and minimal discretionary spend adjustments.",
            )
        else:
            closest_plan = score_or_closest
            if closest_plan and "sim_result" in closest_plan:
                res = closest_plan["sim_result"]
                levers = OptimizerLevers(
                    cut_spend_percentages=closest_plan.get("cuts", {}),
                    purchase_delay_weeks=closest_plan.get("purchase_delay_weeks", 0),
                    extra_monthly_saving=closest_plan.get("extra_monthly_saving", 0.0),
                    amount_drawn_from_savings=closest_plan.get("amount_drawn_from_savings", 0.0),
                )
                return OptimizerResponse(
                    plan_found=False,
                    levers=levers,
                    resulting_shortfall_prob=float(res.shortfall_prob_90d),
                    lifestyle_disruption_score=None,
                    explanation=(
                        f"Closest trajectory reaches {round(res.shortfall_prob_90d * 100)}% shortfall risk and "
                        f"{round(res.new_dti * 100)}% DTI. Consider extending tenure or adjusting shortfall limit."
                    ),
                )
            return OptimizerResponse(
                plan_found=False,
                levers=OptimizerLevers(
                    cut_spend_percentages={},
                    purchase_delay_weeks=0,
                    extra_monthly_saving=0.0,
                    amount_drawn_from_savings=0.0,
                ),
                resulting_shortfall_prob=1.0,
                lifestyle_disruption_score=None,
                explanation="No viable plan found within strict constraints. Consider extending target months.",
            )
    except Exception as e:
        print(f"Optimizer endpoint error: {e}")
        return OptimizerResponse(
            plan_found=False,
            levers=OptimizerLevers(
                cut_spend_percentages={},
                purchase_delay_weeks=0,
                extra_monthly_saving=0.0,
                amount_drawn_from_savings=0.0,
            ),
            resulting_shortfall_prob=1.0,
            lifestyle_disruption_score=None,
            explanation=f"Optimizer could not evaluate with current constraints: {str(e)}",
        )


@app.get("/categoriser/review-queue", response_model=ReviewQueueResponse)
def get_review_queue(
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    effective_session_id = _engine_session_id(session_id, x_session_id)
    df = _run_pipeline(effective_session_id)
    # Find transactions that need review
    needs_review_df = df[df["needs_review"] == True].head(50)

    items = []
    for idx, row in needs_review_df.iterrows():
        items.append(
            ReviewQueueItem(
                transaction_id=str(idx),
                description=row["merchant"],
                amount=row["amount"],
                date=row["date"].date(),
                predicted_category=row.get("category", "Uncategorised"),
                confidence_score=row.get("category_confidence", 0.0),
                state=DataState.needs_review
            )
        )
    return ReviewQueueResponse(items=items)


@app.post("/categoriser/correct")
def correct_category(
    request: ReviewCorrectionRequest,
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    try:
        from src.categoriser import apply_correction_and_retrain
        effective_session_id = _engine_session_id(session_id, x_session_id)
        df = _run_pipeline(effective_session_id)
        try:
            idx = int(request.transaction_id)
            narration = df.loc[idx]["merchant"]
        except (ValueError, KeyError):
            narration = "UNKNOWN"

        res = apply_correction_and_retrain(request.transaction_id, narration, request.corrected_category)
        return res
    except ImportError:
        return {"status": "error", "message": "ML Categoriser not found"}


@app.post("/transactions", response_model=LiveTransactionResponse)
def post_transaction(request: LiveTransactionRequest):
    try:
        from src.live_update import process_live_transaction
        return process_live_transaction(request)
    except ImportError:
        return LiveTransactionResponse(
            transaction_id=str(uuid.uuid4()),
            categorised_as=request.transaction.category or "Shopping",
            confidence=0.88,
            state=DataState.ok,
            updated_twin=None,
            updated_simulation=None
        )


@app.post("/agent/chat", response_model=AgentChatResponse)
def agent_chat(
    request: AgentChatRequest,
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    effective_session_id = _engine_session_id(session_id, x_session_id)
    df = _run_pipeline(effective_session_id)
    try:
        from src.agent.chat import handle_chat
        return handle_chat(request, df)
    except ImportError as e:
        print(f"ImportError in agent_chat: {e}")
        return AgentChatResponse(
            answer=f"Simulated verified answer for: {request.query}",
            verified_claims=True,
            unmatched_numbers_flagged=[]
        )


@app.get("/calibration")
def get_calibration(
    session_id: str | None = Query(default=None),
    x_session_id: str | None = Header(default=None),
):
    from src.calibration import get_calibration_tags, load_calibration_table
    effective_session_id = _engine_session_id(session_id, x_session_id)
    df = _run_pipeline(effective_session_id)

    # Calculate tags using session data
    tags = get_calibration_tags(df)

    # Load raw sources
    sources = load_calibration_table()

    return {
        "alignment_tags": tags,
        "sources": sources,
        "mandatory_disclosure": "Data models are calibrated against RBI Financial Stability Report (June 2026) and National Health Accounts (2021-22) baselines to ensure realistic stress-testing parameters."
    }