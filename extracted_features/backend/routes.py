"""backend/routes.py — Clean FastAPI router for the 3 extracted features.

Include in your FastAPI app with:
    from backend.routes import router
    app.include_router(router)
"""

from __future__ import annotations
import os
from pathlib import Path
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from backend.schemas import (
    CashReserveRequest,
    CashReserveResponse,
    LiveTransactionInput,
    LiveAddResponse,
    SimulationResponse,
)
from backend.simulator import simulate_two_sequences
from backend.recurring_detector import detect_silent_creep_alerts

router = APIRouter(prefix="/api", tags=["Extracted Features"])

# In-memory storage for baseline development
GLOBAL_RESERVE_FLOOR = 45000.0
GLOBAL_TRANSACTIONS = []


def _load_base_dataframe() -> pd.DataFrame:
    """Helper to load existing transactions or in-memory live items."""
    if GLOBAL_TRANSACTIONS:
        return pd.DataFrame(GLOBAL_TRANSACTIONS)
    
    # Try loading local CSV if available
    csv_candidates = [
        Path("data/persona_a_transactions.csv"),
        Path("data/transactions.csv"),
        Path("../data/persona_a_transactions.csv"),
    ]
    for p in csv_candidates:
        if p.exists():
            return pd.read_csv(p)

    # Minimal mock dataframe if no file exists
    return pd.DataFrame([
        {"date": "2026-08-01", "narration": "Salary Credit", "amount": 65000.0, "type": "credit"},
        {"date": "2026-08-05", "narration": "House Rent", "amount": 18000.0, "type": "debit"},
        {"date": "2026-08-07", "narration": "Car EMI", "amount": 9500.0, "type": "debit"},
        {"date": "2026-08-10", "narration": "Netflix", "amount": 649.0, "type": "debit"},
        {"date": "2026-09-10", "narration": "Netflix", "amount": 849.0, "type": "debit"},
        {"date": "2026-10-10", "narration": "Netflix", "amount": 1099.0, "type": "debit"},
    ])


# ------------------------------------------------------------------------------
# Feature 1: Minimum Cash Reserve
# ------------------------------------------------------------------------------

@router.get("/reserve", response_model=CashReserveResponse)
def get_reserve():
    """Retrieve the current minimum emergency cash reserve floor."""
    return CashReserveResponse(reserve=GLOBAL_RESERVE_FLOOR)


@router.post("/reserve", response_model=CashReserveResponse)
def set_reserve(payload: CashReserveRequest):
    """Update the minimum emergency cash reserve floor."""
    global GLOBAL_RESERVE_FLOOR
    GLOBAL_RESERVE_FLOOR = float(payload.reserve)
    return CashReserveResponse(reserve=GLOBAL_RESERVE_FLOOR)


# ------------------------------------------------------------------------------
# Feature 2: F5 MVP Simulator (8-Week Table)
# ------------------------------------------------------------------------------

@router.get("/simulate-sequences", response_model=SimulationResponse)
def get_simulation(reserve: float = Query(default=None)):
    """Simulates S0 (Hold Steady) and S1 (Trim Spend) across 8 weekly periods."""
    floor = float(reserve) if reserve is not None else GLOBAL_RESERVE_FLOOR
    df = _load_base_dataframe()
    res = simulate_two_sequences(df, reserve_floor=floor)
    return res


# ------------------------------------------------------------------------------
# Feature 3: Live Add & Silent Creep
# ------------------------------------------------------------------------------

@router.post("/transactions", response_model=LiveAddResponse)
def add_transaction(payload: LiveTransactionInput):
    """Live loop: records transaction, re-evaluates silent creep, and returns alerts."""
    row = payload.model_dump()
    GLOBAL_TRANSACTIONS.append(row)
    
    df = _load_base_dataframe()
    alerts = detect_silent_creep_alerts(df)
    
    return LiveAddResponse(
        status="ok",
        transaction=row,
        alerts=alerts,
        total_transactions=len(GLOBAL_TRANSACTIONS),
    )


@router.get("/alerts")
def get_alerts():
    """Retrieve current alerts (including silent creep)."""
    df = _load_base_dataframe()
    return {"status": "ok", "alerts": detect_silent_creep_alerts(df)}
