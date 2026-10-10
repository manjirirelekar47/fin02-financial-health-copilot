import { useState } from "react";
import { LockKeyhole, ShieldCheck, AlertTriangle, ArrowRight, RefreshCw, Zap, CheckCircle2 } from "lucide-react";
import { lockPath, getLockedPath, addLiveTransaction } from "../api";

export default function LockPathScreen({ sessionId }) {
  const activeSessionId = sessionId || (typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") : "") || "demo";
  const [goal, setGoal] = useState("Emergency Reserve Fund");
  const [requiredBalance, setRequiredBalance] = useState("60000");
  const [deadline, setDeadline] = useState("2026-12-31");
  const [priority, setPriority] = useState("High");
  const [categoryCeiling, setCategoryCeiling] = useState("3000");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [simulatingSurprise, setSimulatingSurprise] = useState(false);
  const [surpriseMessage, setSurpriseMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSurpriseMessage("");

    const targetAmount = Math.max(1000, Number(requiredBalance) || 60000);
    const ceilingAmount = Math.max(500, Number(categoryCeiling) || 3000);

    const payload = {
      id: "lp_1",
      goal: goal.trim() || "Financial Buffer Goal",
      deadline: deadline || "2026-12-31",
      required_balance: targetAmount,
      band: {
        p10: Math.round(targetAmount * 0.85),
        p50: targetAmount,
        p90: Math.round(targetAmount * 1.15),
      },
      category_ceilings: {
        food_delivery: ceilingAmount,
      },
      max_risk: 0.15,
      priority,
    };

    try {
      const data = await lockPath(payload, activeSessionId);
      setResult(data);
    } catch (err) {
      setError(err.message || "Failed to lock path");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecheck() {
    if (!result?.lock_id) return;
    setEvaluating(true);
    setError("");
    try {
      const updated = await getLockedPath(result.lock_id, activeSessionId);
      setResult(updated);
    } catch (err) {
      setError(err.message || "Failed to check drift");
    } finally {
      setEvaluating(false);
    }
  }

  async function handleSimulateSurprise() {
    setSimulatingSurprise(true);
    setError("");
    try {
      const surpriseTx = {
        date: new Date().toISOString().split("T")[0],
        narration: "Surprise Hospital Dental Clinic",
        amount: 12000,
        type: "debit",
        category: "health",
        priority: "High",
      };
      await addLiveTransaction(surpriseTx, activeSessionId);
      setSurpriseMessage("Simulated live ₹12,000 emergency expense added! Re-evaluating drift...");
      const updated = await getLockedPath(result?.lock_id || "lp_1", activeSessionId);
      setResult(updated);
    } catch (err) {
      setError(err.message || "Simulation failed");
    } finally {
      setSimulatingSurprise(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Session Header / Explainer */}
      <section className="rounded-2xl border border-cardborder bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-accent/10 p-2.5 text-accent">
              <LockKeyhole className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-navy">Decision Commitment & Reality Lock</h2>
              <p className="text-sm text-slate-500">
                Commit to a simulated trajectory. SpendShield will continuously monitor for plan drift.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Session: <span className="font-mono text-accent">{activeSessionId}</span>
          </span>
        </div>

        <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Goal Name
            </label>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Emergency Reserve Fund"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Target Deadline (YYYY-MM-DD)
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Target Buffer Balance (₹)
            </label>
            <input
              type="number"
              value={requiredBalance}
              onChange={(e) => setRequiredBalance(e.target.value)}
              placeholder="60000"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Food Delivery Ceiling (₹/mo)
            </label>
            <input
              type="number"
              value={categoryCeiling}
              onChange={(e) => setCategoryCeiling(e.target.value)}
              placeholder="3000"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Commitment Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent/90 disabled:opacity-60 transition"
            >
              {loading ? "Locking Baseline..." : "Lock this path"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* Result Section */}
      {result && (
        <section className="rounded-2xl border border-cardborder bg-white p-6 shadow-sm space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 text-navy">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-lg">Active Plan Drift Monitor</h3>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                Lock ID: {result.lock_id || "lp_1"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRecheck}
                disabled={evaluating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? "animate-spin" : ""}`} />
                {evaluating ? "Checking..." : "Re-check Drift"}
              </button>
              <button
                type="button"
                onClick={handleSimulateSurprise}
                disabled={simulatingSurprise}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold shadow-sm disabled:opacity-60 transition"
              >
                <Zap className="w-3.5 h-3.5" />
                {simulatingSurprise ? "Adding ₹12k..." : "Test Surprise ₹12k Expense"}
              </button>
            </div>
          </div>

          {surpriseMessage && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs font-medium text-amber-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{surpriseMessage}</span>
            </div>
          )}

          {/* Probabilities Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-xs font-semibold uppercase text-slate-500">Baseline Success Prob</span>
              <p className="mt-1 text-2xl font-black text-navy">
                {Math.round((result.success_prob_before ?? 0.92) * 100)}%
              </p>
              <span className="text-xs text-slate-400">At commitment time</span>
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
              <span className="text-xs font-semibold uppercase text-amber-800">Current Success Prob</span>
              <p className={`mt-1 text-2xl font-black ${result.success_prob_now < result.success_prob_before ? "text-amber-700" : "text-emerald-700"}`}>
                {Math.round((result.success_prob_now ?? 0.68) * 100)}%
              </p>
              <span className="text-xs text-amber-700/80">
                {result.success_prob_now < result.success_prob_before
                  ? `Drift: -${Math.round(((result.success_prob_before ?? 0.92) - (result.success_prob_now ?? 0.68)) * 100)}%`
                  : "On track"}
              </span>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-xs font-semibold uppercase text-slate-500">Estimated Timeline Delay</span>
              <p className="mt-1 text-2xl font-black text-navy">
                {result.delay_days ?? 0} days
              </p>
              <span className="text-xs text-slate-400">Due to unexpected friction</span>
            </div>
          </div>

          {/* Drift Cause */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">Plan Drift Reason</h4>
                <p className="mt-0.5 text-xs text-amber-800">
                  {result.reason || "Reality matched commitment; no drift detected."}
                </p>
              </div>
            </div>
          </div>

          {/* Recovery Options */}
          {result.recovery && result.recovery.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-navy mb-2.5">Recommended Automated Recovery Options</h4>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {result.recovery.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                    <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-accent/10 text-accent mb-1.5">
                      {item.action === "cut" ? "Cut Spend" : item.action === "delay" ? "Timeline Buffer" : "Budget Trimming"}
                    </span>
                    <p className="text-xs font-semibold text-navy">
                      {item.action === "cut" && `Cut ₹${item.amount?.toLocaleString("en-IN")} from ${item.target || "discretionary"}`}
                      {item.action === "delay" && `Delay milestone by ${item.days} days`}
                      {item.action === "reduce_budget" && `Reduce discretionary budget by ₹${item.amount?.toLocaleString("en-IN")}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
