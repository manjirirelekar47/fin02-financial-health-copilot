// src/components/SixMonthSummaryCard.jsx — Executive 6-Month Planning-Grade Widget
import React from "react";
import { ShieldCheck, AlertTriangle, TrendingUp, DollarSign, Calendar } from "lucide-react";

export default function SixMonthSummaryCard({ summary, reserveFloor = 45000 }) {
  if (!summary) return null;

  const isBreachHigh = (summary.reserve_breach_prob || 0) > 0.15;

  return (
    <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-accent" />
          <h3 className="font-display font-semibold text-navy text-sm">6-Month Trajectory Outlook</h3>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md border bg-blue-50 text-blue-800 border-blue-200">
          {summary.grade || "Planning-grade"}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Closing Band */}
        <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
          <div className="text-[11px] text-slate-500 font-medium">Month 6 Closing Band</div>
          <div className="text-sm font-bold text-navy mt-1">
            ₹{Math.round(summary.closing_p50 || 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            P10: ₹{Math.round(summary.closing_p10 || 0).toLocaleString()} — P90: ₹{Math.round(summary.closing_p90 || 0).toLocaleString()}
          </div>
        </div>

        {/* Lowest Point */}
        <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
          <div className="text-[11px] text-slate-500 font-medium">Lowest Balance Window</div>
          <div className="text-sm font-bold text-slate-800 mt-1">
            ₹{Math.round(summary.lowest_p10_balance || 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Week {summary.lowest_p10_week || "—"} (P10 stress test)
          </div>
        </div>

        {/* Breach Risk */}
        <div className={`p-3 rounded-xl border ${isBreachHigh ? "bg-amber-50/80 border-amber-200" : "bg-emerald-50/80 border-emerald-200"}`}>
          <div className="text-[11px] font-medium text-slate-600">Reserve Floor Breach Risk</div>
          <div className={`text-sm font-bold mt-1 ${isBreachHigh ? "text-amber-800" : "text-emerald-800"}`}>
            {((summary.reserve_breach_prob || 0) * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Threshold: ₹{Math.round(reserveFloor).toLocaleString()}
          </div>
        </div>

        {/* Goal Status & Savings */}
        <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
          <div className="text-[11px] text-slate-500 font-medium">Cumulative Savings & Debt</div>
          <div className="text-sm font-bold text-navy mt-1">
            ₹{Math.round((summary.cumulative_saving || 0) + (summary.debt_cleared || 0)).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Debt cleared: ₹{Math.round(summary.debt_cleared || 0).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
