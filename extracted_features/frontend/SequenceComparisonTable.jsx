// frontend/SequenceComparisonTable.jsx — Decoupled 8-Week Sequence Table.
import React, { useState, useEffect } from "react";
import { ShieldCheck, AlertTriangle } from "lucide-react";

export default function SequenceComparisonTable({ reserve = 45000 }) {
  const [data, setData] = useState(null);
  const [activeSeqId, setActiveSeqId] = useState("S0");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/simulate-sequences?reserve=${reserve}`)
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        if (json.recommended_sequence_id) {
          setActiveSeqId(json.recommended_sequence_id);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [reserve]);

  if (loading) return <div className="p-6 text-xs text-slate-500 bg-white rounded-xl border border-slate-200">Running Monte Carlo simulation (500 paths)...</div>;
  if (!data || !data.sequences) return null;

  const currentSeq = data.sequences.find((s) => s.id === activeSeqId) || data.sequences[0];
  const periods = currentSeq.periods || [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
      {/* Sequence Header & Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
        <div className="flex gap-2">
          {data.sequences.map((seq) => {
            const isRec = seq.id === data.recommended_sequence_id;
            const isSelected = seq.id === activeSeqId;
            return (
              <button
                key={seq.id}
                type="button"
                onClick={() => setActiveSeqId(seq.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  isSelected ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>{seq.name}</span>
                {isRec && <span className="bg-emerald-400 text-slate-900 text-[10px] px-1 rounded font-bold">RECOMMENDED</span>}
              </button>
            );
          })}
        </div>

        {currentSeq.summary && (
          <div className="flex items-center gap-3 text-xs">
            <div>
              <span className="text-slate-400">Breach Risk: </span>
              <span className={`font-bold ${currentSeq.summary.any_week_breach_prob > 0.15 ? "text-amber-600" : "text-emerald-700"}`}>
                {(currentSeq.summary.any_week_breach_prob * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-slate-400">Min P10: </span>
              <span className="font-bold text-slate-800">₹{Math.round(currentSeq.summary.min_p10_closing).toLocaleString()}</span>
            </div>
            {currentSeq.summary.total_cut > 0 && (
              <div>
                <span className="text-slate-400">Total Cut: </span>
                <span className="font-bold text-rose-700">₹{Math.round(currentSeq.summary.total_cut).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 8-Week Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
            <tr>
              <th className="px-3 py-2.5">Period</th>
              <th className="px-3 py-2.5">Opening</th>
              <th className="px-3 py-2.5">Income</th>
              <th className="px-3 py-2.5">Essentials</th>
              <th className="px-3 py-2.5">Discretionary</th>
              <th className="px-3 py-2.5">Closing P10</th>
              <th className="px-3 py-2.5">Closing P50</th>
              <th className="px-3 py-2.5">Closing P90</th>
              <th className="px-3 py-2.5">Breach Risk</th>
              <th className="px-3 py-2.5">Trade-off Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {periods.map((p) => {
              const breachPct = (p.reserve_breach_prob || 0) * 100;
              const isHigh = breachPct > 15;
              return (
                <tr key={p.week} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-3 py-2 font-bold text-slate-900">{p.period_label}</td>
                  <td className="px-3 py-2">₹{Math.round(p.opening_balance).toLocaleString()}</td>
                  <td className="px-3 py-2 text-emerald-700 font-medium">+₹{Math.round(p.income_p50).toLocaleString()}</td>
                  <td className="px-3 py-2 text-rose-700 font-medium">-₹{Math.round(p.essentials).toLocaleString()}</td>
                  <td className="px-3 py-2 text-slate-500">-₹{Math.round(p.discretionary).toLocaleString()}</td>
                  <td className="px-3 py-2 text-rose-600">₹{Math.round(p.closing_p10).toLocaleString()}</td>
                  <td className="px-3 py-2 font-bold text-slate-900">₹{Math.round(p.closing_p50).toLocaleString()}</td>
                  <td className="px-3 py-2 text-emerald-800">₹{Math.round(p.closing_p90).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isHigh ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"
                    }`}>
                      {breachPct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-slate-500 max-w-xs truncate">{p.tradeoff_note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
