// src/components/DecisionSimulator.jsx — owned by Member 1.
//
// Feature 2 flagship screen: "Simulate a Decision".
// Loads default multi-path comparison on mount via fetchSimulatePresets(),
// re-runs via runSimulation() whenever controls change.

import { useEffect, useState, useCallback } from "react";
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
} from "recharts";
import {
  TrendingDown,
  RefreshCcw,
  ShoppingCart,
  HeartPulse,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { fetchSimulatePresets, runSimulation } from "../api";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  n == null
    ? "—"
    : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const pct = (n) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);
const round2 = (n) => Math.round((n ?? 0) * 100) / 100;

const PRESET_META = {
  do_nothing:       { label: "Do Nothing",       color: "#94a3b8" },
  cut_spend:        { label: "Cut Spend",         color: "#10b981" },
  refinance:        { label: "Refinance",         color: "#3b82f6" },
  buy_or_new_emi:   { label: "Buy / New EMI",     color: "#f59e0b" },
  medical_emergency:{ label: "Medical Emergency", color: "#ef4444" },
  income_drop_30:   { label: "Income −30%",       color: "#f97316" },
  job_loss:         { label: "Job Loss",          color: "#dc2626" },
  emi_hike_12:      { label: "EMI +12%",          color: "#8b5cf6" },
};

// Build a synthetic 90-day fan from a single SimulatorPathOutput.
// The backend gives per-path P10/P50/P90 at day-90; we interpolate linearly
// from an assumed day-0 balance of 0 (relative) so Recharts has daily points.
function buildFanData(paths) {
  const baseline = paths.find((p) => p.preset === "do_nothing");
  const best     = paths[0]; // already ranked by backend
  const days = Array.from({ length: 91 }, (_, i) => i);

  return days.map((d) => {
    const frac = d / 90;
    const row = { day: `Day ${d}` };

    if (baseline) {
      row.baseline_p10 = round2(baseline.buffer.p10 * frac);
      row.baseline_p50 = round2(baseline.buffer.p50 * frac);
      row.baseline_p90 = round2(baseline.buffer.p90 * frac);
    }
    if (best && best.preset !== "do_nothing") {
      row.scenario_p10 = round2(best.buffer.p10 * frac);
      row.scenario_p50 = round2(best.buffer.p50 * frac);
      row.scenario_p90 = round2(best.buffer.p90 * frac);
    }
    return row;
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Badge({ variant = "observed", children }) {
  const styles = {
    observed:          "bg-slate-100 text-slate-600 ring-slate-200",
    predicted:         "bg-blue-50 text-blue-700 ring-blue-200",
    recommended:       "bg-emerald-50 text-emerald-700 ring-emerald-200",
    insufficient_data: "bg-amber-50 text-amber-700 ring-amber-200",
    needs_review:      "bg-orange-50 text-orange-700 ring-orange-200",
    ok:                "bg-green-50 text-green-700 ring-green-200",
    warning:           "bg-red-50 text-red-700 ring-red-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${styles[variant] ?? styles.observed}`}
    >
      {children}
    </span>
  );
}

function PathCard({ path, isRecommended, priority }) {
  const meta = PRESET_META[path.preset] ?? { label: path.preset, color: "#6b7280" };
  const shortfallPct = (path.shortfall_prob_90d * 100).toFixed(1);

  return (
    <div
      className={`relative rounded-2xl border p-4 flex flex-col gap-3 transition-all ${
        isRecommended
          ? "border-emerald-400 ring-2 ring-emerald-300/50 bg-emerald-50/40"
          : "border-cardborder bg-white/70"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: meta.color }}
          />
          <span className="font-semibold text-navy text-sm">{meta.label}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {isRecommended && (
            <Badge variant="recommended">
              <CheckCircle2 size={10} /> {priority === "safest" ? "Safest" : "Cheapest"}
            </Badge>
          )}
          {path.rollover_warning && (
            <Badge variant="warning">
              <AlertTriangle size={10} /> Rollover Risk
            </Badge>
          )}
        </div>
      </div>

      {/* one_line_reason */}
      <p className="text-xs text-slate-500 leading-snug italic">{path.one_line_reason}</p>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <Metric label="90-day Shortfall Prob." value={`${shortfallPct}%`} highlight={path.shortfall_prob_90d > 0.35} />
        <Metric label="Survival Runway" value={`${path.survival_runway_days}d`} />
        <Metric label="P10 Buffer" value={fmt(path.buffer.p10)} />
        <Metric label="P50 Buffer" value={fmt(path.buffer.p50)} />
        <Metric label="P90 Buffer" value={fmt(path.buffer.p90)} />
        <Metric label="Months-of-Expenses" value={`${round2(path.months_of_expenses_buffer)}m`} />
        <Metric label="Goal Delay" value={`${path.goal_delay_weeks}w`} />
        <Metric label="New DTI" value={pct(path.new_dti)} highlight={path.new_dti > 0.4} />
        <Metric label="Borrow Prob 90d" value={pct(path.new_borrowing_prob_90d)} />
        <Metric
          label="Rollover Warning"
          value={path.rollover_warning ? "⚠ Yes" : "✓ No"}
          highlight={path.rollover_warning}
        />
      </div>
    </div>
  );
}

function Metric({ label, value, highlight }) {
  return (
    <div>
      <span className="block text-slate-400">{label}</span>
      <span className={`font-semibold ${highlight ? "text-red-600" : "text-navy"}`}>{value}</span>
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

function NumInput({ label, value, onChange, prefix = "₹" }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-500">{label}</label>
      <div className="flex items-center border border-cardborder rounded-lg overflow-hidden bg-white">
        <span className="px-2 text-xs text-slate-400">{prefix}</span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 py-1.5 pr-2 text-sm text-navy outline-none bg-transparent"
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DecisionSimulator() {
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [priority, setPriority] = useState("safest");

  // Scenario controls
  const [cutPct, setCutPct]               = useState(20);
  const [refiPrincipal, setRefiPrincipal] = useState(500000);
  const [refiRate, setRefiRate]           = useState(9);
  const [refiTenor, setRefiTenor]         = useState(36);
  const [buyAmount, setBuyAmount]         = useState(100000);
  const [buyMonths, setBuyMonths]         = useState(0); // 0 = one-time
  const [medLow, setMedLow]               = useState(100000);
  const [medLikely, setMedLikely]         = useState(200000);
  const [medHigh, setMedHigh]             = useState(400000);
  const [insurance, setInsurance]         = useState(0);

  // Active presets toggle (multi-select)
  const [activePresets, setActivePresets] = useState([
    "do_nothing", "cut_spend", "refinance", "medical_emergency",
  ]);

  const togglePreset = (p) =>
    setActivePresets((prev) =>
      prev.includes(p) ? (prev.length > 1 ? prev.filter((x) => x !== p) : prev) : [...prev, p]
    );

  const buildPayload = useCallback(
    () => ({
      presets: activePresets,
      priority,
      custom_amount: buyAmount || medLikely - insurance,
      custom_months: buyMonths || null,
    }),
    [activePresets, priority, buyAmount, buyMonths, medLikely, insurance]
  );

  const run = useCallback(
    (payload) => {
      setLoading(true);
      setError(null);
      runSimulation(payload)
        .then(setResult)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    },
    []
  );

  // On mount: load presets
  useEffect(() => {
    setLoading(true);
    fetchSimulatePresets()
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleRun = () => run(buildPayload());

  const paths = result?.paths ?? [];
  const recommended = result?.recommended_path;
  const fanData = paths.length ? buildFanData(paths) : [];
  const bestPath = paths[0];

  // Tick every 15 points for legibility
  const fanTicks = fanData.filter((_, i) => i % 15 === 0).map((d) => d.day);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Status Banner ── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <XCircle size={16} /> {error}
        </div>
      )}

      {/* ── Controls Panel ── */}
      <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-cardborder shadow-sm p-5 flex flex-col gap-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-semibold text-navy text-base">Scenario Controls</h3>
          {/* Priority Toggle */}
          <button
            onClick={() => setPriority((p) => (p === "safest" ? "cheapest" : "safest"))}
            className="flex items-center gap-2 text-xs font-medium text-navy bg-canvas border border-cardborder px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            {priority === "safest" ? <ToggleLeft size={16} className="text-emerald-500" /> : <ToggleRight size={16} className="text-emerald-500" />}
            Priority: <span className="capitalize text-accent">{priority}</span>
          </button>
        </div>

        {/* Preset multi-select chips */}
        <div>
          <p className="text-xs text-slate-400 mb-2">Active paths to compare</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PRESET_META).map(([id, meta]) => {
              const on = activePresets.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => togglePreset(id)}
                  style={on ? { background: meta.color + "22", borderColor: meta.color, color: meta.color } : {}}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    on
                      ? "font-semibold"
                      : "border-cardborder text-slate-400 hover:border-slate-400"
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Expandable scenario forms */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Cut Spend */}
          {activePresets.includes("cut_spend") && (
            <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <TrendingDown size={13} /> Cut Spend
              </div>
              <SliderRow
                label="Discretionary cut"
                min={5} max={50} step={5}
                value={cutPct}
                onChange={setCutPct}
                format={(v) => `${v}%`}
              />
            </div>
          )}

          {/* Refinance */}
          {activePresets.includes("refinance") && (
            <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                <RefreshCcw size={13} /> Refinance
              </div>
              <NumInput label="Loan Principal" value={refiPrincipal} onChange={setRefiPrincipal} />
              <SliderRow label="New Rate %" min={6} max={18} step={0.5} value={refiRate} onChange={setRefiRate} format={(v) => `${v}%`} />
              <SliderRow label="Tenor (months)" min={12} max={84} step={6} value={refiTenor} onChange={setRefiTenor} format={(v) => `${v}m`} />
              <p className="text-[11px] text-slate-400">
                New EMI ≈ {fmt((refiPrincipal * (refiRate / 1200) * Math.pow(1 + refiRate / 1200, refiTenor)) / (Math.pow(1 + refiRate / 1200, refiTenor) - 1))}
              </p>
            </div>
          )}

          {/* Buy / New EMI */}
          {activePresets.includes("buy_or_new_emi") && (
            <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <ShoppingCart size={13} /> Buy / New EMI
              </div>
              <NumInput label="Amount" value={buyAmount} onChange={setBuyAmount} />
              <SliderRow label="Spread over (months, 0=lump)" min={0} max={60} step={6} value={buyMonths} onChange={setBuyMonths} format={(v) => (v === 0 ? "One-time" : `${v}m`)} />
            </div>
          )}

          {/* Medical Emergency */}
          {activePresets.includes("medical_emergency") && (
            <div className="bg-red-50/50 rounded-xl p-3 border border-red-100 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
                <HeartPulse size={13} /> Medical Emergency
              </div>
              <NumInput label="Low estimate" value={medLow} onChange={setMedLow} />
              <NumInput label="Likely estimate" value={medLikely} onChange={setMedLikely} />
              <NumInput label="High estimate" value={medHigh} onChange={setMedHigh} />
              <NumInput label="Insurance cover" value={insurance} onChange={setInsurance} />
              <p className="text-[11px] text-slate-400">Net shock: {fmt(medLikely - insurance)}</p>
            </div>
          )}

          {/* Stress presets — no extra controls needed */}
          {["income_drop_30", "job_loss", "emi_hike_12"].filter((p) => activePresets.includes(p)).map((p) => {
            const icons = { income_drop_30: TrendingDown, job_loss: Briefcase, emi_hike_12: AlertTriangle };
            const Icon = icons[p];
            return (
              <div key={p} className="bg-orange-50/50 rounded-xl p-3 border border-orange-100 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-700">
                  <Icon size={13} /> {PRESET_META[p].label}
                </div>
                <p className="text-[11px] text-slate-400">Stress-test applied automatically — no extra inputs required.</p>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleRun}
          disabled={loading}
          className="self-end flex items-center gap-2 bg-accent hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors disabled:opacity-60"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
          {loading ? "Running…" : "Run Simulation"}
        </button>
      </div>

      {/* ── Recommendation Banner ── */}
      {!loading && bestPath && (
        <div className="flex items-start gap-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4">
          <CheckCircle2 size={20} className="text-emerald-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-navy text-sm">
                Recommended Path: {PRESET_META[recommended]?.label ?? recommended}
              </span>
              <Badge variant="recommended">recommended</Badge>
              <Badge variant="predicted">predicted</Badge>
            </div>
            <p className="text-sm text-slate-600 mt-1">{bestPath.one_line_reason}</p>
          </div>
        </div>
      )}

      {/* ── 90-Day Monte Carlo Fan Chart ── */}
      {!loading && fanData.length > 0 && (
        <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-cardborder shadow-sm p-5">
          <h3 className="font-semibold text-navy mb-1">90-Day Cash-Flow Fan</h3>
          <p className="text-xs text-slate-400 mb-4">
            P10 / P50 / P90 bands — Baseline (do nothing) vs {PRESET_META[recommended]?.label ?? "Best path"}. 1,000 Monte Carlo paths.
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={fanData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D5E8DD" />
              <XAxis dataKey="day" ticks={fanTicks} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v, name) => [fmt(v), name]}
                labelStyle={{ fontSize: 11 }}
                contentStyle={{ fontSize: 12, borderRadius: 10 }}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />

              {/* Baseline band */}
              <Area type="monotone" dataKey="baseline_p90" stroke="none" fill="#94a3b8" fillOpacity={0.18} name="Baseline P90" legendType="none" />
              <Area type="monotone" dataKey="baseline_p10" stroke="none" fill="#ffffff" fillOpacity={1} name="" legendType="none" />
              <Line type="monotone" dataKey="baseline_p50" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Baseline P50" />

              {/* Scenario band */}
              <Area type="monotone" dataKey="scenario_p90" stroke="none" fill="#10b981" fillOpacity={0.2} name="Scenario P90" legendType="none" />
              <Area type="monotone" dataKey="scenario_p10" stroke="none" fill="#ffffff" fillOpacity={1} name="" legendType="none" />
              <Line type="monotone" dataKey="scenario_p50" stroke="#10b981" strokeWidth={2} dot={false} name="Scenario P50" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Loading state ── */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-16 text-slate-400 text-sm">
          <Loader2 size={20} className="animate-spin text-accent" /> Running 1,000 Monte Carlo paths…
        </div>
      )}

      {/* ── Path Comparison Cards ── */}
      {!loading && paths.length > 0 && (
        <div>
          <h3 className="font-semibold text-navy mb-3">Path Comparison</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paths.map((p) => (
              <PathCard
                key={p.preset}
                path={p}
                isRecommended={p.preset === recommended}
                priority={priority}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
