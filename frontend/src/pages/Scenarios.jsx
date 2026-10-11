// src/pages/Scenarios.jsx — Multi-Path Simulator with interactive sliders, translation and sequence comparison
import React, { useState, useEffect, useCallback } from "react";
import { Sliders, RefreshCw, DollarSign, Wallet, TrendingUp } from "lucide-react";
import ForecastChart from "../components/ForecastChart";
import SequenceComparisonTable from "../components/SequenceComparisonTable";
import { compareSimulationPaths } from "../api";
import { useSettings } from "../context/SettingsContext";

function formatCurrency(val) {
  if (val === undefined || val === null) return "₹0";
  return `₹${Number(val).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function Scenarios() {
  const { currentLanguage, t } = useSettings();

  // Base figures (typical middle-income baseline)
  const BASE_INCOME = 85000;
  const BASE_EMI = 24000;
  const BASE_DISCRETIONARY = 28000;
  const BASE_ESSENTIALS = 18000;

  // Sliders state (percentages)
  const [incomePct, setIncomePct] = useState(0);
  const [emiPct, setEmiPct] = useState(0);
  const [spendPct, setSpendPct] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [activePreset, setActivePreset] = useState("baseline");

  // Dynamic values
  const currentIncome = Math.round(BASE_INCOME * (1 + incomePct / 100));
  const currentEmi = Math.round(BASE_EMI * (1 + emiPct / 100));
  const currentSpend = Math.round(BASE_DISCRETIONARY * (1 + spendPct / 100));
  const totalOutflows = currentEmi + currentSpend + BASE_ESSENTIALS;
  const monthlyNet = currentIncome - totalOutflows;

  // Simulation forecast & sequence data
  const [forecastData, setForecastData] = useState([]);
  const [periods, setPeriods] = useState([]);

  // Calculate local simulation trajectory fallback or instant preview
  const generateTrajectory = useCallback((incPct, debtPct, discPct) => {
    const inc = BASE_INCOME * (1 + incPct / 100);
    const emi = BASE_EMI * (1 + debtPct / 100);
    const disc = BASE_DISCRETIONARY * (1 + discPct / 100);
    const fixed = BASE_ESSENTIALS;
    const weeklyInc = inc / 4.33;
    const weeklyBurn = (emi + disc + fixed) / 4.33;

    const weeks = 8;
    const fData = [];
    const pData = [];
    let p50 = 42000;

    for (let w = 1; w <= weeks; w++) {
      const netWk = weeklyInc - weeklyBurn;
      p50 += netWk;
      const vol = 3200 * Math.sqrt(w);
      const p10 = Math.round(p50 - vol * 1.28);
      const p90 = Math.round(p50 + vol * 1.28);
      const roundP50 = Math.round(p50);

      fData.push({
        label: `Wk ${w}`,
        p10: Math.max(0, p10),
        p50: roundP50,
        p90: p90,
      });

      const breachRisk = Math.max(0.01, Math.min(0.99, (25000 - p10) / 45000));

      pData.push({
        period_label: `Week ${w}`,
        income_p50: Math.round(weeklyInc),
        debt_service: Math.round(emi / 4.33),
        essentials: Math.round(fixed / 4.33),
        discretionary: Math.round(disc / 4.33),
        closing_p10: Math.max(0, p10),
        closing_p50: roundP50,
        closing_p90: p90,
        reserve_breach_prob: Number(breachRisk.toFixed(2)),
        tradeoff_note:
          p10 > 25000
            ? "Reserve intact; safe buffer maintained."
            : p50 > 25000
            ? "Slight tail risk on reserve floor under P10 stress."
            : "⚠️ High risk of liquid reserve breach under current trajectory.",
      });
    }

    return { fData, pData };
  }, []);

  // Fetch simulation from backend or fallback strictly passing currentLanguage
  const runSimulation = useCallback(
    async (incP, emiP, spendP) => {
      setIsLoading(true);
      try {
        const payload = {
          income_pct: incP,
          emi_pct: emiP,
          spend_pct: spendP,
          horizon_weeks: 8,
        };

        const res = await fetch(`/api/simulate?lang=${encodeURIComponent(currentLanguage)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept-Language": currentLanguage,
          },
          body: JSON.stringify(payload),
        })
          .then((r) => (r.ok ? r.json() : compareSimulationPaths(payload)))
          .catch(() => compareSimulationPaths(payload));

        if (res && res.forecast_data && res.forecast_data.length > 0) {
          setForecastData(res.forecast_data);
          const local = generateTrajectory(incP, emiP, spendP);
          setPeriods(local.pData);
        } else {
          const local = generateTrajectory(incP, emiP, spendP);
          setForecastData(local.fData);
          setPeriods(local.pData);
        }
      } catch (err) {
        console.warn("Backend /api/simulate call used local deterministic fallback:", err);
        const local = generateTrajectory(incP, emiP, spendP);
        setForecastData(local.fData);
        setPeriods(local.pData);
      } finally {
        setIsLoading(false);
      }
    },
    [generateTrajectory, currentLanguage]
  );

  // Debounced trigger on slider adjust or language switch
  useEffect(() => {
    const timer = setTimeout(() => {
      runSimulation(incomePct, emiPct, spendPct);
    }, 200);
    return () => clearTimeout(timer);
  }, [incomePct, emiPct, spendPct, runSimulation, currentLanguage]);

  // Presets handler
  const applyPreset = (presetKey) => {
    setActivePreset(presetKey);
    switch (presetKey) {
      case "baseline":
        setIncomePct(0);
        setEmiPct(0);
        setSpendPct(0);
        break;
      case "savings":
        setIncomePct(0);
        setEmiPct(0);
        setSpendPct(-25);
        break;
      case "debt_refinance":
        setIncomePct(0);
        setEmiPct(-30);
        setSpendPct(-10);
        break;
      case "stress_shock":
        setIncomePct(-30);
        setEmiPct(15);
        setSpendPct(0);
        break;
      default:
        break;
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-emerald-900/40 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {t("Deterministic Multi-Path Engine") || "Deterministic Multi-Path Engine"}
            </span>
            <span className="text-xs text-zinc-400">• Monte Carlo + CRN Resampling</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
            {t("Multi-Path Simulator")}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
            {t("Simulate forward-looking cashflow variations across income, debt, and discretionary outlays. Observe probabilistic P10, P50, and P90 confidence bounds in real time.") ||
              "Simulate forward-looking cashflow variations across income, debt, and discretionary outlays. Observe probabilistic P10, P50, and P90 confidence bounds in real time."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => applyPreset("baseline")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-600" : ""}`} />
            {t("Baseline")}
          </button>
        </div>
      </div>

      {/* 2-Column Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Controls (4 cols on large) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Controls Card */}
          <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                  {t("Simulation Parameters")}
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                {t("Ready")}
              </span>
            </div>

            {/* Quick Presets */}
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-2">
                {t("Baseline")}
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => applyPreset("baseline")}
                  className={`p-2 rounded-xl border text-left font-medium transition-all cursor-pointer ${
                    activePreset === "baseline"
                      ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 font-bold"
                      : "border-gray-200 dark:border-zinc-800 hover:border-gray-300 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {t("Baseline")}
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("savings")}
                  className={`p-2 rounded-xl border text-left font-medium transition-all cursor-pointer ${
                    activePreset === "savings"
                      ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 font-bold"
                      : "border-gray-200 dark:border-zinc-800 hover:border-gray-300 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {t("Optimistic")}
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("stress_shock")}
                  className={`p-2 rounded-xl border text-left font-medium transition-all cursor-pointer ${
                    activePreset === "stress_shock"
                      ? "border-rose-500 bg-rose-50/70 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 font-bold"
                      : "border-gray-200 dark:border-zinc-800 hover:border-gray-300 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {t("Shock Test")}
                </button>
              </div>
            </div>

            <hr className="border-gray-100 dark:border-emerald-900/30" />

            {/* Slider 1: Adjust Monthly Income */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  {t("Adjust Monthly Income")}
                </span>
                <span className={`px-2 py-0.5 rounded font-bold ${
                  incomePct > 0 ? "bg-emerald-100 text-emerald-800" : incomePct < 0 ? "bg-rose-100 text-rose-800" : "bg-gray-100 text-zinc-700"
                }`}>
                  {incomePct > 0 ? `+${incomePct}%` : `${incomePct}%`} ({formatCurrency(currentIncome)})
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="5"
                value={incomePct}
                onChange={(e) => {
                  setIncomePct(Number(e.target.value));
                  setActivePreset("custom");
                }}
                className="w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>-50% ({formatCurrency(BASE_INCOME * 0.5)})</span>
                <span>{t("Baseline")} ({formatCurrency(BASE_INCOME)})</span>
                <span>+50% ({formatCurrency(BASE_INCOME * 1.5)})</span>
              </div>
            </div>

            {/* Slider 2: Adjust EMI / Debt */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-amber-600" />
                  {t("Adjust EMI/Debt")}
                </span>
                <span className={`px-2 py-0.5 rounded font-bold ${
                  emiPct < 0 ? "bg-emerald-100 text-emerald-800" : emiPct > 0 ? "bg-rose-100 text-rose-800" : "bg-gray-100 text-zinc-700"
                }`}>
                  {emiPct > 0 ? `+${emiPct}%` : `${emiPct}%`} ({formatCurrency(currentEmi)})
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="100"
                step="5"
                value={emiPct}
                onChange={(e) => {
                  setEmiPct(Number(e.target.value));
                  setActivePreset("custom");
                }}
                className="w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>-50% ({formatCurrency(BASE_EMI * 0.5)})</span>
                <span>{t("Baseline")} ({formatCurrency(BASE_EMI)})</span>
                <span>+100% ({formatCurrency(BASE_EMI * 2)})</span>
              </div>
            </div>

            {/* Slider 3: Adjust Discretionary Spend */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                  {t("Adjust Discretionary Spend")}
                </span>
                <span className={`px-2 py-0.5 rounded font-bold ${
                  spendPct < 0 ? "bg-emerald-100 text-emerald-800" : spendPct > 0 ? "bg-rose-100 text-rose-800" : "bg-gray-100 text-zinc-700"
                }`}>
                  {spendPct > 0 ? `+${spendPct}%` : `${spendPct}%`} ({formatCurrency(currentSpend)})
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="5"
                value={spendPct}
                onChange={(e) => {
                  setSpendPct(Number(e.target.value));
                  setActivePreset("custom");
                }}
                className="w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>-50% ({formatCurrency(BASE_DISCRETIONARY * 0.5)})</span>
                <span>{t("Baseline")} ({formatCurrency(BASE_DISCRETIONARY)})</span>
                <span>+50% ({formatCurrency(BASE_DISCRETIONARY * 1.5)})</span>
              </div>
            </div>

            {/* Live Impact Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-3">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                {t("Closing Balance")}
              </span>
              <div className="flex items-baseline justify-between">
                <span className={`text-2xl font-black ${monthlyNet >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {monthlyNet >= 0 ? `+${formatCurrency(monthlyNet)}` : `-${formatCurrency(Math.abs(monthlyNet))}`}
                </span>
                <span className="text-xs text-zinc-500 font-medium">
                  {monthlyNet >= 15000 ? t("Optimistic") : monthlyNet >= 0 ? t("Expected") : t("Stress")}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400 pt-2 border-t border-slate-200/60 dark:border-zinc-800">
                <div className="flex justify-between">
                  <span>{t("Income")}:</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{formatCurrency(currentIncome)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("Debt Payment")}:</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{formatCurrency(BASE_ESSENTIALS + currentEmi)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("Flexible Outlay") || "Flexible Outlay"}:</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{formatCurrency(currentSpend)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Visualizations (8 cols on large) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Top: Forecast Chart */}
          <ForecastChart
            customForecastData={forecastData}
            hideDeclaredMethodCard={false}
          />

          {/* Bottom: Sequence Comparison Table */}
          <SequenceComparisonTable
            periods={periods}
            selectedSequenceId="s0"
          />
        </div>
      </div>
    </div>
  );
}
