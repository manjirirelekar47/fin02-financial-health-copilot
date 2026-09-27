"""
api/main.py — FastAPI bridge between the Python pipeline and the React frontend.

Owned by: Member 1

Every endpoint runs the existing pipeline (ingestion -> categoriser ->
recurring_detector / health_ratios) and returns plain JSON. No new business
logic lives here — this file only translates pandas output into a shape
`fetch()` in the browser can consume. If a calculation is wrong, fix it in
src/, not here.

Run with:
    uvicorn api.main:app --reload --port 8000

Then open http://localhost:8000/docs for interactive API docs (auto-generated
by FastAPI — genuinely useful to show a judge, and free).
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

# Wide-open CORS is fine for a hackathon prototype (localhost frontend calling
# localhost backend) — would need tightening for anything beyond the demo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "persona_a_transactions.csv")


def _run_pipeline():
    """Runs ingestion + categorisation once per request. Fine at prototype
    scale (a few hundred rows); cache this if it becomes a bottleneck later."""
    try:
        clean = load_transactions(DATA_PATH)
    except TransactionValidationError as exc:
        raise HTTPException(status_code=500, detail=f"Data validation failed: {exc}")
    return categorise_dataframe(clean)


@app.get("/api/health")
def health_check():
    """Simple liveness check — useful to confirm the server is up before
    debugging anything else."""
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
    """Rule-based trend flags (e.g. savings_rate_declining) over the summary."""
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
    """
    Forward cash-flow forecast plus back-test accuracy.

    Returns:
        forecast: list of {date, predicted_net_cashflow, confidence_low, confidence_high}
        backtest: {mae_per_day, confidence_band_coverage_pct} — computed by
                  holding out the last `holdout_days` of REAL data and
                  checking the forecast against it. Report this number
                  in the pitch/README, not a guess.
    """
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
    """Raw categorised transactions — mainly for debugging / a table view."""
    df = _run_pipeline()
    out = df.copy()
    out["date"] = out["date"].dt.strftime("%Y-%m-%d")
    return out.head(limit).to_dict(orient="records")
