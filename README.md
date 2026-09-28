# 🛡️ SpendShield — Financial Health Copilot

**HackMatrix 5.0 · Finance Track (FIN-02) · Round 1 — 40% Prototype**

![Python](https://img.shields.io/badge/Python-pandas%20%7C%20scikit--learn-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-backend-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react&logoColor=white)
![Deployed](https://img.shields.io/badge/Status-Live-brightgreen)

**A chatbot tells you what happened and suggests one action. SpendShield shows
you the realistic paths forward, simulated and compared, so you decide with
the consequences already visible.**

🔗 **Live app:** https://fin02-financial-health-copilot.vercel.app
🔗 **API:** https://spendshield-tj9v.onrender.com
🔗 **Repository:** https://github.com/manjirirelekar47/fin02-financial-health-copilot

---

## 💡 The USP

Most personal-finance tools show you the past and maybe one generic tip.
SpendShield's core idea is different:

> **User's situation → 2–3 realistic decision paths generated → each path
> independently simulated forward → side-by-side comparison → user decides.**

Instead of "you should spend less," SpendShield will (in the full build) show
*"here's what happens if you cut discretionary spend by 20%, here's what
happens if you refinance your EMI, here's what happens if you do nothing —
compared, side by side, with real numbers."* No single path is chosen for
the user; every recommendation is explainable and traceable to real data.

## ✅ What's actually working right now (40% prototype)

| Feature | Status |
|---|---|
| Transaction ingestion, validation, normalisation | ✅ Done |
| Rule-based categorisation + confidence/needs-review flagging | ✅ Done |
| Recurring-payment detection (chain-based, drift-aware — catches a genuinely rising EMI, not just flat payments) | ✅ Done |
| Debt-to-income & savings-rate calculations | ✅ Done |
| Cash-flow forecast (linear regression, back-tested) | ✅ Done — real numbers, not a placeholder |
| "What needs attention" panel — built from real trend + drift data | ✅ Done |
| Dashboard with sidebar navigation (Dashboard / Transactions / Recurring Payments) | ✅ Done |
| Full transaction list (Transactions tab) with category badges and "needs review" flagging | ✅ Done |
| Deployed, publicly reachable | ✅ Done (Render + Vercel) |

## ⏳ What's deliberately NOT built yet (planned for the 24-hour final round)

Being upfront about this rather than faking it — the sidebar even shows
honest "coming in the 24-hour build" placeholders instead of dead links:

| Feature | Status | When |
|---|---|---|
| **Multi-path simulation** (the core USP — cut spend / refinance / do-nothing, compared) | ⏳ Not built | Hours 9–15 of final build |
| Conversational Q&A ("Ask SpendShield" — natural-language questions over the data) | ⏳ Not built | Hours 4–9 |
| Goal-based planning | ⏳ Not built | With multi-path simulation |
| Live-update demo (add a transaction, watch everything recompute) | ⏳ Not built | Hours 15–19 |
| Additional personas (B — gig income, C — early saver, D — over-leveraged) — only Persona A exists so far | ⏳ Not built | Hours 0–4 |

## 🖥️ Live Demo

- **Frontend:** https://fin02-financial-health-copilot.vercel.app
- **Backend API:** https://spendshield-tj9v.onrender.com

## 📸 Screenshots

### Dashboard
<img width="1600" height="906" alt="image" src="https://github.com/user-attachments/assets/b2d5618d-d83a-4ee6-ad78-d4f19e2a1376" />

### Cash-Flow Forecast
<img width="1600" height="908" alt="image" src="https://github.com/user-attachments/assets/c6ac5bf6-a8ac-4211-86e5-8de078c8b51a" />

### Transactions
<img width="1600" height="908" alt="image" src="https://github.com/user-attachments/assets/deae59aa-5b41-4b07-8913-f15e9cfb4d57" />

### Recurring Payments
<img width="1600" height="903" alt="image" src="https://github.com/user-attachments/assets/84ba9610-f8ec-4b93-ad0d-677fdceadd5c" />

 
## 👥 Team

| Member | Role |
|---|---|
| [Manjiri Relekar](https://github.com/manjirirelekar47) | Team Lead — ingestion, categoriser, FastAPI bridge, deployment |
| [Bhavesh Patil](https://github.com/bhavesh-patil2007) | Forecasting model, back-testing, sidebar navigation, confidence-band fix |
| [Sneha Bhosale](https://github.com/SnehaBhosale20) | Recurring-payment detection, health-ratio calculations |
| [Namrata Dalvi](https://github.com/namratadalvi11) | Dashboard UI polish — hover states, health-score fill animation, net cash flow display fix |

## 🏗️ Architecture

```
data/  → synthetic Persona A transaction dataset (generate_persona_a.py)
src/   → backend pipeline (pure Python + pandas)
  ingestion.py          Stage 1 — load, validate, normalise raw transactions
  categoriser.py         Stage 2a — rule-based category classification + confidence
  recurring_detector.py  Stage 2b — chain-based recurring payment detection
  health_ratios.py       Stage 3a — debt-to-income, savings rate, trend flags
  forecast_model.py      Stage 3b — linear regression / moving-average forecast + back-test
api/
  main.py                FastAPI bridge exposing the pipeline as JSON endpoints
frontend/
  src/App.jsx             Data fetching, tab routing, layout
  src/components/         Sidebar, dashboard cards, forecast chart, recurring table, transactions table
```

## 🧰 Tech Stack

- **Backend:** Python, pandas, scikit-learn, FastAPI, uvicorn
- **Frontend:** React (Vite), Tailwind CSS, Recharts, lucide-react
- **Deployment:** Render (API), Vercel (frontend)

## 🔌 API Endpoints

| Endpoint | Returns |
|---|---|
| `GET /` | Root check — confirms the Render deployment is alive |
| `GET /api/health` | Liveness check |
| `GET /api/summary` | Monthly income/expenses/savings-rate/debt-to-income |
| `GET /api/trends` | Rule-based trend flags (e.g. savings rate declining) |
| `GET /api/recurring` | Detected recurring payments, with drift % |
| `GET /api/forecast` | 30-day forward forecast + back-test accuracy |
| `GET /api/transactions` | Raw categorised transactions |

## 📈 Forecasting Method — and why it's trustworthy

Linear regression on the trailing 90-day net cash flow, with a moving-average
fallback for volatile periods (day-to-day cash flow is naturally noisy —
salary/rent/EMI land on specific days — so the model checks coefficient of
variation and falls back when a trend line wouldn't be meaningful).

**Back-tested**, not just claimed: the model holds out the last 30 days of
*real* data, predicts blind, and compares:

- **MAE:** ~₹6,850/day
- **Confidence-band coverage:** ~88% of actual outcomes fell within the
  predicted range

## 🎯 Why this isn't "just ChatGPT on a bank statement"

- A raw chatbot can suggest one plausible action; it can't hold 2–3 competing
  futures at once and simulate each forward with consistent assumptions.
- Every number is traceable — recurring-payment drift, forecast confidence,
  and (in the full build) each simulated path all cite the real data behind
  them, not a black-box score.
- Observed, predicted, and recommended are kept visually and structurally
  distinct throughout — never blurred into one "the AI says" answer.

## 🚀 Running Locally

**Backend:**
```bash
pip install -r requirements.txt
cd api
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
## 📋 Requirements

- Python 3.10+ (developed and tested on 3.13)
- Node.js 18+ and npm (developed and tested on Node 24)
- Git
Both must run simultaneously — the frontend calls the backend at the URL
configured in `frontend/src/api.js`.
