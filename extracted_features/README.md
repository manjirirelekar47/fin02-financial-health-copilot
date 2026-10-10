# Extracted Phase 1 Decoupled Features

This bundle contains the three decoupled, standalone features extracted from the 100% codebase for drop-in use into your 40% baseline project.

All heavy `scipy.optimize.linprog` optimization routines, multi-horizon views, and LLM agent dependencies have been stripped out.

---

## Folder Structure

```
extracted_features/
├── backend/
│   ├── schemas.py             # Standalone Pydantic models (Reserve, Sequences, Transactions, Alerts)
│   ├── simulator.py           # Decoupled F5 Monte Carlo simulator (S0 vs S1 across 8 weekly periods)
│   ├── recurring_detector.py  # Silent Creep detection logic (>5% subscription drift)
│   └── routes.py              # FastAPI APIRouter exposing /api/reserve, /api/simulate-sequences, /api/transactions
└── frontend/
    ├── CashReserveControl.jsx           # UI component for setting & updating cash reserve floor
    ├── SequenceComparisonTable.jsx      # 8-week period comparison table (S0 vs S1)
    ├── AddTransactionForm.jsx           # Live transaction form submitting to /api/transactions
    ├── SilentCreepCard.jsx              # Attention card displaying silent creep monthly/yearly costs
    └── DashboardIntegrationExample.jsx  # Complete working React example assembling all 4 components
```

---

## Drop-In Instructions (Into Your 40% Baseline)

### 1. Backend Wiring
1. Copy `backend/schemas.py`, `backend/simulator.py`, `backend/recurring_detector.py`, and `backend/routes.py` into your backend folder.
2. In your FastAPI `main.py`:
   ```python
   from backend.routes import router as extracted_router
   app.include_router(extracted_router)
   ```

### 2. Frontend Wiring
1. Copy all `.jsx` files from `frontend/` into your frontend `src/components/` directory.
2. In your `src/App.jsx` or `src/Dashboard.jsx`:
   ```jsx
   import DashboardIntegrationExample from "./components/DashboardIntegrationExample";

   export default function App() {
     return <DashboardIntegrationExample />;
   }
   ```
   *(Or import `CashReserveControl`, `SequenceComparisonTable`, `AddTransactionForm`, and `SilentCreepCard` individually into your existing screen).*

---

## Dependencies
- Backend: `fastapi`, `pydantic`, `pandas`, `numpy` (no scipy required!)
- Frontend: `react`, `lucide-react`, Tailwind CSS
