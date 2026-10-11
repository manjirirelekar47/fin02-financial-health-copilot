# SpendShield Chronological Audit Trail & Decision Timeline

---

## 1. Baseline Data & Calibration (Months 1–24)
- **Train Window (Months 1–20)**: Historical transactions ingested; rule-based categoriser calibrated (95% rule confidence, TF-IDF fallback, <60% needs-review queue).
- **Validation Window (Months 21–24)**: Model selection benchmark conducted between Moving Average and Linear Regression. Leakage test guarantees test window was untouched.
- **Calibration Benchmarks**: Indian benchmarks loaded from RBI Financial Stability Report (June 2026) and National Health Accounts (2021-22).

---

## 2. Held-Out Evaluation (Months 25–36)
- **4 Baselines Benchmarked**: Historical Average, Recurring-Payment-Only, Moving Average, Linear Regression.
- **Evaluated Horizons**:
  - **1 to 8 weeks** (12 rolling origins): Decision-grade (MAE, MASE, 80% coverage).
  - **9 to 26 weeks** (6 rolling origins): Planning-grade.
  - **27 to 52 weeks** (1 rolling origin): Indicative.

---

## 3. Plan Generation (8-Week LP with Common Random Numbers)
- **Initial Buffer**: Opening balance Rs 503,658 (Persona A) / Rs 60,000 (Persona B).
- **LP Formulation**: HiGHS solver allocates weekly discretionary spend (`x_low`, `x_med`), savings (`s`), and debt prepayments (`p`).
- **Sequences Evaluated**:
  - `S0 Hold steady`: Unmodified baseline forecast.
  - `S1 Trim and save first`: Prioritizes emergency fund accumulation.
  - `S2 Trim and repay debt first`: Accelerates principal repayment.
- **Noise-Free Scoring**: Evaluated across 1,000 paths using Common Random Numbers (CRN) with fixed seed `42`.

---

## 4. Shock Handling & Infeasibility Detection
- **Case 2 (30% Income Drop)**: Planner reruns from current week on rolling 8-week horizon; adapts discretionary budget to protect reserve floor.
- **Case 3 (Surprise Rs 25,000 Medical Debit)**: Essential debit absorbed; non-negotiable debt payments (Critical) 100% honored.
- **Case 4 (Infeasible Rs 300,000 Goal)**: Slack variables identify Rs 250,000 goal shortfall and Rs 93,714 reserve deficit. Yields 4 re-solved relaxation options.
- **Case 5 (Uncertainty Changes Preference)**: Under Persona B volatility, S0 median (Rs 66,301) loses to S1 (7.5% breach risk vs S0's 45.4% breach risk). Lower-risk plan recommended with why-line.

---

## 5. Multi-Horizon Integration
- **Weekly (8 periods)**: Decision-grade operational cashflow.
- **Monthly (6 periods)**: Planning-grade medium-term trajectory. Weekly flows strictly sum to month totals.
- **Six-Month Summary**: Planning-grade executive dashboard widget.
- **Yearly (12 months)**: Indicative long-range outlook.
