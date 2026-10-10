// frontend/CashReserveControl.jsx — Minimum Cash Reserve Floor component.
import React, { useState } from "react";
import { Shield, Check } from "lucide-react";

export default function CashReserveControl({ initialReserve = 45000, onReserveChange }) {
  const [reserve, setReserve] = useState(initialReserve);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const presets = [25000, 45000, 60000];

  const handleSave = async (val) => {
    const num = Number(val);
    setReserve(num);
    setLoading(true);
    try {
      await fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reserve: num }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (onReserveChange) onReserveChange(num);
    } catch (e) {
      console.error("Failed to update reserve", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Shield size={18} className="text-emerald-600" />
        <h3 className="text-sm font-bold text-slate-800">Minimum Cash Reserve Floor</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Your non-negotiable liquidity buffer. Any sequence dipping below this floor triggers breach alerts.
      </p>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-2.5 text-xs font-semibold text-slate-400">₹</span>
          <input
            type="number"
            min="0"
            step="1000"
            value={reserve}
            onChange={(e) => setReserve(Number(e.target.value))}
            className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => handleSave(reserve)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          {saved ? <Check size={14} className="text-emerald-400" /> : null}
          {saved ? "Saved" : "Update Floor"}
        </button>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <span className="text-[11px] text-slate-400 font-medium">Quick Presets:</span>
        {presets.map((amt) => (
          <button
            key={amt}
            type="button"
            onClick={() => handleSave(amt)}
            className={`px-2.5 py-1 text-xs rounded-md border transition-all ${
              reserve === amt
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            ₹{amt.toLocaleString()}
          </button>
        ))}
      </div>
    </div>
  );
}
