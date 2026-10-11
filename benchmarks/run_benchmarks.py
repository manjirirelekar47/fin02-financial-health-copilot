import pandas as pd
import numpy as np
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src')))

from forecast_model import compute_daily_net_cashflow, load_transactions, trailing_90_days, is_volatile, fit_linear_forecast, moving_average_fallback

def compute_mase(y_train, y_test, y_pred, seasonality=1):
    n = len(y_train)
    d = np.abs(np.diff(y_train, n=seasonality)).sum() / (n - seasonality)
    errors = np.abs(y_test - y_pred)
    return errors.mean() / d if d != 0 else np.nan

def eval_naive_yesterday(train, actual):
    last_val = train["net_cashflow"].iloc[-1]
    return np.array([last_val] * len(actual))

def eval_same_weekday_last_week(train, actual):
    last_7 = train["net_cashflow"].iloc[-7:].values
    preds = []
    for i in range(len(actual)):
        preds.append(last_7[i % 7])
    return np.array(preds)

def eval_moving_average(train, actual, span=7):
    ma = train["net_cashflow"].rolling(span).mean().iloc[-1]
    return np.full(len(actual), ma)

def eval_r1_linear_regression(train, actual):
    cutoff = train["date"].max()
    window = trailing_90_days(train, cutoff)
    if is_volatile(window):
        preds = moving_average_fallback(window, forecast_days=len(actual))
    else:
        preds, _ = fit_linear_forecast(window, forecast_days=len(actual))
    return preds

def run_benchmarks(data_path, holdout_days=30):
    df = load_transactions(data_path)
    daily = compute_daily_net_cashflow(df)
    
    cutoff = daily["date"].max() - pd.Timedelta(days=holdout_days)
    train = daily[daily["date"] <= cutoff]
    actual = daily[daily["date"] > cutoff]
    
    y_train = train["net_cashflow"].values
    y_test = actual["net_cashflow"].values
    
    from twin.twin_model import TwinModel
    
    train = train.copy()
    train['variable_remainder'] = train['net_cashflow']
    twin = TwinModel()
    twin_res = twin.fit_predict(train, forecast_days=len(actual))
    twin_preds = twin_res["pred_remainder"].values
    twin_low = twin_res["pred_remainder_low"].values
    twin_high = twin_res["pred_remainder_high"].values
    
    baselines = {
        "Naive Yesterday": eval_naive_yesterday(train, actual),
        "Same Weekday Last Week": eval_same_weekday_last_week(train, actual),
        "Moving Average": eval_moving_average(train, actual),
        "Round 1 Linear Regression": eval_r1_linear_regression(train, actual),
        "Twin Model (Quantile GBDT)": twin_preds
    }
    
    window = trailing_90_days(train, cutoff)
    std_dev = window["net_cashflow"].std()
    
    results = []
    for name, preds in baselines.items():
        mae = np.abs(y_test - preds).mean()
        mase = compute_mase(y_train, y_test, preds, seasonality=7)
        
        if name == "Twin Model (Quantile GBDT)":
            lower = twin_low
            upper = twin_high
        else:
            lower = preds - std_dev
            upper = preds + std_dev
            
        coverage = np.mean((y_test >= lower) & (y_test <= upper)) * 100
        interval_width = np.mean(upper - lower)
        
        results.append({
            "Model": name,
            "MAE": round(mae, 2),
            "MASE": round(mase, 3),
            "Coverage %": round(coverage, 1),
            "Interval Width": round(interval_width, 2)
        })
        
    res_df = pd.DataFrame(results)
    print(res_df.to_string(index=False))

if __name__ == "__main__":
    run_benchmarks("data/persona_a_transactions.csv")
