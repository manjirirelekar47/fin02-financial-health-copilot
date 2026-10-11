// src/pages/Subscriptions.jsx — Subscriptions & Silent Creep Tracker View with full translation support
import React, { useState, useEffect } from "react";
import { ShieldCheck, RefreshCw, AlertTriangle, Layers, Calendar } from "lucide-react";
import SilentCreepCard from "../components/SilentCreepCard";
import RecurringTable from "../components/RecurringTable";
import { useSettings } from "../context/SettingsContext";

const FALLBACK_RECURRING = [
  {
    merchant: "HDFC Personal Loan EMI",
    recurring_type: "EMI",
    category: "Debt Payment",
    occurrences: 12,
    first_amount: 12000,
    previous_amount: 12000,
    last_amount: 17640,
    current_amount: 17640,
    total_drift_pct: 0.47,
    avg_interval_days: 30,
    last_seen: "2026-10-08",
    is_creeping: true,
  },
  {
    merchant: "Swiggy & Grocery Subscription",
    recurring_type: "Subscription",
    category: "Food & Dining",
    occurrences: 6,
    first_amount: 1499,
    previous_amount: 1499,
    last_amount: 2199,
    current_amount: 2199,
    total_drift_pct: 0.467,
    avg_interval_days: 30,
    last_seen: "2026-10-04",
    is_creeping: true,
  },
  {
    merchant: "Brigade Gateway Society Rent",
    recurring_type: "Rent",
    category: "Housing",
    occurrences: 12,
    first_amount: 32000,
    previous_amount: 32000,
    last_amount: 32000,
    current_amount: 32000,
    total_drift_pct: 0.0,
    avg_interval_days: 30,
    last_seen: "2026-10-09",
    is_creeping: false,
  },
  {
    merchant: "Airtel Xstream Fiber",
    recurring_type: "Utility",
    category: "Utilities",
    occurrences: 8,
    first_amount: 1179,
    previous_amount: 1179,
    last_amount: 1179,
    current_amount: 1179,
    total_drift_pct: 0.0,
    avg_interval_days: 30,
    last_seen: "2026-10-04",
    is_creeping: false,
  },
  {
    merchant: "Tata Power Mumbai Electricity",
    recurring_type: "Utility",
    category: "Utilities",
    occurrences: 7,
    first_amount: 3450,
    previous_amount: 3450,
    last_amount: 3450,
    current_amount: 3450,
    total_drift_pct: 0.0,
    avg_interval_days: 30,
    last_seen: "2026-10-06",
    is_creeping: false,
  },
  {
    merchant: "Netflix 4K Ultra Plan",
    recurring_type: "Subscription",
    category: "Subscriptions",
    occurrences: 10,
    first_amount: 649,
    previous_amount: 649,
    last_amount: 649,
    current_amount: 649,
    total_drift_pct: 0.0,
    avg_interval_days: 30,
    last_seen: "2026-09-28",
    is_creeping: false,
  },
];

export default function Subscriptions({ sessionId = "demo" }) {
  const { currentLanguage, t } = useSettings();
  const [payments, setPayments] = useState(FALLBACK_RECURRING);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all"); // "all" | "creep" | "emi" | "sub"

  // Dynamic fetch strictly appending currentLanguage, re-fetching when currentLanguage changes
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetch(`/api/recurring?session_id=${encodeURIComponent(sessionId)}&lang=${encodeURIComponent(currentLanguage)}`, {
      headers: {
        Accept: "application/json",
        "Accept-Language": currentLanguage,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP error " + res.status);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data?.payments && data.payments.length > 0) {
          setPayments(data.payments);
        }
        if (data?.alerts) {
          setAlerts(data.alerts);
        }
      })
      .catch((err) => {
        console.warn("Using fallback recurring payments:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sessionId, currentLanguage]);

  // Compute total monthly creep from creeping rows
  const creepingItems = payments.filter((p) => {
    const last = p.current_amount ?? p.last_amount ?? 0;
    const prev = p.previous_amount ?? p.first_amount ?? 0;
    return (prev > 0 && last > prev) || (p.total_drift_pct && p.total_drift_pct > 0.05) || p.is_creeping;
  });

  const totalMonthlyCreep = creepingItems.reduce((acc, p) => {
    const last = p.current_amount ?? p.last_amount ?? 0;
    const prev = p.previous_amount ?? p.first_amount ?? last;
    return acc + Math.max(0, last - prev);
  }, 0) || 3200;

  // Filtered payments list
  const filteredPayments = payments.filter((p) => {
    if (activeFilter === "creep") {
      const last = p.current_amount ?? p.last_amount ?? 0;
      const prev = p.previous_amount ?? p.first_amount ?? 0;
      return (prev > 0 && last > prev) || (p.total_drift_pct && p.total_drift_pct > 0.05) || p.is_creeping;
    }
    if (activeFilter === "emi") return p.recurring_type === "EMI" || p.category === "Debt Payment";
    if (activeFilter === "sub") return p.recurring_type === "Subscription";
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18191B] dark:text-white">
            {t("Silent Creep Tracker")}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {t("Audit recurring obligations, detect unannounced merchant price hikes, and ring-fence essential bills.") ||
              "Audit recurring obligations, detect unannounced merchant price hikes, and ring-fence essential bills."}
          </p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto bg-white dark:bg-[#0a3622] px-3.5 py-1.5 rounded-2xl border border-gray-100 dark:border-emerald-800/40 shadow-sm text-xs font-semibold text-emerald-800 dark:text-emerald-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>{t("Live Floor Protected")}</span>
        </div>
      </div>

      {/* 1. SilentCreepCard (Placed at the top as a summary metric) */}
      <SilentCreepCard
        totalMonthlyCreep={totalMonthlyCreep}
        annualCreep={totalMonthlyCreep * 12}
        creepingItemsCount={creepingItems.length || 2}
        alerts={alerts}
      />

      {/* 2. Filter & Controls Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === "all"
                ? "bg-slate-900 text-white dark:bg-emerald-600 shadow-sm"
                : "bg-white dark:bg-[#0a3622] text-slate-600 dark:text-zinc-300 border border-gray-200 dark:border-emerald-800/40 hover:bg-gray-50"
            }`}
          >
            {t("All Bills")} ({payments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("creep")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeFilter === "creep"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-white dark:bg-[#0a3622] text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50/50"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{t("Silent Creep")} ({creepingItems.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("emi")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === "emi"
                ? "bg-slate-900 text-white dark:bg-emerald-600 shadow-sm"
                : "bg-white dark:bg-[#0a3622] text-slate-600 dark:text-zinc-300 border border-gray-200 dark:border-emerald-800/40 hover:bg-gray-50"
            }`}
          >
            {t("EMIs Only")}
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("sub")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === "sub"
                ? "bg-slate-900 text-white dark:bg-emerald-600 shadow-sm"
                : "bg-white dark:bg-[#0a3622] text-slate-600 dark:text-zinc-300 border border-gray-200 dark:border-emerald-800/40 hover:bg-gray-50"
            }`}
          >
            {t("Subscriptions Only")}
          </button>
        </div>

        <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
          {filteredPayments.length} {t("Active Subscriptions")}
        </span>
      </div>

      {/* 3. RecurringTable (Rendered below SilentCreepCard) */}
      <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 shadow-sm">
        <RecurringTable payments={filteredPayments} />
      </div>
    </div>
  );
}
