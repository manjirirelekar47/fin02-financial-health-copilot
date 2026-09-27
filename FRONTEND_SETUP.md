# FIN-02 — React + FastAPI Setup

Two servers run side by side. Both need to be running for the dashboard to work.

## 1. Backend (Member 1) — FastAPI

```powershell
cd fin02-financial-health-copilot
pip install fastapi uvicorn
cd api
uvicorn main:app --reload --port 8000
```

Verify it's working: open http://localhost:8000/api/health in a browser —
should show `{"status":"ok"}`. Then check http://localhost:8000/docs for the
interactive API explorer (auto-generated, good to show in the demo).

## 2. Frontend (Member 1 sets up / Member 3 + Member 4 build components) — React

```powershell
cd fin02-financial-health-copilot/frontend
npm install
npm run dev
```

Open the URL it prints (usually http://localhost:5173). If you see
"Failed to load data" on the page, the backend (step 1) isn't running —
start that first.

## File ownership (matches the work-distribution doc)

| File | Owner | Notes |
|---|---|---|
| `api/main.py` | Member 1 | FastAPI bridge — do not change response shapes without telling Member 3/4 |
| `frontend/src/App.jsx` | Member 1 | Data fetching + layout |
| `frontend/src/api.js` | Member 1 | Fetch calls — must match `api/main.py` endpoints exactly |
| `frontend/src/components/ForecastChart.jsx` | Member 3 | Has a `TODO` comment marking where to wire in real forecast output |
| `frontend/src/components/HealthMetrics.jsx` | Member 4 | Presentational only — no API calls |
| `frontend/src/components/RecurringTable.jsx` | Member 4 | Presentational only — no API calls |

## Common errors and fixes

- **`npm error 403` or network error on `npm install`**: you need internet
  access on your actual machine — this fails in restricted/offline
  environments only.
- **Blank page, browser console shows CORS error**: confirm `api/main.py`'s
  `CORSMiddleware` block is still present — it allows the frontend (port 5173)
  to call the backend (port 8000).
- **"Failed to load data: ... 8000"**: the FastAPI server isn't running, or
  isn't running on port 8000. Restart step 1.
- **Port 5173 already in use**: another `npm run dev` is already running
  somewhere — close it, or change the port in `vite.config.js`.
