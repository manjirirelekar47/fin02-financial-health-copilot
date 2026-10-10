# SpendShield Synthetic Data Assumptions & Calibration Table

**Project**: FIN-02 Financial Health Copilot — Team Core Dump  
**Document**: `assumptions.md` (Workstream A Specification)  
**Standard**: 36-Month Train-Validation-Test Timeline with Separate Fixed Seeds  

---

## 1. Train-Validation-Test Split Architecture

To prevent data contamination and ensure valid empirical evaluation, data generation and model development are partitioned into three strictly separated time windows:

| Split Window | Month Range | Calendar Dates | Persona A Seed | Persona B Seed | Purpose |
|---|---|---|:---:|:---:|---|
| **Train** | Months 1 to 20 | 2024-01-01 to 2025-08-31 | `42` | `101` | Feature extraction, categoriser training, baseline fitting |
| **Validation** | Months 21 to 24 | 2025-09-01 to 2025-12-31 | `43` | `102` | Model selection, hyperparameter tuning, residual quantile calibration |
| **Test (Held-Out)** | Months 25 to 36 | 2026-01-01 to 2026-12-31 | `44` | `103` | **Held-out untouched evaluation only** (MAE, MASE, 80% coverage, interval width) |

> [!IMPORTANT]
> The test window is **never read or accessed** during training or parameter tuning. This invariant is actively verified in CI by `tests/test_leakage.py`.

---

## 2. Parameter Assumptions & Calibration Benchmarks Table

Each generative parameter is mapped to its statistical model, its Persona A & B values, and the published empirical benchmark it is calibrated to:

| Parameter | Persona A (Salaried) | Persona B (Gig / Self-Employed) | Mathematical Distribution / Process | Calibration Target & Published Statistic | Source & Year | Source URL |
|---|---|---|---|---|---|---|
| **Income Process** | Predictable monthly salary (₹68k–₹76k on 1st of month with annual increments) | Two-regime mixture model: Normal (₹70k–₹95k over 3–5 payouts) vs Lean (₹20k–₹38k over 1–2 payouts; occasional zero-income weeks) | Deterministic step + Gaussian jitter (A); Markov/Mixture Regime model $P(\text{lean}) = 0.25$ with uniform chunking (B) | Calibrated to formal salaried payroll vs informal gig worker income volatility in urban India | Periodic Labour Force Survey (PLFS) / NSO (2022-23) | [PLFS Report](https://mospi.gov.in/sites/default/files/publication_reports/Annual_Report_PLFS_2022-23.pdf) |
| **Debt Obligations (EMI)** | Rising EMI burden: ₹12,000 stepping up to ₹26,000 monthly (DTI climbing from 17% to 34%) | Fixed Personal Loan EMI: ₹9,500 monthly due on 7th | Fixed step ladder with date jitter (A); Fixed schedule with payment-day noise (B) | Household debt service ratio calibrated to retail credit expansion; DSR threshold benchmark: 12.0% | RBI Financial Stability Report (2023) | [RBI FSR](https://rbi.org.in/Scripts/AnnualReportPublications.aspx) |
| **Housing / Lease** | Residential Rent: ₹18,000 on 3rd of month | Co-working / Office Desk: ₹8,500 on 4th of month | Deterministic calendar debit | Urban metro middle-income rental allocation (24%–26% of baseline income) | Knight Frank India Real Estate Report (2023) | [Knight Frank Report](https://www.knightfrank.co.in/research) |
| **Recurring Subscriptions** | Netflix (₹199), Spotify (₹119), Cult.fit (₹1,499) on ~10th | AWS Cloud (₹2,800), Adobe CC (₹4,200), GitHub (₹850) on ~12th | Fixed periodic debits with price drift $\sim U(0.97, 1.03)$ | Subscription economy penetration in urban digital professionals; Silent Creep trigger > 5% drift | Razorpay India Digital Payments Report (2023) | [Razorpay Payments Report](https://razorpay.com/reports/) |
| **Utility Expenses** | Electricity, broadband, piped gas: ₹2,300–₹3,800 total | Fiber broadband, electricity: ₹2,600–₹3,400 total | Usage-based uniform bounded distribution $\sim U(\text{low}, \text{high})$ | Monthly urban domestic energy & utility consumption | Ministry of Power / CEA Domestic Tariff Survey (2023) | [CEA Power Data](https://cea.nic.in/) |
| **Discretionary Spending** | 10 to 16 transactions/month (₹200–₹2,400 per txn; food delivery, shopping, cinema) | 8 to 14 transactions/month (scales down to ₹150–₹1,200 in lean months) | Truncated lognormal spend with Poisson event arrivals | Private Final Consumption Expenditure (PFCE) discretionary share (~25% of disposable income) | MoSPI National Accounts Statistics (2023) | [MoSPI Accounts](https://mospi.gov.in/) |
| **Surprise Shocks (Health / Repair)** | Medical or travel emergency (p = 0.20 per month; ₹2,500 to ₹35,000) | Laptop repair or diagnostic medical tests (p = 0.22 per month; ₹1,800 to ₹42,000) | Heavy-tailed lognormal distribution $\text{Lognormal}(\mu=\ln(7500), \sigma=0.45)$ | Out-of-pocket (OOP) health expenditure equals 39.4% of total health spend; causes sudden buffer depletion | National Health Accounts (NHA) (2021-22) / PIB | [NHA Release PRID 2058564](https://pib.gov.in/PressReleasePage.aspx?PRID=2058564) |
| **Liquid Savings Buffer** | Initial buffer: ₹52,000 (declining over time under rising EMI) | Initial buffer: ₹38,000 (volatile across lean and surge months) | Reserve floor target $R = \text{1 month Critical expenses}$; benchmark target: 3.0 months | Indian household emergency reserve benchmark: 3.0 months of essential expenses | RBI Financial Stability Report (2023) | [RBI Benchmark](https://rbi.org.in/Scripts/AnnualReportPublications.aspx) |
| **Noise & Day Jitter** | Date jitter: $\pm 1$ day on EMIs/subscriptions; Amount noise: $\pm 2\%$ on recurring | Payout timing jitter: uniform across calendar month; Transaction noise: $\pm 5\%$ | Discrete jitter $J \in \{-1, 0, 1\}$; Continuous noise $N \sim U(0.98, 1.02)$ | Payment processing day variances, weekend banking settlement lags | NPCI UPI Settlement Guidelines (2023) | [NPCI UPI Standards](https://www.npci.org.in/) |

---

## 3. Persona Behavioral Profiles

### Persona A (Salaried, Rising Debt Burden)
- **Profile**: Mid-level IT employee with stable, non-stochastic income.
- **Narrative**: Regular salary allows initial confidence, but escalating personal and credit obligations steadily push Debt-to-Income (DTI) from 17% past the danger threshold (30%+). Discretionary discipline erodes slightly over time.
- **Goal in System**: Demonstrates why simple historical income averages fail when obligation drift (Silent Creep and rising EMIs) shrinks the net cashflow corridor.

### Persona B (Self-Employed, Gig Volatility)
- **Profile**: Freelance consultant / designer with irregular contract settlements.
- **Narrative**: Income arrives in discrete, volatile pulses across the month. 1 out of every 4 months is a "lean month" where client billings drop by 50% or face multi-week payment delays.
- **Goal in System**: Demonstrates the failure of symmetric normal/bell-shaped forecasting assumptions and proves why quantile-based planning (P25 planning income, P10 reserve floors) protects gig workers from insolvency.

---

## 4. Leakage Invariant Rules

1. **Isolation Rule**: Training pipelines (`train_model()`, `categorise_dataframe()`, `calibrate()`) are restricted to `data/splits/persona_*_train.csv` and `persona_*_val.csv`.
2. **Date Guard Rule**: Any record with `date >= 2026-01-01` (Month 25 onwards) is rejected by `assert_no_test_leakage()`.
3. **Execution Proof**: `tests/test_leakage.py` verifies both personas load through `ingest`, confirms strict split isolation, and asserts that attempting to read test data without explicit authorization raises `DataLeakageError`.
