// frontend/SilentCreepCard.jsx — Displays Silent Creep subscription drift alerts.
import React from "react";
import { TrendingUp, AlertTriangle } from "lucide-react";

export default function SilentCreepCard({ alerts = [] }) {
  const creepAlerts = alerts.filter((a) => a.mode === "silent_creep");
  if (creepAlerts.length === 0) return null;

  return (
    <div className="space-y-3">
      {creepAlerts.map((alert) => (
        <div
          key={alert.id}
          className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 flex items-start gap-3 shadow-sm"
        >
          <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0 mt-0.5">
            <TrendingUp size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-amber-900">{alert.title}</p>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded">
                Silent Creep
              </span>
            </div>
            <p className="text-xs text-amber-800 font-semibold mt-1">
              +₹{Number(alert.extra_per_month || 0).toLocaleString()}/month{" "}
              <span className="font-normal text-amber-700">
                (+₹{Number(alert.extra_per_year || 0).toLocaleString()}/year)
              </span>
            </p>
            {alert.evidence && alert.evidence.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {alert.evidence.map((ev, i) => (
                  <span
                    key={i}
                    className="text-[10px] bg-white/90 text-slate-600 px-2 py-0.5 rounded border border-amber-200 font-mono"
                  >
                    {ev}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
