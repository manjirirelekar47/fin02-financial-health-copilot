// src/components/RecurringTable.jsx — Multi-language Recurring Payments and Creep Table
import React from "react";
import { useSettings } from "../context/SettingsContext";

function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const TYPE_BADGE_STYLES = {
  EMI: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
  Rent: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20",
  Subscription: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20",
  Utility: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20",
  "Other recurring": "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400",
};

function TypeBadge({ type, t }) {
  const classes = TYPE_BADGE_STYLES[type] || TYPE_BADGE_STYLES["Other recurring"];
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${classes}`}>
      {t ? t(type || "Recurring") : type || "Recurring"}
    </span>
  );
}

function DriftBadge({ pct }) {
  if (pct === null || pct === undefined || isNaN(pct) || pct === 0) {
    return <span className="text-slate-400 text-sm">0%</span>;
  }
  const isIncrease = Number(pct) > 0;
  const tone = isIncrease ? "text-rose-600 dark:text-rose-400 font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold";
  return (
    <span className={`text-sm ${tone}`}>
      {isIncrease ? "▲" : "▼"} {isIncrease ? "+" : ""}
      {typeof pct === "number" ? (pct * (pct < 1 && pct > -1 ? 100 : 1)).toFixed(1) : pct}%
    </span>
  );
}

function RecurringTable({ payments }) {
  const { t } = useSettings();

  if (!payments || payments.length === 0) {
    return (
      <div className="bg-white dark:bg-[#0a3622] rounded-[14px] border border-gray-100 dark:border-emerald-800/40 p-8 text-center text-slate-400">
        {t("No recurring payments detected yet.") || "No recurring payments detected yet."}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#0a3622] rounded-[14px] overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 dark:bg-zinc-900/60 text-slate-500 dark:text-zinc-400 uppercase text-xs">
          <tr>
            <th className="px-4 py-3.5 font-bold">{t("Merchant")}</th>
            <th className="px-4 py-3.5 font-bold">{t("Category")}</th>
            <th className="px-4 py-3.5 font-bold">{t("Frequency")}</th>
            <th className="px-4 py-3.5 font-bold">{t("Current Amount")}</th>
            <th className="px-4 py-3.5 font-bold">{t("Drift")}</th>
            <th className="px-4 py-3.5 font-bold">{t("Status")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-emerald-950/40">
          {payments.map((p, idx) => {
            const merchant = p.merchant || p.narration || p.id || "Recurring Item";
            const type = p.recurring_type || p.category || "Subscription";
            const occurrences = p.occurrences ?? "—";
            const lastAmount = p.current_amount ?? p.last_amount ?? p.amount ?? p.avg_amount ?? 0;
            const prevAmount = p.previous_amount ?? p.first_amount ?? 0;
            const drift = p.total_drift_pct ?? (prevAmount > 0 ? (lastAmount - prevAmount) / prevAmount : 0);
            const lastSeen = p.last_seen || "Recent";

            // Check if current_amount > previous_amount or positive creep detected
            const isSilentCreep =
              (p.current_amount !== undefined && p.previous_amount !== undefined && p.current_amount > p.previous_amount) ||
              (p.last_amount !== undefined && p.first_amount !== undefined && p.last_amount > p.first_amount) ||
              Number(drift || 0) > 0.05 ||
              p.is_creeping === true;

            return (
              <tr
                key={`${merchant}-${idx}`}
                className={`transition-colors ${
                  isSilentCreep
                    ? "bg-red-50/80 dark:bg-red-950/30 hover:bg-red-100/60 dark:hover:bg-red-950/50"
                    : "hover:bg-slate-50/60 dark:hover:bg-zinc-800/40"
                }`}
              >
                <td className="px-4 py-3.5 font-medium text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>{merchant}</span>
                  {isSilentCreep && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800 flex items-center gap-1 shrink-0">
                      ⚠️ {t("Silent Creep")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <TypeBadge type={type} t={t} />
                </td>
                <td className="px-4 py-3.5 text-slate-500 dark:text-zinc-400">{occurrences}</td>
                <td className="px-4 py-3.5 text-slate-800 dark:text-zinc-200 font-semibold">
                  {formatCurrency(lastAmount)}
                  {isSilentCreep && prevAmount > 0 && (
                    <span className="text-[10px] text-red-500 dark:text-red-400 block font-normal">
                      from {formatCurrency(prevAmount)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <DriftBadge pct={drift} />
                </td>
                <td className="px-4 py-3.5 text-slate-400 dark:text-zinc-500 font-mono text-xs">{lastSeen}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default RecurringTable;
