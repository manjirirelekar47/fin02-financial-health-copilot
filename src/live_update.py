import uuid
from typing import Optional
import pandas as pd
from datetime import datetime

from api.schemas import LiveTransactionRequest, LiveTransactionResponse, DataState, TwinForecastResponse, SimulatorResponse
from src.categoriser import categorise_transaction

# In a real app, this would be a database connection.
# For the prototype, we append to an in-memory dataframe or the CSV directly.
_MOCK_DB_APPENDS = []

def process_live_transaction(request: LiveTransactionRequest) -> LiveTransactionResponse:
    tx = request.transaction
    
    # 1. Categorise
    cat, conf, needs_review, why = categorise_transaction(tx.description)
    state = DataState.needs_review if needs_review else DataState.ok
    
    # In a real system, we would append to the dataframe here.
    # We will simulate appending for the response ID.
    tx_id = str(uuid.uuid4())
    
    _MOCK_DB_APPENDS.append({
        "id": tx_id,
        "date": tx.date,
        "merchant": tx.description,
        "amount": tx.amount,
        "type": tx.transaction_type,
        "category": cat
    })
    
    # 2. Refresh Twin/Forecast (Simulated fast recalculation)
    # If this was wired end-to-end we'd call `forecast_forward` on the updated dataframe.
    
    # 3. Re-run Simulator if active presets were provided
    # ...
    
    return LiveTransactionResponse(
        transaction_id=tx_id,
        categorised_as=cat,
        confidence=conf,
        state=state,
        updated_twin=None,
        updated_simulation=None
    )
