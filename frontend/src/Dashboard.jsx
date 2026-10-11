// src/Dashboard.jsx — Top-level Dashboard View with Multi-language Translation & Dynamic Telemetry Sync
import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  TrendingUp,
  Lock,
  Calendar,
  Award,
  Sparkles,
  PieChart,
  ArrowUpRight,
  Database,
  ArrowRight,
  CheckCircle2,
import { useSettings } from "./context/SettingsContext";

const DEFAULT_DASHBOARD_DATA = {
  status: "ok",
  horizon: "Weekly",
  liquid_balance: 2905.0,
  locked_reserve: 25000.0,
  adherence_score: 88.0,
  upcoming_bills: [
    {
      id: "lp-1",
      name: "HDFC EMI",
      amount: 12000.0,
      date: "2026-10-12",
      category: "Debt Payment",
      account: "HDFC Salary A/c",
    },
    {
      id: "lp-2",
      name: "Flat 402 Rent",
      amount: 18000.0,
      date: "2026-10-15",
      category: "Housing",
      account: "HDFC Salary A/c",
    },
    {
      id: "lp-3",
      name: "Tata Power",
      amount: 3450.0,
      date: "2026-10-22",
      category: "Utilities",
      account: "ICICI Savings",
    },
  ],
  spending_categories: [
    { id: "shopping", name: "Personal Shopping", amount: 3795.0, colorLight: "#0D9488", colorDark: "#2DD4BF" },
    { id: "food", name: "Food & Dining", amount: 3404.0, colorLight: "#059669", colorDark: "#34D399" },
    { id: "festivals", name: "Festivals & Gifts", amount: 2645.0, colorLight: "#10B981", colorDark: "#6EE7B7" },
    { id: "bills", name: "Bills & Utilities", amount: 1472.0, colorLight: "#6366F1", colorDark: "#818CF8" },
    { id: "transit", name: "Transit & Travel", amount: 1058.0, colorLight: "#0284C7", colorDark: "#38BDF8" },
    { id: "entertainment", name: "Entertainment", amount: 966.0, colorLight: "#F59E0B", colorDark: "#FBBF24" },
  ],
};

export default function Dashboard({ onNavigate = null }) {
  const { currentLanguage, t } = useSettings();
  const [timeHorizon, setTimeHorizon] = useState("Weekly");
  const [dashboardData, setDashboardData] = useState(DEFAULT_DASHBOARD_DATA);
  const [isLoading, setIsLoading] = useState(false);

  // Dynamic fetch strictly appending currentLanguage, re-fetching when currentLanguage or timeHorizon changes
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const BASE_URL = import.meta.env.VITE_API_URL || "https://spendshield-tj9v.onrender.com";

fetch(`${BASE_URL}/api/dashboard?horizon=${encodeURIComponent(timeHorizon)}&lang=${encodeURIComponent(currentLanguage)}`, {
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
        if (isMounted && data) {
          setDashboardData(data);
        }
      })
      .catch((err) => {
        console.warn("Using fallback telemetry data:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [timeHorizon, currentLanguage]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Global Page Header: Greeting + Time-Horizon Segmented Control */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {t("Dashboard")}
            </span>
            <span className="text-xs text-zinc-400">• Live Defensive Telemetry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18191B] dark:text-white">
            {t("Command Center")}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {t("Welcome back, Authorized User.")}
          </p>
        </div>

        {/* The Time-Horizon Toggle Group */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="bg-slate-50 dark:bg-[#061d12] border border-slate-200 dark:border-emerald-800/40 rounded-full p-1 flex items-center gap-1 shadow-2xs overflow-x-auto max-w-full">
            {/* 1. Weekly */}
            <button
              type="button"
              onClick={() => setTimeHorizon("Weekly")}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
                timeHorizon === "Weekly"
                  ? "bg-white dark:bg-emerald-950/90 shadow-sm text-emerald-700 dark:text-emerald-300 font-semibold"
                  : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 font-normal"
              }`}
            >
              <span>{t("Weekly")}</span>
              <span className="bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {t("Decision-grade")}
              </span>
            </button>

            {/* 2. Monthly */}
            <button
              type="button"
              onClick={() => setTimeHorizon("Monthly")}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
                timeHorizon === "Monthly"
                  ? "bg-white dark:bg-emerald-950/90 shadow-sm text-emerald-700 dark:text-emerald-300 font-semibold"
                  : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 font-normal"
              }`}
            >
              <span>{t("Monthly")}</span>
              <span className="bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {t("Planning-grade")}
              </span>
            </button>

            {/* 3. 6-Month */}
            <button
              type="button"
              onClick={() => setTimeHorizon("6-Month")}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
                timeHorizon === "6-Month"
                  ? "bg-white dark:bg-emerald-950/90 shadow-sm text-emerald-700 dark:text-emerald-300 font-semibold"
                  : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 font-normal"
              }`}
            >
              <span>{t("6-Month")}</span>
            </button>

            {/* 4. Yearly */}
            <button
              type="button"
              onClick={() => setTimeHorizon("Yearly")}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
                timeHorizon === "Yearly"
                  ? "bg-white dark:bg-emerald-950/90 shadow-sm text-emerald-700 dark:text-emerald-300 font-semibold"
                  : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 font-normal"
              }`}
            >
              <span>{t("Yearly")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1. Global Dashboard Container: Responsive Bento Box CSS Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {/* 2. Top Row (Command Center KPIs - Span all 3 columns) */}
        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Liquid Safe-to-Spend */}
          <div className="relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-emerald-600 via-[#059669] to-[#047857] text-white shadow-lg shadow-emerald-600/25 border border-emerald-400/40 hover:-translate-y-0.5 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-100">
                  {t("Liquid Safe-to-Spend")}
                </span>
                <div className="p-1.5 rounded-xl bg-white/20 text-white border border-white/25">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight text-white drop-shadow-xs">
                  ₹{(dashboardData?.liquid_balance ?? 2905).toLocaleString()}
                </span>
                <span className="inline-flex items-center text-xs font-bold text-emerald-100 bg-white/20 px-2 py-0.5 rounded-full">
                  <TrendingUp className="w-3 h-3 mr-0.5" /> +8.4%
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-1 font-medium">
                {timeHorizon === "Weekly"
                  ? "7-day pace: ₹415/day safe"
                  : timeHorizon === "Monthly"
                  ? "Monthly pace: ₹12,450 safe headroom"
                  : timeHorizon === "6-Month"
                  ? "6-month runway safe floor"
                  : "Annual safe headroom pace"}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-white/20 flex items-center justify-between text-[11px] text-emerald-100/80">
              <span>{t("Autoshield Floor Active")}</span>
              <span className="font-bold text-white">{t("Live Floor Protected")}</span>
            </div>
          </div>

          {/* 2. Locked Reserve */}
          <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-5 shadow-sm hover:-translate-y-0.5 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase">
                  {t("Locked Reserve")}
                </span>
                <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Lock className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                  ₹{(dashboardData?.locked_reserve ?? 25000).toLocaleString()}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  {t("Floor Target")}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {t("Protected emergency capital buffer")}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-emerald-800/40 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
              <span>{t("Cushion Health")}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{t("100% Ring-Fenced")}</span>
            </div>
          </div>

          {/* 3. Upcoming Lock Path */}
          <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-5 shadow-sm hover:-translate-y-0.5 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase">
                  {t("Upcoming Lock Path")}
                </span>
                <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                  ₹{(dashboardData?.upcoming_bills?.reduce((acc, b) => acc + (b?.amount || 0), 0) ?? 33450).toLocaleString()}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  {t("Ring-fenced")}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {timeHorizon} recurring obligations
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-emerald-800/40 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
              <span>{t("Upcoming Bills")}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {dashboardData?.upcoming_bills?.length || 0} bills
              </span>
            </div>
          </div>

          {/* 4. Overall Adherence Score */}
          <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-5 shadow-sm hover:-translate-y-0.5 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase">
                  {t("Adherence Score")}
                </span>
                <div className="p-1.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                  {dashboardData?.adherence_score ?? 88}%
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                  {t("On Track")}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Zero shortfall • Strict compliance
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-emerald-800/40 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
              <span>{t("Pacing Health")}</span>
              <span className="font-bold text-teal-600 dark:text-teal-400">99.4% safe</span>
            </div>
          </div>
        </div>

        {/* 3. Middle Row - Left (Category Breakdown) */}
        <div className="md:col-span-2 bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <PieChart className="w-5 h-5 text-emerald-600" />
                {t("Category Breakdown")}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {t("Spending Breakdown")} ({timeHorizon})
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
              ₹{(dashboardData?.spending_categories?.reduce((acc, c) => acc + (c?.amount || 0), 0) || 0).toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {(dashboardData?.spending_categories || []).map((cat) => (
              <div
                key={cat.id}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800 flex items-center justify-between transition-colors hover:border-emerald-500/30"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: cat.colorLight || "#10B981" }}
                  />
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    {t(cat.name)}
                  </span>
                </div>
                <span className="text-xs font-black text-zinc-900 dark:text-white font-mono">
                  ₹{Number(cat.amount).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Middle Row - Right (Upcoming Bills) */}
        <div className="md:col-span-1 bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                {t("Upcoming Bills")}
              </h2>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                {t("Ring-fenced")}
              </span>
            </div>

            <div className="space-y-3">
              {(dashboardData?.upcoming_bills || []).map((bill) => (
                <div
                  key={bill.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">
                      {bill.name}
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {bill.date} • {t(bill.category || "Bills & Utilities")}
                    </p>
                  </div>
                  <span className="text-xs font-black text-zinc-900 dark:text-white font-mono">
                    ₹{Number(bill.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate && onNavigate("Subscriptions")}
            className="mt-4 w-full py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>{t("Subscriptions")}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
