// src/components/ForecastScreen.jsx — Feature 2 Probabilistic Forecast & 4-Baseline Evaluation Card
import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Award,
  Layers,
  Calendar,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BarChart3,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import { fetchForecastReport } from "../api";
import ViewSwitcher from "./ViewSwitcher";

export default function ForecastScreen({ sessionId = "demo" }) {
  const [currentView, setCurrentView] = useState("weekly");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadReport = async (viewVal = currentView) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchForecastReport(sessionId, 8, viewVal);
      setReport(data);
    } catch (err) {
      setError(err.message || "Failed to load forecast report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(currentView);
  }, [currentView, sessionId]);

  const baselines = report?.baselines || [];
  const perHorizon = report?.per_horizon || [];
  const incomeStream = report?.income_stream || { p10: [], p50: [], p90: [] };
  const expenseStream = report?.expense_stream || { p10: [], p50: [], p90: [] };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="text-accent" size={20} />
              <h1 className="text-xl font-display font-bold text-navy">
                Probabilistic Cashflow Forecast & Evidence Pack
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Dual-stream (income & expense) quantile forecast evaluated against 4 baselines on the held-out test window.
            </p>
          </div>

          <ViewSwitcher currentView={currentView} onViewChange={setCurrentView} />
        </div>
      </div>

      {/* Declared Method Card */}
      <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white border border-emerald-600/20 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-emerald-600/10 pb-4">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-emerald-800 uppercase bg-emerald-100/80 px-2 py-0.5 rounded">
              Declared Prediction Method
            </span>
            <h2 className="text-lg font-display font-bold text-navy mt-1">
              {report?.method || "Linear Regression + Empirical Residual Quantiles"}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Strictly calibrated on Months 1–24; zero data leakage into held-out Months 25–36.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Nominal Coverage</div>
              <div className="text-lg font-bold text-navy">
                {Math.round((report?.nominal_level || 0.8) * 100)}%
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Active View</div>
              <div className="text-sm font-bold text-emerald-800 capitalize">{currentView}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-1 text-xs">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={16} className="text-emerald-700 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-slate-800">Separate Streams:</span>
              <p className="text-slate-600">
                Income and expenses modeled independently to capture gig volatility without obscuring fixed obligations.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <CheckCircle2 size={16} className="text-emerald-700 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-slate-800">Quantile Outputs:</span>
              <p className="text-slate-600">
                P10 (stress), P50 (median), and P90 (optimistic) bounds derived from empirical residual distributions.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <CheckCircle2 size={16} className="text-emerald-700 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-slate-800">Held-Out Proof:</span>
              <p className="text-slate-600">
                All performance metrics derived exclusively from untouched test window origins.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4-Baseline Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-semibold text-navy text-sm">
              Held-Out Backtest Comparison (4 Baselines)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluated across rolling origins on Months 25–36.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-slate-400">Nominal 80% Range</span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
              <tr>
                <th className="px-4 py-2.5">Model / Baseline</th>
                <th className="px-4 py-2.5">MAE (₹)</th>
                <th className="px-4 py-2.5">MASE</th>
                <th className="px-4 py-2.5">Empirical 80% Coverage</th>
                <th className="px-4 py-2.5">Mean Interval Width (₹)</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {baselines.map((b, idx) => {
                const isSelected = b.name.includes("Linear Regression") || b.name.includes("Selected");
                const covPct = Math.round((b.coverage || 0) * 100);
                return (
                  <tr
                    key={idx}
                    className={isSelected ? "bg-emerald-50/50 font-semibold" : "hover:bg-slate-50/50"}
                  >
                    <td className="px-4 py-3 flex items-center gap-2">
                      {isSelected && <Award size={14} className="text-accent" />}
                      <span className={isSelected ? "text-navy" : "text-slate-800"}>{b.name}</span>
                    </td>
                    <td className="px-4 py-3">₹{Math.round(b.mae || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">{Number(b.mase || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          covPct >= 75 && covPct <= 85
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {covPct}%
                      </span>
                    </td>
                    <td className="px-4 py-3">₹{Math.round(b.mean_width || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {isSelected ? (
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-bold">
                          DEPLOYED
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Baseline</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multi-Horizon Evaluation Breakdown */}
      {perHorizon.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div>
            <h3 className="font-display font-semibold text-navy text-sm">
              Calibration Evidence Per Horizon Bucket
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Grade certification based on rolling-origin sample sizes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {perHorizon.map((h, idx) => (
              <div key={idx} className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-navy">{h.bucket}</span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                      h.grade === "Decision-grade"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : h.grade === "Planning-grade"
                        ? "bg-blue-50 text-blue-800 border-blue-200"
                        : "bg-purple-50 text-purple-800 border-purple-200"
                    }`}
                  >
                    {h.grade}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-slate-400 text-[10px]">Origins:</span>
                    <div className="font-semibold text-slate-800">{h.origins}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Coverage:</span>
                    <div className="font-semibold text-slate-800">
                      {Math.round((h.coverage || 0) * 100)}%
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">MAE:</span>
                    <div className="font-semibold text-slate-800">
                      ₹{Math.round(h.mae || 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">MASE:</span>
                    <div className="font-semibold text-slate-800">{Number(h.mase || 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
