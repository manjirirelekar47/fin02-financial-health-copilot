// src/components/SilentCreepCard.jsx — Summary metric card for Silent Creep Tracker
import React from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { useSettings } from "../context/SettingsContext";

export default function SilentCreepCard({
  totalMonthlyCreep = 3200,
  annualCreep = null,
  creepingItemsCount = 2,
  alerts = [],
  className = "",
}) {
  const { t } = useSettings();
  const creepAlert = alerts.find((a) => a.mode === "silent_creep");
  const monthlyAmount = creepAlert?.extra_per_month ?? totalMonthlyCreep;
  const annualAmount = annualCreep ?? creepAlert?.extra_per_year ?? (monthlyAmount * 12);

  return (
    <div
      className={`rounded-3xl p-6 bg-gradient-to-br from-rose-500/10 via-red-500/5 to-amber-500/5 dark:from-rose-950/30 dark:via-red-950/20 dark:to-zinc-900 border border-rose-200 dark:border-rose-900/40 shadow-sm transition-all ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Metric highlights */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 border border-rose-200 dark:border-rose-800/60 inline-flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>{t("Silent Creep")}</span>
            </span>
            <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
              {creepingItemsCount} {t("Creep Alerts")}
            </span>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-baseline gap-2">
              <span>{t("Total Monthly Creep")}:</span>
              <span className="text-rose-600 dark:text-rose-400">
                +₹{Number(monthlyAmount).toLocaleString("en-IN")}
              </span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
              {t("Total Monthly Burden")}:{" "}
              <strong className="text-slate-900 dark:text-white font-bold">
                +₹{Number(annualAmount).toLocaleString("en-IN")}/year
              </strong>{" "}
              {t("from your safe liquidity buffer.") || "from your safe liquidity buffer."}
            </p>
          </div>
        </div>

        {/* Right: Quick Telemetry Tag */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-rose-100 dark:border-rose-900/30">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 tracking-wider block">
              {t("Total Monthly Burden")}
            </span>
            <span className="text-lg font-black text-rose-600 dark:text-rose-400">
              ₹{Number(annualAmount).toLocaleString("en-IN")}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-100/80 dark:bg-rose-900/40 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> {t("Action")}
          </span>
        </div>
      </div>
    </div>
  );
}
