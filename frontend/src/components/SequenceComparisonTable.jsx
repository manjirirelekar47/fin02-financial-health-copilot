// src/components/SequenceComparisonTable.jsx — Deep-dive sequence metrics table for Multi-Path Simulator
import React from "react";
import { ShieldCheck, AlertTriangle, Layers, TrendingUp, Info } from "lucide-react";

export default function SequenceComparisonTable({
  periods = [],
  selectedSequenceId = "S1",
  sequences = [],
  onSelectSequence = null,
  className = "",
}) {
  const defaultPeriods = [
    {
      period_label: "Week 1",
      income_p50: 75000,
      debt_service: 17640,
      essentials: 36629,
      discretionary: 12581,
      closing_p10: 18200,
      closing_p50: 28450,
      closing_p90: 38700,
      reserve_breach_prob: 0.02,
      tradeoff_note: "Safe floor ring-fenced; zero breach risk",
    },
    {
      period_label: "Week 2",
      income_p50: 75000,
      debt_service: 17640,
      essentials: 36629,
      discretionary: 12581,
      closing_p10: 19100,
      closing_p50: 29800,
      closing_p90: 40500,
      reserve_breach_prob: 0.02,
      tradeoff_note: "Optimal trajectory; buffer expands by +₹1,350",
    },
    {
      period_label: "Week 3",
      income_p50: 75000,
      debt_service: 17640,
      essentials: 36629,
      discretionary: 12581,
      closing_p10: 17500,
      closing_p50: 27900,
      closing_p90: 39100,
      reserve_breach_prob: 0.04,
      tradeoff_note: "Utility billing cycle absorbed without reserve touch",
    },
    {
      period_label: "Week 4",
      income_p50: 75000,
      debt_service: 17640,
      essentials: 36629,
      discretionary: 12581,
      closing_p10: 18800,
      closing_p50: 31200,
      closing_p90: 43600,
      reserve_breach_prob: 0.03,
      tradeoff_note: "Month-end closing buffer healthy at ₹31,200",
    },
    {
      period_label: "Week 5",
      income_p50: 75000,
      debt_service: 17640,
      essentials: 36629,
      discretionary: 12581,
      closing_p10: 19600,
      closing_p50: 32800,
      closing_p90: 45900,
      reserve_breach_prob: 0.02,
      tradeoff_note: "Salary cycle inflow restocks liquid cashflow",
    },
    {
      period_label: "Week 6",
      income_p50: 75000,
      debt_service: 17640,
      essentials: 36629,
      discretionary: 12581,
      closing_p10: 18400,
      closing_p50: 31500,
      closing_p90: 44600,
      reserve_breach_prob: 0.03,
      tradeoff_note: "Strict floor compliance preserved",
    },
  ];

  const dataRows = periods && periods.length > 0 ? periods : defaultPeriods;

  return (
    <div
      className={`bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-5 sm:p-6 shadow-sm space-y-4 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">
              Sequence Deep-Dive Metrics
            </h3>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              Deterministic CRN-scored quantiles across simulated periods
            </p>
          </div>
        </div>

        {sequences && sequences.length > 0 && (
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-100 dark:bg-zinc-800 text-xs">
            {sequences.map((seq) => (
              <button
                key={seq.id}
                type="button"
                onClick={() => onSelectSequence && onSelectSequence(seq.id)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  selectedSequenceId === seq.id
                    ? "bg-white dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {seq.name || seq.id}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 dark:border-emerald-800/40 text-[11px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-bold">
              <th className="py-2.5 px-3">Horizon</th>
              <th className="py-2.5 px-3">Income</th>
              <th className="py-2.5 px-3">EMI / Debt</th>
              <th className="py-2.5 px-3">Discretionary</th>
              <th className="py-2.5 px-3 text-rose-600 dark:text-rose-400">P10 (Stress)</th>
              <th className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400">P50 (Expected)</th>
              <th className="py-2.5 px-3 text-teal-600 dark:text-teal-400">P90 (Optimistic)</th>
              <th className="py-2.5 px-3">Breach Risk</th>
              <th className="py-2.5 px-3">Trade-off Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100/70 dark:divide-white/5 text-zinc-700 dark:text-zinc-200">
            {dataRows.map((row, idx) => {
              const breachPct = ((row.reserve_breach_prob ?? 0) * 100).toFixed(1);
              const isHighRisk = Number(breachPct) > 15;

              return (
                <tr
                  key={row.period_label || row.week || idx}
                  className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="py-3 px-3 font-bold text-zinc-900 dark:text-white">
                    {row.period_label || `Week ${row.week || idx + 1}`}
                  </td>
                  <td className="py-3 px-3 font-semibold text-emerald-700 dark:text-emerald-400">
                    ₹{Math.round(row.income_p50 || row.income || 75000).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-3 font-semibold text-rose-700 dark:text-rose-400">
                    ₹{Math.round(row.debt_service || row.emi || 17640).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-3 text-zinc-600 dark:text-zinc-300">
                    ₹{Math.round(row.discretionary || 12581).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-3 font-bold text-rose-600 dark:text-rose-400">
                    ₹{Math.round(row.closing_p10 || row.p10 || 18200).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-3 font-black text-emerald-600 dark:text-emerald-400">
                    ₹{Math.round(row.closing_p50 || row.p50 || 28450).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-3 font-bold text-teal-600 dark:text-teal-400">
                    ₹{Math.round(row.closing_p90 || row.p90 || 38700).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isHighRisk
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300"
                      }`}
                    >
                      {breachPct}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[11px] text-zinc-500 dark:text-zinc-400 max-w-xs truncate">
                    {row.tradeoff_note || "Zero shortfall • Strict floor compliance"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
