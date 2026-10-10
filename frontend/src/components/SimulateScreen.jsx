import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ShieldCheck,
  TrendingDown,
  RefreshCcw,
  CreditCard,
  HeartPulse,
  Briefcase,
  AlertTriangle,
  PlayCircle,
  Scissors,
  Landmark,
  ArrowUpRight,
  CheckCircle2,
  SlidersHorizontal,
  Zap,
  Loader2,
  Info,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { compareSimulationPaths, getShockCapacity } from "../api";

// ─── Preset Metadata & Definitions ──────────────────────────────────────────
// Supported presets per SpendShield specification:
// "cut spend", "refinance", "do nothing", "new EMI", "medical emergency",
// "income -30%", "job loss", "EMI +12%"
export const PRESETS = [
  {
    id: "do_nothing",
    kind: "do_nothing",
    label: "Do Nothing",
    shortLabel: "Baseline",
    description: "Status quo cashflow continuation without modifications",
    icon: PlayCircle,
    color: "#64748B", // slate
    defaultParams: {},
    baseTag: "Observed",
  },
  {
    id: "cut_spend",
    kind: "cut_spend",
    label: "Cut Spend",
    shortLabel: "Cut Spend",
    description: "Reduce discretionary spending by 20% (approx ₹3,000/mo)",
    icon: Scissors,
    color: "#10B981", // emerald
    defaultParams: { cut_fraction: 0.2, monthly_saving: 3000 },
    baseTag: "Predicted",
  },
  {
    id: "refinance",
    kind: "refinance",
    label: "Refinance",
    shortLabel: "Refinance",
    description: "Restructure loans to lower total EMI obligations by 10%",
    icon: Landmark,
    color: "#3B82F6", // blue
    defaultParams: { saving_fraction: 0.1 },
    baseTag: "Predicted",
  },
  {
    id: "new_emi",
    kind: "new_emi",
    label: "New EMI",
    shortLabel: "New EMI",
    description: "Add a ₹50,000 purchase with ₹4,200/mo EMI for 12 months",
    icon: CreditCard,
    color: "#F59E0B", // amber
    defaultParams: { amount: 50000, emi: 4200, tenure_months: 12 },
    baseTag: "Predicted",
  },
  {
    id: "medical",
    kind: "medical",
    label: "Medical Emergency",
    shortLabel: "Medical Shock",
    description: "Sudden out-of-pocket medical emergency of ₹25,000",
    icon: HeartPulse,
    color: "#EF4444", // rose
    defaultParams: { amount: 25000 },
    baseTag: "Predicted",
  },
  {
    id: "income_drop_30",
    kind: "income_drop_30",
    label: "Income -30%",
    shortLabel: "Income -30%",
    description: "Simulate a 30% reduction in monthly incoming cashflows",
    icon: TrendingDown,
    color: "#EA580C", // orange
    defaultParams: { drop_fraction: 0.3 },
    baseTag: "Predicted",
  },
  {
    id: "job_loss",
    kind: "job_loss",
    label: "Job Loss",
    shortLabel: "Job Loss",
    description: "Simulate an abrupt halt to primary salary income",
    icon: Briefcase,
    color: "#DC2626", // red
    defaultParams: {},
    baseTag: "Predicted",
  },
  {
    id: "emi_hike_12",
    kind: "emi_hike_12",
    label: "EMI +12%",
    shortLabel: "EMI +12%",
    description: "Benchmark interest rate increase adding 12% to loan payments",
    icon: ArrowUpRight,
    color: "#8B5CF6", // purple
    defaultParams: { hike_fraction: 0.12 },
    baseTag: "Predicted",
  },
];

// Quick 3-path comparison bundles
const PRESET_BUNDLES = [
  {
    label: "Prudent Options",
    subtext: "Baseline vs Cut Spend vs Refinance",
    presets: ["do_nothing", "cut_spend", "refinance"],
  },
  {
    label: "Purchase Evaluation",
    subtext: "Baseline vs New EMI vs Cut Spend",
    presets: ["do_nothing", "new_emi", "cut_spend"],
  },
  {
    label: "Stress-Test Suite",
    subtext: "Medical Emergency vs Income -30% vs Job Loss",
    presets: ["medical", "income_drop_30", "job_loss"],
  },
];

// ─── Formatters ─────────────────────────────────────────────────────────────
function inr(value) {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return `₹${Math.round(Number(value)).toLocaleString("en-IN")}`;
}

function percent(value) {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

// ─── Chip Styles ────────────────────────────────────────────────────────────
const CHIP_STYLES = {
  Observed: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  Predicted: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  Recommended: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300 font-bold",
};

// ─── Path Metric Item ───────────────────────────────────────────────────────
function MetricItem({ label, value, subtext, status = "neutral" }) {
  const statusStyles = {
    neutral: "text-navy",
    good: "text-emerald-700",
    warning: "text-amber-600",
    risk: "text-red-600",
  };

  return (
    <div className="flex flex-col bg-slate-50/70 rounded-xl p-3 border border-slate-100">
      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={`text-base font-bold mt-0.5 ${statusStyles[status]}`}>{value}</span>
      {subtext && <span className="text-[11px] text-slate-500 mt-0.5">{subtext}</span>}
    </div>
  );
}

// ─── Path Card ──────────────────────────────────────────────────────────────
function PathCard({ path, index, recommendedKind, priority }) {
  const presetConfig = PRESETS.find((p) => p.kind === path.kind || p.id === path.kind) || {
    label: path.kind || `Path ${index + 1}`,
    description: "Custom scenario simulation",
    icon: PlayCircle,
    color: "#0F766E",
  };

  const Icon = presetConfig.icon;
  const isRecommended = path.kind === recommendedKind || path.tag === "recommended";

  // Label chips strictly as Observed, Predicted, or Recommended
  const chipType = isRecommended
    ? "Recommended"
    : path.kind === "do_nothing" || path.tag === "observed"
    ? "Observed"
    : "Predicted";

  const buffer = path.buffer || {};
  const shortfallProb = path.shortfall_prob ?? 0;
  const dti = path.new_dti ?? 0;
  const runway = path.runway_days ?? 0;

  const shortfallStatus = shortfallProb <= 0.1 ? "good" : shortfallProb <= 0.25 ? "warning" : "risk";
  const dtiStatus = dti <= 0.3 ? "good" : dti <= 0.4 ? "warning" : "risk";
  const runwayStatus = runway >= 90 ? "good" : runway >= 45 ? "warning" : "risk";

  return (
    <div
      className={`relative rounded-2xl border p-5 transition-all duration-200 flex flex-col justify-between ${
        isRecommended
          ? "border-emerald-400 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-md shadow-emerald-900/5"
          : "border-cardborder bg-white shadow-sm hover:shadow-md"
      }`}
    >
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-sm"
              style={{ backgroundColor: presetConfig.color }}
            >
              <Icon size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Path {index + 1}
                </span>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full ${CHIP_STYLES[chipType]}`}>
                  {chipType}
                </span>
              </div>
              <h3 className="font-bold text-navy text-lg leading-tight mt-0.5">
                {presetConfig.label}
              </h3>
            </div>
          </div>
        </div>

        {/* Path Description */}
        <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
          {presetConfig.description}
        </p>

        {isRecommended && (
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-100/70 text-emerald-800 text-xs font-semibold">
            <CheckCircle2 size={14} className="text-emerald-600" />
            Ranked #{index + 1} for {priority === "safest" ? "lowest shortfall probability" : "highest net cash buffer"}
          </div>
        )}

        {/* Required Primary Metrics */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <MetricItem
            label="Shortfall Chance"
            value={percent(shortfallProb)}
            subtext="90-day cash < 0 risk"
            status={shortfallStatus}
          />
          <MetricItem
            label="New DTI"
            value={percent(dti)}
            subtext="Debt-to-income share"
            status={dtiStatus}
          />
          <MetricItem
            label="Runway"
            value={`${runway} days`}
            subtext="Survival without income"
            status={runwayStatus}
          />
          <MetricItem
            label="P50 Buffer (Median)"
            value={inr(buffer.p50)}
            subtext="Expected 90-day cash"
            status="neutral"
          />
        </div>

        {/* P10 / P50 / P90 Quantile Distribution */}
        <div className="mt-4 rounded-xl border border-slate-100 bg-white/80 p-3.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
            <span>Buffer Quantiles</span>
            <span className="text-[11px] font-normal text-slate-400">1,000 Monte Carlo futures</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50 rounded-lg p-2">
              <span className="block text-[10px] uppercase font-semibold text-slate-400">P10 (Stress)</span>
              <span className="block text-xs font-bold text-slate-700 mt-0.5">{inr(buffer.p10)}</span>
            </div>
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-lg p-2">
              <span className="block text-[10px] uppercase font-semibold text-emerald-700">P50 (Median)</span>
              <span className="block text-xs font-bold text-emerald-900 mt-0.5">{inr(buffer.p50)}</span>
            </div>
            <div className="bg-slate-50 rounded-lg p-2">
              <span className="block text-[10px] uppercase font-semibold text-slate-400">P90 (Upside)</span>
              <span className="block text-xs font-bold text-slate-700 mt-0.5">{inr(buffer.p90)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Evidence Tags */}
      {path.evidence && path.evidence.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Evidence:</span>
          {path.evidence.map((ev, i) => (
            <span
              key={i}
              className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md"
            >
              {ev}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Decision Simulator (F5) Screen ─────────────────────────────────────
export default function SimulateScreen({ sessionId }) {
  // 3 active presets to compare in the three-path view
  const [selectedPresets, setSelectedPresets] = useState(["do_nothing", "cut_spend", "refinance"]);
  const [sortOption, setSortOption] = useState("safest"); // "safest" vs "cheapest"

  // Shock Capacity state
  const [shockData, setShockData] = useState(null);
  const [shockLoading, setShockLoading] = useState(true);
  const [shockError, setShockError] = useState(null);

  // Simulation state
  const [simulationResults, setSimulationResults] = useState([]);
  const [recommendedKind, setRecommendedKind] = useState("");
  const [simulationLoading, setSimulationLoading] = useState(true);
  const [simulationError, setSimulationError] = useState(null);

  // Active risk threshold for Shock Capacity bisection (default 10%)
  const [riskLimit, setRiskLimit] = useState(0.1);

  // ── Fetch Shock Capacity ──
  const fetchShock = useCallback(
    async (limitVal = riskLimit) => {
      setShockLoading(true);
      setShockError(null);
      try {
        const data = await getShockCapacity(sessionId, limitVal);
        setShockData(data);
      } catch (err) {
        setShockError(err.message || "Failed to load shock capacity");
      } finally {
        setShockLoading(false);
      }
    },
    [sessionId, riskLimit]
  );

  // ── Fetch 3-Path Simulation ──
  const runSimulation = useCallback(
    async (presetList = selectedPresets) => {
      setSimulationLoading(true);
      setSimulationError(null);
      try {
        const scenarios = presetList.slice(0, 3).map((pid) => {
          const conf = PRESETS.find((p) => p.id === pid || p.kind === pid) || PRESETS[0];
          return {
            kind: conf.kind,
            params: conf.defaultParams,
            horizon_days: 90,
            seed: 42,
          };
        });

        const data = await compareSimulationPaths(scenarios, sessionId);
        const paths = data.results || (Array.isArray(data) ? data : []);
        setSimulationResults(paths);
        setRecommendedKind(data.recommended || data.recommended_path || paths[0]?.kind || "");
      } catch (err) {
        setSimulationError(err.message || "Simulation failed");
      } finally {
        setSimulationLoading(false);
      }
    },
    [selectedPresets, sessionId]
  );

  // Initial load on mount or session change
  useEffect(() => {
    fetchShock(riskLimit);
    runSimulation(selectedPresets);
  }, [sessionId]);

  // Handler to change a specific path slot
  const handleSlotChange = (slotIndex, newPresetId) => {
    const updated = [...selectedPresets];
    updated[slotIndex] = newPresetId;
    setSelectedPresets(updated);
    runSimulation(updated);
  };

  // Handler to toggle preset buttons
  const handlePresetToggle = (presetId) => {
    if (selectedPresets.includes(presetId)) {
      if (selectedPresets.length > 1) {
        const updated = selectedPresets.filter((id) => id !== presetId);
        setSelectedPresets(updated);
        runSimulation(updated);
      }
    } else {
      let updated;
      if (selectedPresets.length < 3) {
        updated = [...selectedPresets, presetId];
      } else {
        // Replace the last slot if 3 are already selected
        updated = [selectedPresets[0], selectedPresets[1], presetId];
      }
      setSelectedPresets(updated);
      runSimulation(updated);
    }
  };

  // Handler for quick bundles
  const handleSelectBundle = (bundlePresets) => {
    setSelectedPresets(bundlePresets);
    runSimulation(bundlePresets);
  };

  // Sort paths based on Safest vs Cheapest toggle
  const sortedPaths = useMemo(() => {
    const list = [...simulationResults];
    if (sortOption === "safest") {
      // Safest: lowest shortfall probability first, then highest buffer
      return list.sort((a, b) => {
        const diff = (a.shortfall_prob ?? 1) - (b.shortfall_prob ?? 1);
        if (Math.abs(diff) > 0.001) return diff;
        return (b.buffer?.p50 ?? 0) - (a.buffer?.p50 ?? 0);
      });
    } else {
      // Cheapest: highest median buffer (least net negative capital impact) first, then lowest shortfall
      return list.sort((a, b) => {
        const diff = (b.buffer?.p50 ?? 0) - (a.buffer?.p50 ?? 0);
        if (Math.abs(diff) > 100) return diff;
        return (a.shortfall_prob ?? 1) - (b.shortfall_prob ?? 1);
      });
    }
  }, [simulationResults, sortOption]);

  // Chart data preparing P10/P50/P90 buffer quantiles for Recharts visual comparison
  const chartData = useMemo(() => {
    return sortedPaths.map((p, idx) => {
      const presetConf = PRESETS.find((item) => item.kind === p.kind || item.id === p.kind);
      return {
        name: presetConf?.shortLabel || `Path ${idx + 1}`,
        kind: p.kind,
        P10: Math.round(p.buffer?.p10 ?? 0),
        P50: Math.round(p.buffer?.p50 ?? 0),
        P90: Math.round(p.buffer?.p90 ?? 0),
        shortfall: Math.round((p.shortfall_prob ?? 0) * 100),
      };
    });
  }, [sortedPaths]);

  return (
    <div className="space-y-6">
      {/* ── 1. Shock Capacity Card ── */}
      <section className="relative overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-teal-50/60 to-white p-6 shadow-sm">
        <div className="absolute right-0 top-0 -mt-6 -mr-6 w-48 h-48 bg-emerald-200/30 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center flex-shrink-0 text-white shadow-lg shadow-emerald-700/20">
              <ShieldCheck size={30} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Shock Capacity (H2)
                </span>
                <span className="rounded-full bg-emerald-100/90 text-emerald-800 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-emerald-300">
                  Calibrated to 10% Risk Threshold
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-navy tracking-tight mt-1">
                {shockLoading ? (
                  <span className="flex items-center gap-2 text-slate-400 text-xl font-medium">
                    <Loader2 size={20} className="animate-spin text-emerald-600" />
                    Calculating largest absorbable shock…
                  </span>
                ) : shockError ? (
                  <span className="text-red-600 text-base font-medium">{shockError}</span>
                ) : (
                  <span>{inr(shockData?.largest_absorbable_shock ?? 0)}</span>
                )}
              </h2>
              <p className="text-xs md:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                The largest unexpected one-time expense (medical bill, urgent repair, or family emergency)
                you can absorb right now before your 90-day cash shortfall risk passes{" "}
                <span className="font-semibold text-navy">
                  {percent(shockData?.limit ?? riskLimit)}
                </span>
                . Found via bisection across 1,000 Monte Carlo futures.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center flex-shrink-0">
            <button
              type="button"
              onClick={() => fetchShock(riskLimit)}
              disabled={shockLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-300 bg-white/80 hover:bg-white text-emerald-800 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCcw size={14} className={shockLoading ? "animate-spin" : ""} />
              Recalculate
            </button>
          </div>
        </div>

        {shockData?.evidence && (
          <div className="mt-4 pt-4 border-t border-emerald-200/50 flex flex-wrap items-center gap-2 text-xs text-emerald-900/80">
            <span className="font-semibold text-[11px] uppercase tracking-wider text-emerald-700">Proof Evidence:</span>
            {shockData.evidence.map((ev, i) => (
              <span key={i} className="bg-emerald-100/70 text-emerald-800 px-2 py-0.5 rounded-md font-mono text-[11px]">
                {ev}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ── 2. Scenario Presets & Path Slots Selector ── */}
      <section className="rounded-3xl border border-cardborder bg-white p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-accent" />
              <h2 className="text-lg font-bold text-navy">Decision Simulator Presets</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select and compare up to three paths to evaluate cashflow impact, debt pressure, and runway.
            </p>
          </div>

          {/* Quick Bundles */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">Presets:</span>
            {PRESET_BUNDLES.map((bundle, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectBundle(bundle.presets)}
                className="text-xs px-3 py-1.5 rounded-xl border border-cardborder bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 font-medium transition-all"
              >
                {bundle.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3 Explicit Path Dropdown Slots */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((slotIdx) => {
            const currentPresetId = selectedPresets[slotIdx] || PRESETS[slotIdx].id;
            return (
              <div key={slotIdx} className="bg-canvas/50 rounded-2xl border border-cardborder p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Path Slot {slotIdx + 1}
                  </span>
                  <span className="text-[11px] text-accent font-semibold">Active in Comparison</span>
                </div>

                <label htmlFor={`slot-select-${slotIdx}`} className="sr-only">
                  Choose scenario for Path {slotIdx + 1}
                </label>
                <select
                  id={`slot-select-${slotIdx}`}
                  value={currentPresetId}
                  onChange={(e) => handleSlotChange(slotIdx, e.target.value)}
                  className="w-full bg-white border border-cardborder rounded-xl px-3 py-2 text-sm font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} — {p.description.slice(0, 38)}…
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        {/* 8 Preset Toggle Buttons (Clickable Grid) */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 mb-2.5">
            All 8 Presets (click to add or toggle in comparison):
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {PRESETS.map((preset) => {
              const Icon = preset.icon;
              const isSelected = selectedPresets.includes(preset.id) || selectedPresets.includes(preset.kind);
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetToggle(preset.id)}
                  className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-50/70 text-emerald-950 font-semibold ring-1 ring-emerald-500/30"
                      : "border-cardborder bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white"
                    style={{ backgroundColor: preset.color }}
                  >
                    <Icon size={14} />
                  </div>
                  <div className="overflow-hidden">
                    <span className="block text-xs font-bold truncate">{preset.label}</span>
                    <span className="block text-[10px] text-slate-400 truncate">{preset.baseTag}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sort & Compare Toolbar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
          {/* Safest vs Cheapest Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Ranking Priority:</span>
            <div className="inline-flex rounded-xl border border-cardborder bg-canvas p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setSortOption("safest")}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                  sortOption === "safest"
                    ? "bg-navy text-white shadow-sm"
                    : "text-slate-600 hover:text-navy"
                }`}
              >
                Safest (Min Risk)
              </button>
              <button
                type="button"
                onClick={() => setSortOption("cheapest")}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                  sortOption === "cheapest"
                    ? "bg-navy text-white shadow-sm"
                    : "text-slate-600 hover:text-navy"
                }`}
              >
                Cheapest (Max Buffer)
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => runSimulation(selectedPresets)}
            disabled={simulationLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-accent hover:bg-emerald-700 text-white px-5 py-2.5 text-sm font-semibold shadow-sm transition-all disabled:opacity-60"
          >
            {simulationLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {simulationLoading ? "Simulating 1,000 paths…" : "Compare 3 Paths"}
          </button>
        </div>
      </section>

      {/* ── Error Banner ── */}
      {simulationError && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-risk shadow-sm">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <span>{simulationError}</span>
        </div>
      )}

      {/* ── 3. Three-Path Comparison View ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-navy">Three-Path Comparison</h2>
            <p className="text-xs text-slate-500">
              Evaluated with weekly-block Monte Carlo resampling over 90 days. Sorted by{" "}
              <span className="font-semibold text-navy uppercase">{sortOption}</span>.
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-600">
            {sortedPaths.length} Scenarios Evaluated
          </span>
        </div>

        {simulationLoading ? (
          <div className="rounded-3xl border border-cardborder bg-white p-16 flex flex-col items-center justify-center gap-3 text-slate-500 shadow-sm">
            <Loader2 size={32} className="animate-spin text-accent" />
            <p className="font-semibold text-navy text-base">Running Monte Carlo Path Comparison…</p>
            <p className="text-xs text-slate-400">Resampling 1,000 simulated futures per path</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {sortedPaths.map((path, idx) => (
              <PathCard
                key={`${path.kind}-${idx}`}
                path={path}
                index={idx}
                recommendedKind={recommendedKind}
                priority={sortOption}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── 4. Recharts Visual Buffer Comparison Chart ── */}
      {!simulationLoading && sortedPaths.length > 0 && (
        <section className="rounded-3xl border border-cardborder bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-navy text-base">90-Day Buffer Quantiles (Recharts Comparison)</h3>
              <p className="text-xs text-slate-400">
                P10 (downside stress case), P50 (median expected balance), and P90 (favorable outcome) in INR
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400">Monte Carlo Fan Summary</span>
            </div>
          </div>

          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 15, left: 15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#475569", fontSize: 12, fontWeight: 600 }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                  tick={{ fill: "#64748B", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(val, name) => [inr(val), name]}
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "12px",
                    border: "1px solid #CBD5E1",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }}
                  formatter={(value) => <span className="text-slate-700 font-medium">{value}</span>}
                />
                <ReferenceLine y={0} stroke="#94A3B8" strokeWidth={1.5} />
                <Bar dataKey="P10" name="P10 Buffer (Stress)" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="P50" name="P50 Buffer (Median)" fill="#0D9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="P90" name="P90 Buffer (Upside)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── 5. Decision Support & Readiness Note ── */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 flex items-start gap-3 text-xs text-slate-500">
        <Info size={18} className="text-accent mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold text-navy">
            Decision Support Guarantee & Readiness Context (F5 Engine)
          </p>
          <p className="leading-relaxed">
            SpendShield compares scenarios to answer "Can I absorb this obligation?" before commitment.
            Outputs do not make credit-scoring claims, loan approvals, or investment advice. Shock Capacity and
            conformal quantiles are calculated deterministically via NumPy Monte Carlo resampling.
          </p>
        </div>
      </section>
    </div>
  );
}
