// Contract-backed attention panel for HackMatrix 5.0.
// `alerts` is supplied by the engine's analyze response; this component only
// renders the evidence and never invents a financial signal.

import { AlertTriangle } from "lucide-react";

const SEVERITY_STYLES = {
  Critical: "bg-risk/10 text-risk border-risk/20",
  High: "bg-risk/10 text-risk border-risk/20",
  Medium: "bg-attention/10 text-attention border-attention/20",
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function formatInr(amount) {
  return `Rs ${Number(amount || 0).toLocaleString("en-IN")}`;
}

function SilentCreepCard({ alerts }) {
  const creep = alerts.find((alert) => alert.mode === "silent_creep");
  if (!creep) return null;

  return (
    <div className="mt-3 rounded-lg border border-attention/20 bg-attention/10 p-3 text-attention">
      <p className="text-sm font-semibold">Silent Creep</p>
      <p className="mt-1 text-sm">
        {formatInr(creep.extra_per_month)}/month = {formatInr(creep.extra_per_year)}/year
      </p>
    </div>
  );
}

function AttentionPanel({ alerts = [] }) {
  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-[14px] border border-cardborder shadow-sm p-5">
        <p className="text-sm font-medium text-navy mb-1">What Needs Attention</p>
        <p className="text-sm text-slate-400">Nothing unusual detected right now.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[14px] border border-cardborder shadow-sm p-5">
      <p className="text-sm font-medium text-navy mb-3">What Needs Attention</p>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`flex gap-3 p-3 rounded-lg border ${SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.Medium}`}
          >
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{alert.title}</p>
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full bg-white/60 px-2 py-0.5 font-medium">{alert.severity}</span>
                {alert.evidence?.map((item) => (
                  <span key={item} className="rounded-full bg-white/60 px-2 py-0.5">Evidence: {item}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <SilentCreepCard alerts={alerts} />
    </div>
  );
}

export default AttentionPanel;
