# SpendShield Audit: Tier 1 Checklist & Verification

**Project**: FIN-02 Financial Health Copilot — Team Core Dump  
**Date**: October 2026  
**Audited Against**: SpendShield Build-Now Specification (Final Round) & Simulator Accuracy Plan  

---

## 1. Executive Summary & Verification (Section 2)

Per Section 2 ("Verify first"), the seven core components of the live application were audited and classified as **Works**, **Partly**, or **Missing**:

| Core Component | Status | Code Location | Assessment & Current State |
|---|---|---|---|
| **Monte Carlo simulator and presets** | **Partly** | `src/simulator.py`, `engine/real_engine.py` | Works for cashflow shortfall probability under presets (`cut_spend`, `refinance`, `new_emi`, `medical`), but missing explicit reserve threshold $P(\text{balance} < R)$ per week, common random numbers, and weekly-block resampling for action sequences. |
| **Optimizer** | **Partly** | `src/optimizer.py`, `engine/real_engine.py` | Bounded multi-lever search across category cuts, delay weeks, and tenure restructuring works. Missing the 8-week Linear Program planner (`scipy.optimize.linprog` with HiGHS) with trade-off notes and priority-weighted cuts. |
| **Lock-a-Path and drift alert** | **Works** | `contracts/schemas.py`, `engine/real_engine.py`, `api/main.py`, `frontend/src/components/LockPathScreen.jsx` | Locked paths persist with goal, deadline, band, ceilings, and risk limit; `evaluate_lock` detects drift and computes recovery options. |
| **Live transaction add (`POST /api/transactions`)** | **Works** | `api/main.py`, `engine/real_engine.py`, `frontend/src/App.jsx` | Validates, normalizes, detects duplicates, re-evaluates categorisation and drift in a single refresh call. |
| **CSV and JSON upload and delete-my-data** | **Works** | `api/main.py` (`/api/upload`, `DELETE /api/user-data`), `frontend/src/components/UploadScreen.jsx` | Accepts CSV and JSON statements, supports alias mapping (`narration`/`description`/`memo`), sanitizes non-UTF8/BOM, isolates by session, lists row errors, and cleanly deletes session data. |
| **Agent and claim verifier** | **Works** | `src/agent/chat.py`, `src/agent/tools.py`, `src/agent/verifier.py` | Tool-grounded agent computes exact numbers via Python tools; verifier strips/regenerates unverified numbers. Needs new `plan`, `replan`, and `forecast_report` tools added. |
| **Forecast backtest (MAE and coverage)** | **Partly** | `src/forecast_model.py`, `engine/real_engine.py` | Computes daily cashflow forecast and backtest MAE/RMSE over holdout days. Missing 4-baseline held-out comparison (historical average, recurring-only, moving average, linear regression) reporting MASE, coverage, and interval width. |

---

## 2. Complete Tier 1 Build Checklist (Section 24)

*Legend*:  
- **Layer**: `E` = Stateless Engine, `P` = Product Layer (API / Frontend), `B` = Both.  
- **Status**: `Works` (fully functional and tested), `Partly` (core exists but additions required), `Missing` (to be built).

| No. | Item | Layer | Status | Current Code Base State |
|---|---|:---:|:---:|---|
| 1 | Ingest validation, bad-row list, duplicate detection | E | **Works** | `engine/real_engine.py` (`ingest`), `src/ingestion.py`. Lists row-level errors, rejects none silently, flags duplicates with `is_duplicate`. |
| 2 | One schema and rule-based categoriser with confidence | E | **Works** | `contracts/schemas.py` (`Transaction`), `src/categoriser.py`, `engine/real_engine.py` (`_category`). Computes confidence score and flags `needs_review < 0.60`. |
| 3 | Upload endpoint, template download, preview, use-my-data | P | **Works** | `api/main.py` (`POST /api/upload`, `GET /api/template`), `frontend/src/components/UploadScreen.jsx`. CSV and JSON sample loads seamlessly on live server. |
| 4 | Per-user storage and delete-my-data | P | **Works** | `api/storage.py`, `api/main.py` (`DELETE /api/user-data`). SQLite session-scoped storage clears rows, cached items, and locks. |
| 5 | Live add form and refresh | B | **Works** | `api/main.py` (`POST /api/transactions`), `engine/real_engine.py` (`refresh`), `frontend/src/App.jsx`. Accepts single transaction, updates models, records stopwatch runtime. |
| 6 | Thin-data guard | E | **Works** | `engine/real_engine.py` (`_insufficient`). History < 60 days returns `status: "insufficient_data"` with `min_days` and `history_days`. |
| 7 | Recurring detector on the new schema | E | **Works** | `src/recurring_detector.py`, `engine/real_engine.py` (`_recurring`). Discovers salary, rent, EMIs, and subscriptions using chain-clustering. |
| 8 | Silent Creep | B | **Works** | `src/recurring_detector.py`, `api/main.py` (`GET /api/recurring`), `frontend/src/components/RecurringTable.jsx`. Discovers drift > 5% with `extra_per_month` and `extra_per_year` plus evidence IDs. |
| 9 | Rollover rule | B | **Partly** | Modeled in `contracts/schemas.py` and `mock_engine.py`; needs explicit rule in `real_engine.py` detecting loan credit shortly before EMI/card payment. |
| 10 | Health ratios | E | **Works** | `src/health_ratios.py`, `engine/real_engine.py` (`_health`). DTI, savings rate, buffer months, runway, and EMI-to-income trend flags. |
| 11 | Dashboard and attention panel | P | **Works** | `frontend/src/components/AttentionPanel.jsx`, `HealthMetrics.jsx`. Displays vital signs, attention cards with evidence tags. |
| 12 | Income and expense forecast streams | E | **Partly** | `src/forecast_model.py` and `engine/real_engine.py` forecast net cashflows. Need separate income and expense P10, P50, and P90 forecast streams as required by Addition 2. |
| 13 | Declared method and residual-quantile bands | E | **Partly** | Residual quantiles computed in `engine/real_engine.py`; declared-method card (stating horizon, method, and 80% nominal level) needs to be rendered on the UI. |
| 14 | Baselines and held-out report | E | **Partly** | Holdout backtest exists in `forecast_model.py`, but 4-baseline held-out report (Historical Average, Recurring-Only, Moving Average, Linear Regression) reporting MAE, MASE, coverage, and mean width on untouched test window is missing. |
| 15 | Forecast view | P | **Partly** | `frontend/src/components/ForecastChart.jsx` renders cashflow projections, but declared method card and baseline comparison table are missing. |
| 16 | Reserve-aware simulator | E | **Partly** | `src/simulator.py` computes $P(\text{balance} < 0)$. Needs user-declared reserve $R$ threshold returning $P(\text{balance} < R)$ per week and for any week. |
| 17 | Timed sequences | E | **Partly** | Single presets work (`cut_spend`, `refinance`, `new_emi`), but timed sequences (ordered list of actions with start/end weeks and 8-week PeriodRow rollups) need to be implemented. |
| 18 | Shock Capacity | E | **Works** | `src/simulator.py` (`calculate_shock_capacity`), `engine/real_engine.py`. Computes largest absorbable shock; needs to measure against reserve $R$. |
| 19 | Ranking, safest/cheapest toggle, tags | B | **Partly** | Tags (`observed`, `predicted`, `recommended`) exist; UI toggle between safest and cheapest ranking needs to be linked to action sequences. |
| 20 | Simulate screen | P | **Works** | `frontend/src/components/SimulateScreen.jsx` & `DecisionSimulator.jsx`. Three-path comparison and Shock Capacity card. |
| 21 | Priority assignment and payment order | E | **Works** | `contracts/schemas.py` (`Priority`), `engine/real_engine.py` (`_PRIORITIES`). Categorical defaults: Critical, High, Medium, Low. |
| 22 | Priority List screen | P | **Works** | `frontend/src/components/PriorityCalendarScreen.jsx`. Editable, sortable, and filterable transaction list. |
| 23 | Planner with trade-off notes | E | **Partly** | `src/optimizer.py` implements bounded search; needs the 8-week Linear Program planner (`scipy.optimize.linprog` with HiGHS) with trade-off notes per period. |
| 24 | Plan screen | P | **Partly** | `frontend/src/components/OptimizerScreen.jsx` exists, but 8-week period table, sequence comparison tabs, and why-line from Plan Builder F6 need to be completed. |
| 25 | Lock and storage | B | **Works** | `contracts/schemas.py` (`LockedPath`), `api/storage.py`, `frontend/src/components/LockPathScreen.jsx`. Persists goal, deadline, band, ceilings, and risk limit. |
| 26 | Plan-drift alert | B | **Works** | `engine/real_engine.py` (`evaluate_lock`), `DriftResult`. Compares success probability before vs now with delay and recovery actions. |
| 27 | Replan, infeasibility, relaxations | E | **Partly** | Recovery suggestions exist; linear program conflict detection (slack amounts, infeasibility triggers, and relaxation options) needs to be added. |
| 28 | Lock screen and recovery options | P | **Works** | `frontend/src/components/LockPathScreen.jsx` renders lock parameters, drift warnings, and recovery actions. |
| 29 | Agent tools including plan, replan, forecast_report | B | **Partly** | `src/agent/tools.py` has tools for metrics, simulate, and shock capacity; new tools `plan`, `replan`, and `forecast_report` need to be exposed. |
| 30 | Claim verifier | P | **Works** | `src/agent/verifier.py`. Scans numbers in replies and verifies against tool output dictionaries. |
| 31 | Chat UI | P | **Works** | `frontend/src/components/VerifiedAgentChat.jsx`. Grounded chat interface with verification pill and tool traces. |
| 32 | Persona B, three seeds, assumptions file | E | **Partly** | `persona_b_transactions.csv` exists with 6 months; needs full 36-month generation in three runs (Train M1-20, Val M21-24, Test M25-36), `assumptions.md`, and leakage unit test. |
| 33 | Five required cases | E | **Missing** | Script executing and verifying the 5 required cases (Stable income, Income reduction, Unexpected expense, Infeasible target, Uncertainty changes plan) from a single command. |
| 34 | 12 to 15 labelled scenarios | E | **Works** | `tests/scenarios/test_scenarios.py`. Evaluates 15 labelled transactions (safe, risky, borderline) asserting match rate >= 80% and false positive rate <= 20%. |
| 35 | Stopwatch harness | E | **Works** | `engine/stopwatch.py`. Records exact execution times for ingestion, analysis, and simulation. |
| 36 | Evidence Pack | E | **Missing** | Generation script creating `plan_periods.csv`, `constraints.json`, `forecasts.csv`, `outcomes.csv`, `baseline_comparison.csv`, and `timeline.md`. |
| 37 | Contracts v1, MockEngine and RealEngine, contract test in CI | B | **Partly** | `contracts/schemas.py` and `contracts/engine_protocol.py` exist; needs expansion with Addition 1 & 2 schemas (`ForecastReport`, `PeriodRow`, `Plan`, `ConflictReport`), fixtures, and contract CI test. |
| 38 | Deployment, keep-alive ping, warm-up before demos | P | **Works** | FastAPI liveness endpoints `GET /api/health` and `GET /`. |
| 39 | README, demo video, claim-safe slides | P | **Partly** | `README.md` exists; needs audit table and claim-safe terminology alignment. |

---

## 3. Multi-Horizon Checklist Additions (Section 34)

| No. | Item | Layer | Status | Current Code Base State |
|---|---|:---:|:---:|---|
| 40 | 52-week daily simulation, cached per user and sequence | E | **Missing** | To be built in Workstream C/Addition 2. |
| 41 | Aggregation to week, month, six-month and year | E | **Missing** | Aggregation utility rolling daily paths to weekly and monthly periods. |
| 42 | Monthly planner with 6 and 12 periods | E | **Missing** | To be added to LP planner. |
| 43 | Weekly and monthly consistency test | E | **Missing** | Unit test verifying overlapping months agree within 5%. |
| 44 | Per-horizon evidence table | E | **Missing** | Three horizon buckets (1–8w, 9–26w, 27–52w) with origins and metrics. |
| 45 | Grade labels (Decision-grade, Planning-grade, Indicative) | B | **Missing** | Schema and UI badge definitions. |
| 46 | View switcher on Plan, Forecast and Dashboard | P | **Missing** | Frontend view switcher (Weekly, Monthly, 6-Month, Yearly). |
| 47 | Six-month summary card | P | **Missing** | Dashboard top card showing closing band, lowest balance, and breach probability. |
| 48 | Views in the demo | P | **Missing** | Switching views during case demonstrations. |

---

## 4. Phase-by-Phase Plan

1. **Phase 1: Audit & Contracts (Current Phase)**:
   - Audit complete (`AUDIT.md`).
   - Freeze `contracts/schemas.py` with `ForecastReport`, `PeriodRow`, `Sequence`, `Plan`, `ConflictReport`, `SixMonthSummary`, `reserve` on `LockedPath`, and `reserve_breach_prob` on `SimulationResult`.
   - Update `contracts/engine_protocol.py` with `plan`, `replan`, `forecast_report`.
   - Add contract fixtures in `fixtures/` (`plan.two_sequences.json`, `plan.infeasible.json`, `forecast_report.json`).
   - Implement methods on `MockEngine` returning fixtures.
   - Add comprehensive contract tests in `tests/test_contracts.py`.
2. **Phase 2: Data Generators, Seeds & Leakage Protection (Day 1 / Workstream A)**:
   - Build 36-month Persona B generator and regenerate Persona A/B with 3 seeds: Train (M1–20), Val (M21–24), Test (M25–36).
   - Write `assumptions.md`.
   - Add unit test proving test data is never read during training/tuning.
3. **Phase 3: Probabilistic Forecast & 4-Baseline Held-Out Evaluation (Day 2-3 / Workstream B)**:
   - Separate income and expense streams with residual quantile bands (P10/P50/P90).
   - Compute 4 baselines on held-out test window (Historical Average, Recurring-Only, Moving Average, Linear Regression) with MAE, MASE, coverage, and width.
4. **Phase 4: Simulator Upgrade & LP Plan Builder (Day 3-4 / Workstreams C, D & E)**:
   - Reserve-aware Monte Carlo ($P(\text{balance} < R)$) with common random numbers and why-line.
   - 8-week Linear Program planner with `scipy.optimize.linprog` (HiGHS) and trade-off notes.
   - Replan with conflict detection and relaxation options.
5. **Phase 5: Agent Tools, Evidence Pack & 5 Required Cases (Day 5 / Workstreams F & Evidence)**:
   - Wire `plan`, `replan`, `forecast_report` into agent tools.
   - Script reproducing 5 required cases and generating Evidence Pack CSVs/JSONs.
