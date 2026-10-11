import os
import numpy as np
import pandas as pd

from api.schemas import (
    SimulatorRequest, SimulatorPathOutput, ElementTag, DataState,
    DailyForecast, SimulatorPreset, SimulatorPriority, BufferQuantiles,
    SimulatorResponse
)

# Note: The Twin model (src.twin.twin_model) provides forecasting via its
# forecast() function but does not expose the get_obligations/get_residuals
# interface that this module's adapter originally expected.  The Round-1
# fallback below (recurring detector + income analysis) is therefore the
# correct production path for building simulator obligations/residuals.
twin_forecast = None

# Round 1 Fallbacks
import src.forecast_model as fm
import src.recurring_detector as rd
import src.health_ratios as hr


def get_model_components(df: pd.DataFrame):
    """
    Fallback / Adapter logic.
    Check if src/twin exists; if not, use Round 1 files to get
    deterministic recurring obligations and daily discretionary residuals.
    """
    # If history is < 14 days, return DataState.insufficient_data
    if len(df["date"].drop_duplicates()) < 14:
        return DataState.insufficient_data, None, None

    if twin_forecast is not None:
        return DataState.ok, twin_forecast.get_obligations(df), twin_forecast.get_residuals(df)

    # 1. Deterministic recurring obligations
    recurring_df = rd.detect_recurring_payments(df)
    obligations = []
    recurring_merchants = set()
    
    if not recurring_df.empty:
        for _, row in recurring_df.iterrows():
            obligations.append({
                "name": row["merchant"],
                "amount": row["last_amount"],
                "interval_days": row["avg_interval_days"],
                "last_date": pd.to_datetime(row["last_seen"]),
                "type": row["recurring_type"],
                "flow": -1
            })
            recurring_merchants.add(row["merchant"])
            
    # Incomes (deterministic credit)
    incomes = df[df["category"] == "Income"].sort_values("date")
    if not incomes.empty:
        last_date = incomes.iloc[-1]["date"]
        amt = incomes["amount"].mean()
        diffs = incomes["date"].diff().dropna().dt.days
        interval = diffs.mean() if not diffs.empty else 30
        obligations.append({
            "name": "Salary",
            "amount": amt,
            "interval_days": max(interval, 1),
            "last_date": last_date,
            "type": "Income",
            "flow": 1
        })

    # 2. Daily discretionary residuals
    if recurring_merchants:
        disc_df = df[~((df["merchant"].isin(recurring_merchants)) & (df["type"] == "debit"))]
    else:
        disc_df = df
        
    disc_df = disc_df[disc_df["category"] != "Income"].copy()
    
    if not disc_df.empty:
        daily_disc = fm.compute_daily_net_cashflow(disc_df)
        # Resample to make sure we have continuous daily series
        daily_disc = daily_disc.set_index("date").resample("1D").sum().fillna(0)
        residuals = daily_disc["net_cashflow"].values
    else:
        residuals = np.zeros(30)
        
    return DataState.ok, obligations, residuals


def generate_monte_carlo_paths(obligations: list, residuals: np.ndarray, start_date: pd.Timestamp, num_paths=1000, horizon=90) -> np.ndarray:
    """
    Run 1,000 paths over a 90-day horizon using numpy.random.default_rng(seed=42).
    Keeps known recurring obligations fixed on scheduled dates, and resamples 
    the uncertain discretionary remainder from model residuals in 7-day weekly blocks.
    """
    rng = np.random.default_rng(seed=42)
    
    # Place deterministic obligations on exact scheduled dates
    deterministic_cashflow = np.zeros(horizon)
    for obs in obligations:
        interval = max(int(obs["interval_days"]), 1)
        current_date = obs["last_date"] + pd.Timedelta(days=interval)
        
        # Fast-forward to the simulation start date
        while current_date < start_date:
            current_date += pd.Timedelta(days=interval)
            
        # Project forward for the horizon length
        while current_date < start_date + pd.Timedelta(days=horizon):
            day_idx = (current_date - start_date).days
            if 0 <= day_idx < horizon:
                deterministic_cashflow[day_idx] += obs["amount"] * obs["flow"]
            current_date += pd.Timedelta(days=interval)
            
    # Weekly 7-day blocks resampling
    n_residuals = len(residuals)
    block_size = 7
    if n_residuals < block_size:
        blocks = [residuals] if n_residuals > 0 else [np.zeros(7)]
    else:
        num_blocks = n_residuals - block_size + 1
        blocks = [residuals[i:i+block_size] for i in range(num_blocks)]
        
    paths = []
    num_blocks_needed = int(np.ceil(horizon / block_size))
    for _ in range(num_paths):
        # Sample weekly blocks with replacement
        chosen_blocks = rng.choice(blocks, size=num_blocks_needed, replace=True)
        if len(chosen_blocks) > 0:
            sim_residuals = np.concatenate(chosen_blocks)[:horizon]
        else:
            sim_residuals = np.zeros(horizon)
            
        # Combine deterministic and discretionary 
        paths.append(deterministic_cashflow + sim_residuals)
        
    return np.array(paths)


def compute_emi(principal: float, annual_rate: float, months: int) -> float:
    if annual_rate == 0:
        return principal / months
    r = annual_rate / 12.0
    return principal * r * ((1 + r)**months) / (((1 + r)**months) - 1)


def simulate_scenario(preset: SimulatorPreset, obligations: list, residuals: np.ndarray, 
                      start_date: pd.Timestamp, initial_balance: float, avg_monthly_expenses: float,
                      request: SimulatorRequest) -> SimulatorPathOutput:
    """
    Core function mapping each scenario rule onto the simulated paths.
    """
    obs = [o.copy() for o in obligations]
    res = residuals.copy()
    initial_shock = 0.0
    
    # Fallback to standard scenario amounts if not provided by user
    p = request.custom_amount if request.custom_amount is not None else 100000.0
    n = request.custom_months if request.custom_months is not None else 36
    r = 0.12 # 12% default rate for new borrowing
    
    # 1. Apply scenario definitions
    if preset == SimulatorPreset.cut_spend:
        res = res * 0.80 # Default reduce discretionary by 20%
        
    elif preset == SimulatorPreset.refinance:
        new_emi = compute_emi(p, r, n)
        emis = [o for o in obs if o["type"] == "EMI"]
        if emis:
            emis.sort(key=lambda x: x["amount"], reverse=True)
            emis[0]["amount"] = new_emi
            
    elif preset == SimulatorPreset.buy_or_new_emi:
        if request.custom_months and request.custom_months > 1:
            new_emi = compute_emi(p, r, n)
            obs.append({
                "name": "New EMI", "amount": new_emi, "interval_days": 30,
                "last_date": start_date, "type": "EMI", "flow": -1
            })
        else:
            initial_shock = -p
            
    elif preset == SimulatorPreset.medical_emergency:
        initial_shock = -p
        
    elif preset == SimulatorPreset.income_drop_30:
        for o in obs:
            if o["type"] == "Income":
                o["amount"] *= 0.70
                
    elif preset == SimulatorPreset.job_loss:
        for o in obs:
            if o["type"] == "Income":
                o["amount"] = 0.0
                
    elif preset == SimulatorPreset.emi_hike_12:
        for o in obs:
            if o["type"] == "EMI":
                o["amount"] *= 1.12
                
    # 2. Run Engine
    paths = generate_monte_carlo_paths(obs, res, start_date, num_paths=1000, horizon=90)
    
    # 3. Compile output metrics
    cumulative_paths = initial_balance + initial_shock + np.cumsum(paths, axis=1)
    
    # P(Shortfall) within 90 days
    shortfall_paths = np.any(cumulative_paths < 0, axis=1)
    shortfall_prob_90d = float(np.mean(shortfall_paths))
    
    # Buffers at end of 90 days
    end_buffers = cumulative_paths[:, -1]
    p10_buf, p50_buf, p90_buf = np.percentile(end_buffers, [10, 50, 90])
    
    # Survival runway
    runways = []
    for row in cumulative_paths:
        neg_indices = np.where(row < 0)[0]
        if len(neg_indices) > 0:
            runways.append(neg_indices[0])
        else:
            runways.append(90)
    survival_runway_days = int(np.median(runways))
    
    months_of_expenses_buffer = float(p50_buf / avg_monthly_expenses) if avg_monthly_expenses > 0 else 99.9
    goal_delay_weeks = int(shortfall_prob_90d * 10) # rough proxy
    
    total_income = sum(o["amount"] * (30.0 / max(o["interval_days"], 1)) for o in obs if o["type"] == "Income" and o["flow"] > 0)
    total_debt = sum(o["amount"] * (30.0 / max(o["interval_days"], 1)) for o in obs if o["type"] == "EMI" and o["flow"] < 0)
    new_dti = float(total_debt / total_income) if total_income > 0 else 0.0
    
    new_borrowing_prob_90d = shortfall_prob_90d
    rollover_warning = bool(shortfall_prob_90d > 0.5)
    
    return SimulatorPathOutput(
        preset=preset,
        shortfall_prob_90d=round(shortfall_prob_90d, 4),
        buffer=BufferQuantiles(p10=round(p10_buf, 2), p50=round(p50_buf, 2), p90=round(p90_buf, 2)),
        survival_runway_days=survival_runway_days,
        months_of_expenses_buffer=round(months_of_expenses_buffer, 2),
        goal_delay_weeks=goal_delay_weeks,
        new_dti=round(new_dti, 4),
        new_borrowing_prob_90d=round(new_borrowing_prob_90d, 4),
        rollover_warning=rollover_warning,
        one_line_reason=f"{preset.value.replace('_', ' ').capitalize()}: {shortfall_prob_90d*100:.0f}% chance of a cash gap."
    )


def simulate_decision(df: pd.DataFrame, request: SimulatorRequest):
    """
    Top-level API method handling a full decision simulation request.
    """
    state, obligations, residuals = get_model_components(df)
    
    if state == DataState.insufficient_data:
        return state # Short-circuit returns if history length too low
        
    df["signed_amount"] = np.where(df["type"] == "credit", df["amount"], -df["amount"])
    initial_balance = df["signed_amount"].sum()
    
    days_in_history = max((df["date"].max() - df["date"].min()).days, 1)
    avg_monthly_expenses = df[df["type"] == "debit"]["amount"].sum() / (days_in_history / 30.0)
    
    start_date = df["date"].max() + pd.Timedelta(days=1)
    
    path_outputs = []
    
    # Process all requested simulation modes
    for preset in request.presets:
        out = simulate_scenario(preset, obligations, residuals, start_date, initial_balance, avg_monthly_expenses, request)
        path_outputs.append(out)
        
    # Rank paths depending on strategy requested
    if request.priority == SimulatorPriority.safest:
        path_outputs.sort(key=lambda x: (x.shortfall_prob_90d, -x.buffer.p50))
    else:
        # Cheapest: prioritize max median buffer
        path_outputs.sort(key=lambda x: (-x.buffer.p50, x.shortfall_prob_90d))
        
    recommended = path_outputs[0].preset if path_outputs else SimulatorPreset.do_nothing
    
    # Enhance reasoning with baseline comparison when available
    do_nothing_prob = next((p.shortfall_prob_90d for p in path_outputs if p.preset == SimulatorPreset.do_nothing), None)
    if do_nothing_prob is not None:
        for p in path_outputs:
            if p.preset != SimulatorPreset.do_nothing:
                p.one_line_reason = f"{p.preset.value.replace('_', ' ').capitalize()}: {p.shortfall_prob_90d*100:.0f}% chance of a cash gap vs {do_nothing_prob*100:.0f}% if you do nothing."
                
    return SimulatorResponse(
        recommended_path=recommended,
        paths=path_outputs
    )
