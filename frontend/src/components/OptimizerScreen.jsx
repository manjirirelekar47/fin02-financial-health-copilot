// src/components/OptimizerScreen.jsx — owned by Member 1.
//
// Feature 3: Minimum-Change Optimizer.
// Answers: "What is the smallest change that lets me do X safely?"
// Calls runOptimizer() and displays the recommended levers plus a
// before-vs-after shortfall risk comparison.

import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";
import {
  Target,
  Loader2,
  XCircle,
  CheckCircle2,
  Info,
  Calendar,
  PiggyBank,
  Scissors,
  Vault,
} from "lucide-react";
import { runOptimizer } from "../api";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  n == null
    ? "—"
    : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const pct = (n, decimals = 1) =>
  n == null ? "—" : `${(n * 100).toFixed(decimals)}%`;

// Default category flexibility weights (0 = don't touch, 1 = fully flexible)
const DEFAULT_CATS = [
  { key: "Food",          label: "Food & Dining",   weight: 0.3 },
  { key: "Shopping",      label: "Shopping",         weight: 0.5 },
  { key: "Entertainment", label: "Entertainment",    weight: 0.7 },
  { key: "Travel",        label: "Travel",           weight: 0.6 },
  { key: "Utilities",     label: "Utilities",        weight: 0.1 },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function LeverCard({ icon: Icon, label, value, sub, accent = false }) {
  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-1 ${
        accent
          ? "border-teal-300 bg-teal-50/50 ring-1 ring-teal-200/60"
          : "border-cardborder bg-white/70"
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
        <Icon size={13} className={accent ? "text-teal-600" : "text-slate-400"} />
        {label}
      </div>
      <p className={`text-lg font-bold ${accent ? "text-teal-700" : "text-navy"}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

function SliderRow({ label, min, max, step, value, onChange, format }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="font-semibold text-navy">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-500 cursor-pointer"
      />
    </div>
  );
}

function NumInput({ label, value, onChange, prefix = "₹", type = "number" }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-500">{label}</label>
      <div className="flex items-center border border-cardborder rounded-lg overflow-hidden bg-white">
        {prefix && <span className="px-2 text-xs text-slate-400">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) =>
            onChange(type === "number" ? Number(e.target.value) : e.target.value)
          }
          className="flex-1 py-1.5 pr-2 text-sm text-navy outline-none bg-transparent"
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OptimizerScreen({ sessionId }) {
  // Form state
  const [goalName, setGoalName]       = useState("Buy a ₹90,000 laptop");
  const [amount, setAmount]           = useState(90000);
  const [months, setMonths]           = useState(4);
  const [maxShortfall, setMaxShortfall] = useState(10); // in %
  const [maxDti, setMaxDti]           = useState(65); // in %
  const [cats, setCats]               = useState(DEFAULT_CATS);

  // Result state
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [ran, setRan]         = useState(false);

  const updateCatWeight = (key, weight) =>
    setCats((prev) => prev.map((c) => (c.key === key ? { ...c, weight } : c)));

  const handleRun = () => {
    setLoading(true);
    setError(null);
    setRan(true);

    const payload = {
      target_purchase_amount: amount,
      target_purchase_months: months,
      constraints: {
        target_shortfall_prob: maxShortfall / 100,
        min_p10_buffer_amount: 0,
        max_dti: maxDti / 100,
      },
      category_weights: Object.fromEntries(cats.map((c) => [c.label, c.weight])),
    };

    runOptimizer(payload, sessionId)
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  // Build before/after chart data
  const beforeProb = 0.41; // heuristic "do-nothing" shortfall prob — replaced once simulator integrates
  const afterProb  = result?.resulting_shortfall_prob ?? null;

  const riskChartData = [
    { name: "Before (Do Nothing)", prob: Math.round(beforeProb * 100), fill: "#f87171" },
    ...(afterProb != null
      ? [{ name: "After Optimizer", prob: Math.round(afterProb * 100), fill: "#2dd4bf" }]
      : []),
  ];

  const levers = result?.levers ?? null;
  const hasSuggestion = Boolean(levers);
  const categoryEntries = levers?.cut_spend_percentages
    ? Object.entries(levers.cut_spend_percentages)
    : [];

  return (
    <div className="flex flex-col gap-6">
      {/* ── Goal Setup Panel ── */}
      <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-cardborder shadow-sm p-5 flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-accent" />
          <h3 className="font-semibold text-navy text-base">Goal Setup</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NumInput
            label="Goal Name"
            value={goalName}
            onChange={setGoalName}
            prefix=""
            type="text"
          />
          <NumInput label="Target Amount" value={amount} onChange={setAmount} />
          <div className="flex flex-col gap-1">
            <SliderRow
              label="Achieve within (months)"
              min={1} max={24} step={1}
              value={months}
              onChange={setMonths}
              format={(v) => `${v} month${v > 1 ? "s" : ""}`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <SliderRow
              label="Max acceptable shortfall probability"
              min={1} max={40} step={1}
              value={maxShortfall}
              onChange={setMaxShortfall}
              format={(v) => `${v}%`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <SliderRow
              label="Max debt-to-income ratio"
              min={20} max={80} step={1}
              value={maxDti}
              onChange={setMaxDti}
              format={(v) => `${v}%`}
            />
          </div>
        </div>

        {/* Category flexibility weights */}
        <div>
          <p className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
            <Info size={12} />
            Drag sliders to tell the optimizer how flexible each category is (0 = untouchable, 1 = fully cuttable).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
            {cats.map((c) => (
              <SliderRow
                key={c.key}
                label={c.label}
                min={0} max={1} step={0.05}
                value={c.weight}
                onChange={(v) => updateCatWeight(c.key, v)}
                format={(v) => v === 0 ? "🔒 Fixed" : v === 1 ? "Fully flexible" : `${Math.round(v * 100)}% flex`}
              />
            ))}
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={loading}
          className="self-end flex items-center gap-2 bg-accent hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors disabled:opacity-60"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Target size={15} />}
          {loading ? "Optimizing…" : "Find Minimum Change"}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <XCircle size={16} /> {error}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-12 text-slate-400 text-sm">
          <Loader2 size={20} className="animate-spin text-accent" />
          Finding the smallest viable change…
        </div>
      )}

      {/* ── Results ── */}
      {!loading && ran && result && (
        <>
          {/* Plan found / not found banner */}
          {result.plan_found ? (
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <CheckCircle2 size={20} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-navy text-sm">
                  Plan found for "{goalName}"
                </p>
                <p className="text-sm text-slate-600 mt-0.5">{result.explanation}</p>
                {result.lifestyle_disruption_score != null && (
                  <p className="text-xs text-slate-400 mt-1">
                    Lifestyle disruption score:{" "}
                    <span className="font-semibold text-navy">
                      {result.lifestyle_disruption_score.toFixed(0)} / 100
                    </span>{" "}
                    (lower = less disruption)
                  </p>
                )}
              </div>
            </div>
          ) : result.levers ? (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <Info size={20} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-navy text-sm">Closest available plan (constraint not met)</p>
                <p className="text-sm text-slate-600 mt-0.5">{result.explanation || `This option has ${pct(result.resulting_shortfall_prob)} estimated shortfall risk against your ${maxShortfall}% limit. Adjust the goal or risk limit to explore alternatives.`}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <Info size={20} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div><p className="font-semibold text-navy text-sm">No usable option could be calculated</p><p className="text-sm text-slate-600 mt-0.5">{result.explanation || "Try a smaller target amount or a longer purchase timeline."}</p></div>
            </div>
          )}

          {hasSuggestion && (
            <>
              {/* ── Lever Cards ── */}
              <div>
                <h3 className="font-semibold text-navy mb-3">Recommended Changes</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <LeverCard
                    icon={Calendar}
                    label="Delay purchase by"
                    value={levers.purchase_delay_weeks === 0 ? "No delay" : `${levers.purchase_delay_weeks}w`}
                    sub="weeks from today"
                    accent={levers.purchase_delay_weeks > 0}
                  />
                  <LeverCard
                    icon={PiggyBank}
                    label="Extra monthly saving"
                    value={fmt(levers.extra_monthly_saving)}
                    sub="above current run-rate"
                    accent={levers.extra_monthly_saving > 0}
                  />
                  <LeverCard
                    icon={Vault}
                    label="Draw from savings"
                    value={fmt(levers.amount_drawn_from_savings)}
                    sub="one-time withdrawal"
                    accent={levers.amount_drawn_from_savings > 0}
                  />
                  <LeverCard
                    icon={Scissors}
                    label="Shortfall risk after"
                    value={pct(result.resulting_shortfall_prob)}
                    sub={`target was ${maxShortfall}%`}
                    accent
                  />
                </div>
              </div>

              {/* ── Category Cuts ── */}
              {categoryEntries.length > 0 && (
                <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-cardborder shadow-sm p-5">
                  <h3 className="font-semibold text-navy mb-1">Recommended Category Cuts</h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Minimum reductions across your spending categories. The optimizer keeps cuts as
                    small as possible while still hitting your {maxShortfall}% shortfall target.
                  </p>
                  <div className="flex flex-col gap-3">
                    {categoryEntries.map(([cat, cutFrac]) => (
                      <div key={cat} className="flex items-center gap-3">
                        <span className="w-28 text-sm text-slate-600 flex-shrink-0">{cat}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2.5">
                          <div
                            className="bg-teal-500 h-2.5 rounded-full transition-all"
                            style={{ width: `${Math.round(cutFrac * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-teal-700 w-12 text-right">
                          −{Math.round(cutFrac * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Before vs After Chart ── */}
              <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-cardborder shadow-sm p-5">
                <h3 className="font-semibold text-navy mb-1">Shortfall Risk: Before vs After</h3>
                <p className="text-xs text-slate-400 mb-4">
                  90-day probability of running a cash deficit. Green = after applying the optimizer's plan.
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={riskChartData} layout="vertical" margin={{ left: 16, right: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D5E8DD" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={140} />
                    <Tooltip
                      formatter={(v) => [`${v}%`, "90-day shortfall prob."]}
                      contentStyle={{ fontSize: 12, borderRadius: 10 }}
                    />
                    <Bar dataKey="prob" radius={[0, 8, 8, 0]} maxBarSize={40}>
                      {riskChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                      <LabelList
                        dataKey="prob"
                        position="right"
                        formatter={(v) => `${v}%`}
                        style={{ fontSize: 12, fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </>
      )}

      {!loading && !ran && (
        <div className="text-center py-16 text-slate-400 text-sm">
          Fill in your goal above and click <span className="font-semibold text-navy">Find Minimum Change</span>.
        </div>
      )}
    </div>
  );
}
