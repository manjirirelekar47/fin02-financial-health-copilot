"""
api/main.py — FastAPI bridge between the Python pipeline and the React frontend.

Owned by: Member 1
"""

import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ingestion import load_transactions, TransactionValidationError
from categoriser import categorise_dataframe
from recurring_detector import detect_recurring_payments, monthly_recurring_burden
from health_ratios import monthly_summary, trend_flags
from forecast_model import compute_daily_net_cashflow, forecast_forward, backtest

app = FastAPI(title="FIN-02 Financial Health Copilot API")

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


def _run_pipeline():
    """Runs ingestion + categorisation once per request."""
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


@app.get("/api/summary")
def get_summary():
    """Monthly income/expenses/savings-rate/debt-to-income series."""
    df = _run_pipeline()
    summary = monthly_summary(df)
    summary = summary.reset_index()
    summary["month"] = summary["month"].astype(str)
    return summary.to_dict(orient="records")


@app.get("/api/trends")
def get_trends():
    """Rule-based trend flags over the summary."""
    df = _run_pipeline()
    summary = monthly_summary(df)
    return trend_flags(summary)


@app.get("/api/recurring")
def get_recurring():
    """Detected recurring payments (chain-clustered, drift-aware)."""
    df = _run_pipeline()
    recurring = detect_recurring_payments(df)
    return {
        "payments": recurring.to_dict(orient="records"),
        "total_monthly_burden": monthly_recurring_burden(recurring),
    }


@app.get("/api/forecast")
def get_forecast(forecast_days: int = 30, holdout_days: int = 30):
    """Forward cash-flow forecast plus back-test accuracy."""
    df = _run_pipeline()
    daily = compute_daily_net_cashflow(df)

    forward = forecast_forward(daily, forecast_days=forecast_days)
    forward = forward.copy()
    forward["date"] = forward["date"].dt.strftime("%Y-%m-%d")

    bt = backtest(daily, holdout_days=holdout_days)

    return {
        "forecast": forward.to_dict(orient="records"),
        "backtest": {k: float(v) for k, v in bt.items()},
    }


@app.get("/api/transactions")
def get_transactions(limit: int = 50):
    """Raw categorised transactions."""
    df = _run_pipeline()
    out = df.copy()
    out["date"] = out["date"].dt.strftime("%Y-%m-%d")
    return out.head(limit).to_dict(orient="records")