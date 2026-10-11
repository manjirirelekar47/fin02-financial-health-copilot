import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from src.forecast_model import (
    trailing_90_days, 
    fit_linear_forecast, 
    moving_average_fallback,
    compute_daily_net_cashflow
)
from src.recurring_detector import detect_recurring_payments

def generate_deterministic_forecast(daily_df, recurring_df, forecast_days=30):
    end_date = daily_df["date"].max()
    future_dates = pd.date_range(end_date + pd.Timedelta(days=1), periods=forecast_days)
    forecast = pd.DataFrame({"date": future_dates, "deterministic_cashflow": 0.0})
    
    # Very simple: just map known recurrences to future dates based on average interval
    # In a real system we'd project using last_seen + avg_interval_days
    for _, row in recurring_df.iterrows():
        # Using last amount, assume negative for outgoing (debit) or positive for income (credit)
        # Wait, recurring_detector groups debits only currently? Yes, `debits = df[df["type"] == "debit"]`.
        # So we only have recurring debits.
        amount = -row["last_amount"]
        interval = row["avg_interval_days"]
        last_seen = pd.to_datetime(row["last_seen"])
        
        # Project forward
        next_date = last_seen + pd.Timedelta(days=interval)
        while next_date <= forecast["date"].max():
            if next_date >= forecast["date"].min():
                # Assign to nearest date in forecast
                idx = (forecast["date"] - next_date).abs().idxmin()
                forecast.loc[idx, "deterministic_cashflow"] += amount
            next_date += pd.Timedelta(days=interval)
            
    return forecast

def extract_features(df):
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])
    df['day_of_week'] = df['date'].dt.dayofweek
    df['day_of_month'] = df['date'].dt.day
    df['month_end_flag'] = df['date'].dt.is_month_end.astype(int)
    
    # simplified "days to salary" (distance to next 1st of month)
    df['days_to_salary'] = df['date'].apply(
        lambda d: (d.replace(day=1) + pd.DateOffset(months=1) - d).days if d.day != 1 else 0
    )
    
    df['rolling_7_mean'] = df['net_cashflow'].rolling(7, min_periods=1).mean()
    df['rolling_30_mean'] = df['net_cashflow'].rolling(30, min_periods=1).mean()
    
    df = df.fillna(0)
    features = ['day_of_week', 'day_of_month', 'month_end_flag', 'days_to_salary', 'rolling_7_mean', 'rolling_30_mean']
    return df, features

class TwinModel:
    def __init__(self):
        self.models = {
            0.1: GradientBoostingRegressor(loss='quantile', alpha=0.1, random_state=42),
            0.5: GradientBoostingRegressor(loss='quantile', alpha=0.5, random_state=42),
            0.9: GradientBoostingRegressor(loss='quantile', alpha=0.9, random_state=42)
        }
        self.q_hat = 0
        
    def fit_predict(self, window_df, forecast_days=30):
        # We need a calibration set for split conformal prediction. 80/20 split.
        df, features = extract_features(window_df)
        X = df[features]
        y = df['variable_remainder']
        
        n = len(X)
        split_idx = int(n * 0.8)
        X_train, y_train = X.iloc[:split_idx], y.iloc[:split_idx]
        X_cal, y_cal = X.iloc[split_idx:], y.iloc[split_idx:]
        
        for alpha, model in self.models.items():
            model.fit(X_train, y_train)
            
        preds_10 = self.models[0.1].predict(X_cal)
        preds_90 = self.models[0.9].predict(X_cal)
        
        scores = np.maximum(preds_10 - y_cal, y_cal - preds_90)
        
        alpha_conf = 0.2 # 80% coverage
        n_cal = len(y_cal)
        q_level = min(np.ceil((n_cal + 1) * (1 - alpha_conf)) / n_cal, 1.0)
        self.q_hat = np.quantile(scores, q_level)
        
        # Now predict for future
        end_date = df["date"].max()
        future_dates = pd.date_range(end_date + pd.Timedelta(days=1), periods=forecast_days)
        # Seed future with the last known rolling means from training data so
        # the GBDT receives meaningful context features instead of zeros.
        last_rolling_7 = df['rolling_7_mean'].iloc[-1] if 'rolling_7_mean' in df.columns else 0
        last_rolling_30 = df['rolling_30_mean'].iloc[-1] if 'rolling_30_mean' in df.columns else 0
        future_df = pd.DataFrame({"date": future_dates, "net_cashflow": last_rolling_7})
        future_df, _ = extract_features(future_df)
        # Override rolling means with carried-forward values from training window
        future_df['rolling_7_mean'] = last_rolling_7
        future_df['rolling_30_mean'] = last_rolling_30
        X_future = future_df[features]
        
        preds_50 = self.models[0.5].predict(X_future)
        preds_10 = self.models[0.1].predict(X_future)
        preds_90 = self.models[0.9].predict(X_future)
        
        calibrated_10 = preds_10 - self.q_hat
        calibrated_90 = preds_90 + self.q_hat
        
        return pd.DataFrame({
            "date": future_dates,
            "pred_remainder": preds_50,
            "pred_remainder_low": calibrated_10,
            "pred_remainder_high": calibrated_90
        })

def auto_forecast(raw_transactions_df, holdout_days=30, forecast_days=30):
    # Detect recurring
    # Note: categorization is assumed to be done or not strictly needed if we just pass the whole df
    # Let's mock a simple categorical column if missing
    if "type" not in raw_transactions_df.columns:
        raw_transactions_df["type"] = "debit"
    
    recurring_df = detect_recurring_payments(raw_transactions_df)
    daily_df = compute_daily_net_cashflow(raw_transactions_df)
    
    # Create deterministic historical track
    # For history, we just subtract recurring transactions on their actual dates to get remainder.
    # To keep it simple, we'll just subtract the daily total of recurring transactions.
    
    # (Simplified for now: we just use the twin model directly on net_cashflow as a baseline if remainder logic gets too complex)
    daily_df['variable_remainder'] = daily_df['net_cashflow'] 
    
    cutoff = daily_df["date"].max() - pd.Timedelta(days=holdout_days)
    train = daily_df[daily_df["date"] <= cutoff]
    
    actual = daily_df[daily_df["date"] > cutoff]["net_cashflow"].values
    eval_days = len(actual)
    
    # 1. Moving average
    window = trailing_90_days(train, cutoff)
    ma_preds = moving_average_fallback(window, forecast_days=eval_days)
    
    # 2. Linear Regression
    lr_preds, _ = fit_linear_forecast(window, forecast_days=eval_days)
    
    # 3. Twin Model
    twin = TwinModel()
    twin_preds_df = twin.fit_predict(window, forecast_days=eval_days)
    twin_preds = twin_preds_df["pred_remainder"].values
    
    # Evaluate on holdout
    ma_mae = np.abs(actual - ma_preds).mean()
    lr_mae = np.abs(actual - lr_preds).mean()
    twin_mae = np.abs(actual - twin_preds).mean()
    
    best_mae = min(ma_mae, lr_mae, twin_mae)
    
    # Re-train best model on full data for final forecast
    full_window = trailing_90_days(daily_df, daily_df["date"].max())
    
    if best_mae == ma_mae:
        model_name = "Moving Average"
        preds = moving_average_fallback(full_window, forecast_days=forecast_days)
        std_dev = full_window["net_cashflow"].std()
        low = preds - std_dev
        high = preds + std_dev
    elif best_mae == lr_mae:
        model_name = "Linear Regression"
        preds, _ = fit_linear_forecast(full_window, forecast_days=forecast_days)
        std_dev = full_window["net_cashflow"].std()
        low = preds - std_dev
        high = preds + std_dev
    else:
        model_name = "Twin Model"
        twin_final = TwinModel()
        res = twin_final.fit_predict(full_window, forecast_days=forecast_days)
        preds = res["pred_remainder"].values
        low = res["pred_remainder_low"].values
        high = res["pred_remainder_high"].values
        
    dates = pd.date_range(daily_df["date"].max() + pd.Timedelta(days=1), periods=forecast_days)
    
    return pd.DataFrame({
        "date": dates,
        "predicted_net_cashflow": preds,
        "confidence_low": low,
        "confidence_high": high,
        "selected_model": model_name
    })

def forecast(raw_transactions_df, forecast_days=30):
    return auto_forecast(raw_transactions_df, holdout_days=30, forecast_days=forecast_days)
