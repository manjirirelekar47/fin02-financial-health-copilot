# SpendShield - Data Pipeline & M3 Infrastructure

This repository builds the SpendShield backend data pipelines and infrastructure.

## Data Lineage & Kaggle Datasets

To ensure our active-learning ML models and personas are built on empirical truth, we utilize three real-world Kaggle datasets stored securely in `data/`:

1. **`data.csv` (Indian Personal Finance and Spending Habits)**
   - **Scale:** ~20,000 real Indian household rows.
   - **Schema:** Detailed demographics (`Income`, `Age`, `Occupation`, `City_Tier`) alongside cross-sectional monthly spends (`Rent`, `Groceries`, `Healthcare`, `Desired_Savings`, etc.).
   - **Usage:** Provides the exact categorical split and empirical financial distributions for different personas.

2. **`personal_transactions.csv` & `Personal_Finance_Dataset.csv`**
   - **Scale:** Transaction-level datasets containing raw merchant narrations and spends.
   - **Usage:** Provides real-world linguistic noise, merchant string variants, and category structures to robustly train the NLP Categoriser.

### Data Transformations (M3 Pipeline)

1. **Transaction Mapping (`data/kaggle_transactions_mapped.csv`)**
   - `src/personas/setup_kaggle_and_rbi.py` combines the raw Kaggle transaction files into a unified dataset.
   - It rigorously maps Kaggle-native categories (e.g. `Mortgage & Rent`, `Airfare`, `Coffee Shops`) into the 12 canonical SpendShield categories.
   - The Character n-gram TF-IDF + Calibrated Logistic Regression model uses this dataset directly.

2. **Persona B (Gig Worker) Generator (`src/personas/persona_b_generator.py`)**
   - Persona B dynamically samples its income and expense distributions strictly from the `Occupation == "Self_Employed"` segment of `data.csv`.
   - Instead of inventing fake merchants, the transactions are populated by pulling real merchant descriptions from `kaggle_transactions_mapped.csv`.
   - This ensures Persona B accurately reflects real gig-worker volatility natively found in the Indian macro-economy.

3. **Macro-Economic Calibration (`data/calibration_table.json`)**
   - The simulated data is rigorously calibrated against the **RBI Financial Stability Report (June 2026)** and the **National Health Accounts (2021-22)**.
   - You can verify the live dataset alignment and read the mandatory compliance disclosure by calling `GET /calibration`.

### Round 2 Integration Complete
- **Member 2 Integration**: The Quantile GBDT Twin Model (`src/twin/`), minimum-change optimizer (`src/optimizer.py`), and advanced recurring detector (`src/recurring_detector.py`) have been fully integrated into `api/main.py`.
- **Member 1 UI**: The backend is flawlessly connected to the `ReviewQueueScreen`, `BenchmarkScreen`, `OptimizerScreen`, and `VerifiedAgentChat` React components. All systems are live.

## Account Aggregator-style ingestion (Mock consent)

The Upload Data screen includes a local consent demonstration. It does **not**
connect to a bank, an Account Aggregator, or any external service. After you
create and explicitly approve a consent, the backend imports only the bundled
`fixtures/sample_statement.csv` rows covered by the selected date window. API
responses and the screen identify the source as `Sandbox / test data`.

Available routes:

- `GET /api/aa/sandbox-info` reports the local fixture's date range and row count.
- `POST /api/aa/consents` creates a pending mock consent (`purpose`, optional
  `data_from` and `data_to` dates); no transaction rows are imported yet.
- `POST /api/aa/consents/{consent_id}/approve` approves it and imports matching
  fixture rows into the session identified by `X-Session-ID` (or `session_id`).
- `GET /api/aa/consents` and `GET /api/aa/consents/{consent_id}` read that
  session's consent records.
- `POST /api/aa/consents/{consent_id}/revoke` revokes the mock consent and
  blocks later imports through it. Already imported rows remain in the session
  until the user deletes session data.

Provider-specific request/response fields are intentionally not implemented.
`api/aa_ingestion.py` marks the adapter location where mapping must be based on
the selected provider's published documentation. This demo uses no secrets and
makes no network calls.

Run the focused backend checks with:

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest -q tests/test_aa_ingestion.py
```
