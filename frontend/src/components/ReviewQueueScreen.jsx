// src/components/ReviewQueueScreen.jsx — Feature 4 Active-Learning Categoriser

import { useEffect, useState } from "react";
import { fetchReviewQueue, submitCategoryCorrection, submitTransaction, fetchCalibration } from "../api";
import { Loader2, CheckCircle2, AlertTriangle, Plus, Activity, Info, Tag, Scale, Database } from "lucide-react";

const CATEGORIES = [
  "Income", "Housing", "Debt Payment", "Subscriptions", "Utilities",
  "Food & Dining", "Groceries", "Shopping", "Entertainment", "Transport",
  "Travel", "Health", "Uncategorised"
];

const fmt = (n) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function ReviewQueueScreen({ sessionId }) {
  const [queue, setQueue] = useState([]);
  const [calibration, setCalibration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrainingFeedback, setRetrainingFeedback] = useState(null);

  // Live Add Transaction State
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [type, setType] = useState("debit");
  const [liveResult, setLiveResult] = useState(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    Promise.all([fetchReviewQueue(sessionId), fetchCalibration(sessionId)])
      .then(([queueRes, calibRes]) => {
        setQueue(queueRes.items || []);
        setCalibration(calibRes);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [sessionId]);

  const handleCorrect = (id, newCategory) => {
    setRetrainingFeedback(null);
    submitCategoryCorrection({ transaction_id: id, corrected_category: newCategory }, sessionId)
      .then((res) => {
        setRetrainingFeedback({ id, acc: res.new_accuracy });
        setQueue((prev) => prev.filter((item) => item.transaction_id !== id));
      })
      .catch((err) => console.error(err));
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!merchant || !amount) return;
    setAdding(true);
    setLiveResult(null);
    const payload = {
      transaction: {
        description: merchant,
        amount: parseFloat(amount),
        date: date,
        transaction_type: type,
        category: null
      }
    };
    submitTransaction(payload).then((res) => {
      setLiveResult(res);
      setMerchant("");
      setAmount("");
      setAdding(false);
    }).catch(err => {
      console.error(err);
      setAdding(false);
    });
  };

  return (
    <div className="flex flex-col gap-8">
      {/* ── Active Learning Review Queue ── */}
      <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-cardborder shadow-sm p-6">
        <div className="flex items-center gap-2 mb-2">
          <Activity size={20} className="text-teal-600" />
          <h2 className="text-xl font-bold text-navy">Categoriser Review Queue</h2>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          The ML model (TF-IDF + Logistic Regression) routes low-confidence predictions here. 
          Correcting a category retrains the model instantly.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 py-4 text-sm">
            <Loader2 size={16} className="animate-spin" /> Loading queue...
          </div>
        ) : queue.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-4 rounded-xl text-sm border border-emerald-100">
            <CheckCircle2 size={16} /> All caught up! The model is highly confident on all recent transactions.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {queue.map((item) => (
              <div key={item.transaction_id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold text-navy">{item.description}</span>
                    <span className="text-sm text-slate-500 font-medium">{fmt(item.amount)}</span>
                    <span className="text-xs text-slate-400">{item.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Tag size={12} className="text-amber-500" />
                    <span className="text-amber-700 font-medium bg-amber-100/50 px-2 py-0.5 rounded-full">
                      Predicted: {item.predicted_category}
                    </span>
                    <span className="text-slate-400 flex items-center gap-1 group relative cursor-help">
                      <Info size={12} />
                      <span className="underline decoration-dotted">Confidence: {Math.round(item.confidence_score * 100)}%</span>
                      {/* Tooltip */}
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max px-2 py-1 bg-navy text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                        {item.why_tooltip || "model confidence < 60%"}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    className="text-sm border border-slate-200 rounded-lg p-2 bg-white text-navy outline-none focus:border-teal-500"
                    defaultValue={item.predicted_category}
                    onChange={(e) => { item.selected_correction = e.target.value; }}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    onClick={() => handleCorrect(item.transaction_id, item.selected_correction || item.predicted_category)}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Approve / Retrain
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {retrainingFeedback && (
          <div className="mt-4 flex items-center gap-2 text-teal-700 bg-teal-50 p-3 rounded-lg border border-teal-100 text-sm animate-in fade-in slide-in-from-top-2">
            <Activity size={16} /> 
            <span>Model retrained successfully. New held-out accuracy: <strong>{(retrainingFeedback.acc * 100).toFixed(1)}%</strong>.</span>
          </div>
        )}
      </div>

      {/* ── Live Add Transaction ── */}
      <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-cardborder shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <Plus size={20} className="text-emerald-600" />
          <h2 className="text-xl font-bold text-navy">Live Transaction Feed</h2>
        </div>
        
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-xs font-medium text-slate-500">Merchant / Narration</label>
            <input 
              required type="text" value={merchant} onChange={e => setMerchant(e.target.value.toUpperCase())}
              placeholder="e.g. UPI-VISHAL-STORE"
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500">Amount (₹)</label>
            <input 
              required type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="500"
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500">Type</label>
            <select 
              value={type} onChange={e => setType(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-500"
            >
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
          </div>
          <button type="submit" disabled={adding} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors flex justify-center items-center h-[38px]">
            {adding ? <Loader2 size={16} className="animate-spin" /> : "Simulate Spend"}
          </button>
        </form>

        {liveResult && (
          <div className="mt-6 p-5 border border-emerald-200 bg-emerald-50/50 rounded-xl animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={20} className="text-emerald-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-navy">Transaction Processed</h4>
                <p className="text-sm text-slate-600 mt-1">
                  Categorised as <strong>{liveResult.categorised_as}</strong> (Confidence: {Math.round(liveResult.confidence * 100)}%).
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-white border border-emerald-100 rounded text-xs font-medium text-emerald-800 shadow-sm">
                    Twin Model Recalculated
                  </span>
                  <span className="px-2.5 py-1 bg-white border border-emerald-100 rounded text-xs font-medium text-emerald-800 shadow-sm">
                    Simulator Updated
                  </span>
                </div>
                {liveResult.updated_simulation && (
                  <p className="mt-3 text-sm text-slate-700">
                    New Shortfall Probability: <strong className="text-red-600">{(liveResult.updated_simulation.paths[0].shortfall_prob_90d * 100).toFixed(1)}%</strong>. 
                    Recommendation: <strong>{liveResult.updated_simulation.recommended_path}</strong>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Dataset & RBI/NHA Calibration ── */}
      {calibration && (
        <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-cardborder shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database size={20} className="text-indigo-600" />
              <h2 className="text-xl font-bold text-navy">Dataset & RBI/NHA Calibration</h2>
            </div>
          </div>
          
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl mb-6">
            <p className="text-sm text-indigo-900 font-medium leading-relaxed">
              <strong>Mandatory Disclosure:</strong> {calibration.mandatory_disclosure || "Transaction data is synthetic, calibrated to published statistics, structurally based on a public dataset"}
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider flex items-center gap-1.5"><Scale size={14}/> Live Persona Alignment</h3>
              <div className="flex flex-col gap-3">
                {(calibration.alignment_tags || []).map((tag, i) => (
                  <div key={i} className="flex flex-col p-3 border border-slate-200 rounded-lg bg-slate-50/50">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-sm text-navy">{tag.metric}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${tag.status === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {tag.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-medium uppercase">Persona</span>
                        <span className="font-semibold text-slate-700">{tag.computed_persona_value}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-medium uppercase">Benchmark</span>
                        <span className="font-semibold text-slate-700">{tag.rbi_benchmark_value}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">{tag.tooltip}</p>
                    <div className="mt-1.5 text-[10px] font-medium text-indigo-600 flex items-center gap-1">
                      <Info size={10} /> Source: {tag.source}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider flex items-center gap-1.5"><Database size={14}/> Public Datasets</h3>
              <div className="flex flex-col gap-3">
                <div className="p-3 border border-slate-200 rounded-lg bg-white shadow-sm">
                  <h4 className="font-bold text-sm text-navy mb-1">Indian Personal Finance & Spending Habits</h4>
                  <p className="text-xs text-slate-500 mb-2">Source for demographic, income, and category distributions (Kaggle)</p>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">data.csv (20,000 rows)</span>
                </div>
                <div className="p-3 border border-slate-200 rounded-lg bg-white shadow-sm">
                  <h4 className="font-bold text-sm text-navy mb-1">Personal Transactions / Finance Dataset</h4>
                  <p className="text-xs text-slate-500 mb-2">Source for real-world merchant narrations mapped to 12 exact categories (Kaggle)</p>
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">personal_transactions.csv</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
