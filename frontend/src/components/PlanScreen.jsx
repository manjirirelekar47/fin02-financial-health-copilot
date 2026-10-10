// src/components/PlanScreen.jsx — Feature 3 & 4 Priority LP Planner and Multi-Horizon Views
import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Info,
  Sliders,
  DollarSign,
  Layers,
} from "lucide-react";
import { fetchPlan, submitPlan, submitReplan } from "../api";
import ViewSwitcher from "./ViewSwitcher";
import SixMonthSummaryCard from "./SixMonthSummaryCard";

export default function PlanScreen({ sessionId = "demo" }) {
  const [reserve, setReserve] = useState(45000);
  const [goal, setGoal] = useState(75000);
  const [currentView, setCurrentView] = useState("weekly");
  const [plan, setPlan] = useState(null);
  const [selectedSeqId, setSelectedSeqId] = useState("S1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [replanTrigger, setReplanTrigger] = useState(null);

  const loadPlan = async (resVal = reserve, goalVal = goal, viewVal = currentView) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPlan(resVal, goalVal, viewVal, sessionId);
      setPlan(data);
      if (data.recommended_sequence_id) {
        setSelectedSeqId(data.recommended_sequence_id);
      } else if (data.sequences && data.sequences.length > 0) {
        setSelectedSeqId(data.sequences[0].id);
      }
    } catch (err) {
      setError(err.message || "Failed to load plan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlan(reserve, goal, currentView);
  }, [currentView, sessionId]);

  const handleApplyRelaxation = (rel) => {
    if (rel.type === "lower_goal" && rel.amount) {
      setGoal(rel.amount);
      loadPlan(reserve, rel.amount, currentView);
    } else if (rel.type === "lower_reserve" && rel.amount) {
      setReserve(rel.amount);
      loadPlan(rel.amount, goal, currentView);
    } else {
      // Re-solve with updated parameters
      loadPlan(reserve, goal, currentView);
    }
  };

  const handleSimulateDrop = async (pct = 0.3) => {
    setLoading(true);
    setError(null);
    try {
      const data = await submitReplan({
        plan: plan || { reserve, goal },
        change: { income_drop: pct, view: currentView },
      }, sessionId);
      setPlan(data);
      setReplanTrigger(`Income drop (-${Math.round(pct * 100)}%) re-solved`);
      if (data.recommended_sequence_id) {
        setSelectedSeqId(data.recommended_sequence_id);
      }
    } catch (err) {
      setError(err.message || "Replan failed");
    } finally {
      setLoading(false);
    }
  };

  const sequences = plan?.sequences || [];
  const activeSequence = sequences.find((s) => s.id === selectedSeqId) || sequences[0];
  const periods = activeSequence?.periods || [];

  // Chart data preparation
  const chartData = periods.map((p) => ({
    name: p.period_label || `W${p.week}`,
    p10: Math.round(p.closing_p10),
    p50: Math.round(p.closing_p50),
    p90: Math.round(p.closing_p90),
    band: [Math.round(p.closing_p10), Math.round(p.closing_p90)],
    reserve: reserve,
    goal: goal,
    breachProb: Math.round((p.reserve_breach_prob || 0) * 100),
  }));

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="text-accent" size={20} />
              <h1 className="text-xl font-display font-bold text-navy">Priority-Aware Plan Builder</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Linear Programming (HiGHS) plan protecting reserve floor and essential obligations first.
            </p>
          </div>

          <ViewSwitcher currentView={currentView} onViewChange={setCurrentView} />
        </div>

        {/* Inputs row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Safety Reserve Floor (₹)
            </label>
            <input
              type="number"
              value={reserve}
              onChange={(e) => setReserve(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Target Savings Goal (₹)
            </label>
            <input
              type="number"
              value={goal}
              onChange={(e) => setGoal(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => loadPlan(reserve, goal, currentView)}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-navy text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-all shadow-sm"
            >
              {loading ? "Solving LP..." : "Re-Solve Plan"}
            </button>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => handleSimulateDrop(0.3)}
              disabled={loading}
              className="flex-1 px-3 py-2 border border-amber-300 bg-amber-50 text-amber-900 text-xs font-medium rounded-xl hover:bg-amber-100 transition-all"
            >
              ⚡ Simulate -30% Drop
            </button>
          </div>
        </div>
      </div>

      {/* Infeasible Conflict Card */}
      {plan?.status === "infeasible" && plan.conflict && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-600 mt-0.5 shrink-0" size={20} />
            <div>
              <h2 className="text-sm font-display font-bold text-amber-900">
                Plan Infeasible Under Strict Priorities
              </h2>
              <p className="text-xs text-amber-800 mt-1">
                Critical (debt) and High (essentials) obligations cannot be cut, and the required reserve floor and goal exceed available income.
              </p>
            </div>
          </div>

          {/* Slack variables */}
          {plan.conflict.slack_amounts && (
            <div className="bg-white/80 rounded-xl p-3 border border-amber-200/60 text-xs space-y-1">
              <span className="font-semibold text-slate-700">Identified Constraint Deficits:</span>
              <ul className="list-disc list-inside text-slate-600 space-y-0.5 mt-1">
                {Object.entries(plan.conflict.slack_amounts).map(([k, v]) => (
                  <li key={k}>
                    <span className="font-medium text-slate-800">{k}</span>: Shortfall of ₹{Math.round(v).toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Relaxation options */}
          <div>
            <div className="text-xs font-semibold text-amber-900 mb-2">
              Available Relaxation Options (Re-Scored):
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {plan.conflict.relaxations?.map((rel, idx) => (
                <div
                  key={idx}
                  className="bg-white p-3.5 rounded-xl border border-amber-200 flex flex-col justify-between hover:border-amber-400 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-navy capitalize">
                        {rel.type.replace("_", " ")}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        Risk: {Math.round(rel.resulting_risk * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5">{rel.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyRelaxation(rel)}
                    className="mt-3 text-xs font-semibold text-accent hover:text-emerald-700 flex items-center gap-1 self-start"
                  >
                    Apply this relaxation <ArrowRight size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Why-line Callout */}
      {plan?.why_line && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
          <Info className="text-emerald-700 mt-0.5 shrink-0" size={18} />
          <div>
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block">
              Recommendation Rationale & Uncertainty Trade-off
            </span>
            <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">{plan.why_line}</p>
          </div>
        </div>
      )}

      {/* Six Month Summary Card if in sixmonth or available */}
      {plan?.six_month_summary && (
        <SixMonthSummaryCard summary={plan.six_month_summary} reserveFloor={reserve} />
      )}

      {/* Sequence Tabs */}
      {sequences.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-4 gap-3">
            <div className="flex items-center gap-2">
              {sequences.map((seq) => {
                const isSelected = seq.id === selectedSeqId;
                const isRec = seq.id === plan?.recommended_sequence_id;
                return (
                  <button
                    key={seq.id}
                    type="button"
                    onClick={() => setSelectedSeqId(seq.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isSelected
                        ? "bg-navy text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>{seq.name}</span>
                    {isRec && (
                      <span className="bg-accent text-navy text-[10px] px-1.5 py-0.2 rounded font-bold">
                        RECOMMENDED
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {activeSequence?.summary && (
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-400">Breach Risk: </span>
                  <span className={`font-bold ${activeSequence.summary.any_week_breach_prob > 0.15 ? "text-amber-600" : "text-emerald-700"}`}>
                    {(activeSequence.summary.any_week_breach_prob * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Min P10: </span>
                  <span className="font-bold text-navy">
                    ₹{Math.round(activeSequence.summary.min_p10_closing).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Total Cuts: </span>
                  <span className="font-bold text-slate-700">
                    ₹{Math.round(activeSequence.summary.total_cut).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Balance Band Chart */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Simulated Balance Trajectory (P10 - P50 - P90)
              </h3>
              <span className="text-[11px] text-slate-400">Common Random Numbers (CRN) Scored</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickFormatter={(val) => `₹${Math.round(val / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(val, name) => [
                      `₹${Number(val).toLocaleString()}`,
                      name === "p50" ? "Median Balance" : name === "p10" ? "P10 Stress" : name === "p90" ? "P90 Optimistic" : name,
                    ]}
                  />
                  <Legend />
                  <ReferenceLine
                    y={reserve}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{ value: "Reserve Floor", fill: "#d97706", fontSize: 10 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="p90"
                    stroke="#99f6e4"
                    fill="#ccfbf1"
                    fillOpacity={0.4}
                    name="P90 Optimistic"
                  />
                  <Line
                    type="monotone"
                    dataKey="p50"
                    stroke="#0f766e"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    name="Median (P50)"
                  />
                  <Line
                    type="monotone"
                    dataKey="p10"
                    stroke="#f43f5e"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    name="Stress (P10)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Period Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2.5">Period</th>
                  <th className="px-3 py-2.5">Opening</th>
                  <th className="px-3 py-2.5">Income (P50)</th>
                  <th className="px-3 py-2.5">Debt Service (Crit)</th>
                  <th className="px-3 py-2.5">Essentials (High)</th>
                  <th className="px-3 py-2.5">Discretionary (Low)</th>
                  <th className="px-3 py-2.5">Savings/Prepay</th>
                  <th className="px-3 py-2.5">Closing P10</th>
                  <th className="px-3 py-2.5">Closing P50</th>
                  <th className="px-3 py-2.5">Breach Risk</th>
                  <th className="px-3 py-2.5">Trade-off Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {periods.map((p) => {
                  const breachPct = (p.reserve_breach_prob || 0) * 100;
                  const isHighBreach = breachPct > 15;
                  return (
                    <tr key={p.week} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3 py-2 font-semibold text-navy">
                        {p.period_label || `Week ${p.week}`}
                      </td>
                      <td className="px-3 py-2">₹{Math.round(p.opening_balance).toLocaleString()}</td>
                      <td className="px-3 py-2 text-emerald-800 font-medium">
                        ₹{Math.round(p.income_p50).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-medium text-rose-800">
                        ₹{Math.round(p.debt_service).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">₹{Math.round(p.essentials).toLocaleString()}</td>
                      <td className="px-3 py-2 text-slate-500">
                        ₹{Math.round(p.discretionary).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-medium text-navy">
                        ₹{Math.round(p.savings + p.prepayment).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-rose-700">
                        ₹{Math.round(p.closing_p10).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-bold text-navy">
                        ₹{Math.round(p.closing_p50).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isHighBreach
                              ? "bg-amber-100 text-amber-900"
                              : "bg-emerald-100 text-emerald-900"
                          }`}
                        >
                          {breachPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-500 max-w-xs truncate">
                        {p.tradeoff_note || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
