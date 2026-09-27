// src/components/AttentionPanel.jsx — owned by Member 1.
//
// "What needs attention?" — the SpendShield spec's signature feature.
// Deliberately built ONLY from numbers we already compute (trend flags from
// /api/trends, drift % from /api/recurring) — no invented signals, no
// black-box scoring. Each alert states the concrete change; it doesn't
// make a decision for the user.
//
// Props:
//   trends    - object from /api/trends
//   recurring - object from /api/recurring ({ payments, total_monthly_burden })

import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";

function buildAlerts(trends, recurring) {
  const alerts = [];

  if (trends?.savings_rate_declining) {
    const changePts = Math.abs(Math.round((trends.savings_rate_change_total || 0) * 100));
    alerts.push({
      icon: TrendingDown,
      tone: "attention",
      title: "Savings rate declining",
      detail: `Your savings rate has dropped ${changePts} percentage points over the observed period.`,
    });
  }

  if (trends?.debt_to_income_rising) {
    const changePts = Math.abs(Math.round((trends.debt_to_income_change_total || 0) * 100));
    alerts.push({
      icon: TrendingUp,
      tone: "risk",
      title: "Debt-to-income rising",
      detail: `Your debt-to-income ratio has increased ${changePts} percentage points over the observed period.`,
    });
  }

  const biggestDrift = (recurring?.payments || [])
    .filter((p) => p.total_drift_pct > 0)
    .sort((a, b) => b.total_drift_pct - a.total_drift_pct)[0];

  if (biggestDrift) {
    alerts.push({
      icon: AlertTriangle,
      tone: "risk",
      title: `${biggestDrift.merchant} increased ${biggestDrift.total_drift_pct}%`,
      detail: `Now ₹${Number(biggestDrift.last_amount).toLocaleString("en-IN")}/month, up from ₹${Number(
        biggestDrift.first_amount
      ).toLocaleString("en-IN")} since ${biggestDrift.first_seen}.`,
    });
  }

  return alerts;
}

const TONE_STYLES = {
  attention: "bg-attention/10 text-attention border-attention/20",
  risk: "bg-risk/10 text-risk border-risk/20",
};

function AttentionPanel({ trends, recurring }) {
  const alerts = buildAlerts(trends, recurring);

  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-[14px] border border-cardborder shadow-sm p-5">
        <p className="text-sm font-medium text-navy mb-1">What needs attention</p>
        <p className="text-sm text-slate-400">Nothing unusual detected right now.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[14px] border border-cardborder shadow-sm p-5">
      <p className="text-sm font-medium text-navy mb-3">What needs attention</p>
      <div className="space-y-3">
        {alerts.map((alert, i) => {
          const Icon = alert.icon;
          return (
            <div key={i} className={`flex gap-3 p-3 rounded-lg border ${TONE_STYLES[alert.tone]}`}>
              <Icon size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">{alert.title}</p>
                <p className="text-xs mt-0.5 opacity-80">{alert.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AttentionPanel;
