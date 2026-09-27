import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression

def load_transactions(path):
    df = pd.read_csv(path, parse_dates=["date"])
    return df

def compute_daily_net_cashflow(df):
    df["signed_amount"] = np.where(df["type"] == "credit", df["amount"], -df["amount"])
    daily = df.groupby("date")["signed_amount"].sum().reset_index()
    daily = daily.rename(columns={"signed_amount": "net_cashflow"})
    return daily.sort_values("date")

def trailing_90_days(daily_df, end_date):
    start = end_date - pd.Timedelta(days=90)
    return daily_df[(daily_df["date"] > start) & (daily_df["date"] <= end_date)]

def fit_linear_forecast(window_df, forecast_days=30):
    window_df = window_df.copy()
    window_df["day_index"] = (window_df["date"] - window_df["date"].min()).dt.days
    X = window_df[["day_index"]]
    y = window_df["net_cashflow"]
    model = LinearRegression().fit(X, y)
    last_day = window_df["day_index"].max()
    future_days = np.arange(last_day + 1, last_day + 1 + forecast_days).reshape(-1, 1)
    predictions = model.predict(future_days)
    return predictions, model

def moving_average_fallback(window_df, forecast_days=30, span=7):
    ma = window_df["net_cashflow"].rolling(span).mean().iloc[-1]
    return np.full(forecast_days, ma)

def is_volatile(window_df, threshold=0.6):
    cv = window_df["net_cashflow"].std() / (abs(window_df["net_cashflow"].mean()) + 1e-6)
    return cv > threshold

def backtest(daily_df, holdout_days=30):
    cutoff = daily_df["date"].max() - pd.Timedelta(days=holdout_days)
    train = daily_df[daily_df["date"] <= cutoff]
    actual = daily_df[daily_df["date"] > cutoff]

    window = trailing_90_days(train, cutoff)
    if is_volatile(window):
        preds = moving_average_fallback(window, forecast_days=len(actual))
    else:
        preds, _ = fit_linear_forecast(window, forecast_days=len(actual))

    mae = np.mean(np.abs(preds - actual["net_cashflow"].values))
    std_dev = window["net_cashflow"].std()
    lower = preds - std_dev
    upper = preds + std_dev
    within_band = np.mean((actual["net_cashflow"].values >= lower) & (actual["net_cashflow"].values <= upper))

    return {
        "mae_per_day": round(mae, 2),
        "confidence_band_coverage_pct": round(within_band * 100, 1)
    }

def forecast_forward(daily_df, forecast_days=30):
    """
    Forecasts forward from the LAST available date in the data (not a
    holdout cutoff) — this is what actually feeds the dashboard's
    "Predicted" line, as distinct from backtest() which evaluates accuracy
    against already-known history.

    Returns a DataFrame: date, predicted_net_cashflow, confidence_low,
    confidence_high — confidence band uses the same +/- 1 std-dev approach
    as backtest(), so the reported coverage % from backtest() is a fair
    estimate of how reliable this band actually is.
    """
    end_date = daily_df["date"].max()
    window = trailing_90_days(daily_df, end_date)

    if is_volatile(window):
        preds = moving_average_fallback(window, forecast_days=forecast_days)
    else:
        preds, _ = fit_linear_forecast(window, forecast_days=forecast_days)

    std_dev = window["net_cashflow"].std()
    future_dates = pd.date_range(end_date + pd.Timedelta(days=1), periods=forecast_days)

    return pd.DataFrame({
        "date": future_dates,
        "predicted_net_cashflow": preds,
        "confidence_low": preds - std_dev,
        "confidence_high": preds + std_dev,
    })


if __name__ == "__main__":
    df = load_transactions("../data/persona_a_transactions.csv")
    daily = compute_daily_net_cashflow(df)

    results = backtest(daily, holdout_days=30)
    print("Back-test:", results)

    forward = forecast_forward(daily, forecast_days=30)
    print("\nForward forecast (first 5 days):")
    print(forward.head())
