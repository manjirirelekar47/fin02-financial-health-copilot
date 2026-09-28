// src/components/ForecastChart.jsx — owned by Member 3.
//
// Shows observed monthly net cash flow (from /api/summary), plus one
// additional "next month (predicted)" point built by aggregating the daily
// forecast from /api/forecast. We aggregate rather than plot daily points
// alongside monthly ones because mixing granularities on one axis would be
// misleading — this way "Observed" and "Predicted" stay directly comparable.
//
// Note on the confidence band: aggregated across the 30 forecast days by
// treating day-to-day forecast errors as independent — so the aggregate
// std-dev scales by sqrt(n), not n. (An earlier version summed each day's
// full +/- band directly, which overstated the 30-day band ~5.5x and blew
// the chart's y-axis out to +/-600K, flattening the observed trend into an
// invisible line — verified against the live API before fixing.)
//
// Props:
//   summary  - array from /api/summary: { month, savings, ... }
//   forecast - object from /api/forecast: {
//                forecast: [{ date, predicted_net_cashflow, confidence_low, confidence_high }, ...],
//                backtest: { mae_per_day, confidence_band_coverage_pct }
//              }

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

function aggregateForecast(forecastRows) {
  if (!forecastRows || forecastRows.length === 0) return null;
  const n = forecastRows.length;
  const predictedSum = forecastRows.reduce((acc, r) => acc + r.predicted_net_cashflow, 0);

  // Every day shares the same std-dev (forecast_model.py's forecast_forward()
  // uses one trailing-90-day std for the whole window), so it can be read
  // straight off any single row rather than re-derived per row.
  const dailyStd = forecastRows[0].confidence_high - forecastRows[0].predicted_net_cashflow;
  const aggregateStd = dailyStd * Math.sqrt(n);

  return {
    predicted: predictedSum,
    confidence_low: predictedSum - aggregateStd,
    confidence_high: predictedSum + aggregateStd,
  };
}

function formatCurrency(value) {
  if (value === undefined || value === null) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function ForecastChart({ summary, forecast }) {
  const nextMonthAgg = aggregateForecast(forecast?.forecast);

  const data = [
    ...summary.map((row) => ({
      label: row.month,
      observed: row.savings,
      predicted: undefined,
      confidence_low: undefined,
      confidence_high: undefined,
    })),
    ...(nextMonthAgg
      ? [
          {
            label: "Next 30 days",
            observed: undefined,
            predicted: nextMonthAgg.predicted,
            confidence_low: nextMonthAgg.confidence_low,
            confidence_high: nextMonthAgg.confidence_high,
          },
        ]
      : []),
  ];

  const backtest = forecast?.backtest;

  return (
    <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-5">
      {backtest && (
        <p className="text-sm text-slate-500 mb-3">
          Forecast back-tested: average error{" "}
          <span className="font-medium text-slate-700">{formatCurrency(backtest.mae_per_day)}/day</span>,{" "}
          <span className="font-medium text-slate-700">{backtest.confidence_band_coverage_pct}%</span> of
          actual outcomes fell within the predicted confidence band.
        </p>
      )}

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#D5E8DD" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => (value === undefined ? "—" : formatCurrency(value))} />
          <Legend />

          <Area
            type="monotone"
            dataKey="confidence_high"
            stroke="none"
            fill="#34D399"
            fillOpacity={0.28}
            name="Confidence band"
          />
          <Area
            type="monotone"
            dataKey="confidence_low"
            stroke="none"
            fill="#ffffff"
            fillOpacity={1}
            name=""
            legendType="none"
          />

          <Line
            type="monotone"
            dataKey="observed"
            stroke="#0E2E28"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Observed"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="predicted"
            stroke="#0D9488"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={{ r: 4 }}
            name="Predicted"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ForecastChart;