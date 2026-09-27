// src/components/HealthMetrics.jsx — owned by Member 4.
//
// Presentational only — receives already-fetched data as props, no API
// calls, no state. Restyled to the SpendShield design spec (navy/accent
// palette, soft-shadow cards).
//
// The circular "Financial Health Score" is deliberately built from only the
// two factors we actually compute (savings rate + debt-to-income) rather
// than the full 5-factor version in the design spec (Cash Flow, Recurring
// Expenses, Emergency Buffer aren't in our data model yet) — the formula is
// shown directly on the card so it's honest about what it does and doesn't
// account for, not a black-box number.
//
// Props:
//   latest          - most recent row from /api/summary
//   trends          - object of trend flags from /api/trends
//   recurringBurden - number, total monthly recurring payment amount

import { PiggyBank, CreditCard, Repeat, Wallet } from "lucide-react";

function formatPercent(value) {
  if (value === undefined || value === null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatCurrency(value) {
  if (value === undefined || value === null) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function MetricCard({ label, value, sublabel, tone = "neutral", icon: Icon }) {
  const toneClasses = {
    neutral: "text-slate-400",
    healthy: "text-healthy",
    attention: "text-attention",
    risk: "text-risk",
  };
  const iconBg = {
    neutral: "bg-slate-100 text-slate-500",
    healthy: "bg-healthy/10 text-healthy",
    attention: "bg-attention/10 text-attention",
    risk: "bg-risk/10 text-risk",
  };
  return (
    <div className="bg-white rounded-[14px] border border-cardborder shadow-sm p-5 transition-all duration-150 hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-slate-500">{label}</p>
        {Icon && (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconBg[tone]}`}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <p className="text-2xl font-display font-bold text-navy">{value}</p>
      {sublabel && <p className={`text-xs mt-1 ${toneClasses[tone]}`}>{sublabel}</p>}
    </div>
  );
}

/**
 * Transparent 2-factor score, 0-100:
 *   50% weight — savings rate (higher is better, capped at 30% = full marks)
 *   50% weight — debt-to-income (lower is better, 0% = full marks, 40%+ = zero)
 * This is an illustrative composite, not a financial industry standard —
 * the point is that it's fully explainable from data we actually have.
 */
function computeHealthScore(savingsRate, debtToIncome) {
  if (savingsRate === undefined || debtToIncome === undefined) return null;
  const savingsComponent = Math.max(0, Math.min(1, savingsRate / 0.3)) * 50;
  const debtComponent = Math.max(0, Math.min(1, 1 - debtToIncome / 0.4)) * 50;
  return Math.round(savingsComponent + debtComponent);
}

function HealthScoreDonut({ score }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const pct = score === null ? 0 : score / 100;
  const offset = circumference * (1 - pct);
  const color = score === null ? "#94A3B8" : score >= 65 ? "#16A34A" : score >= 40 ? "#D97706" : "#DC2626";

  return (
    <div className="bg-white rounded-[14px] border border-cardborder shadow-sm p-5 flex items-center gap-5">
      <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#E7EDF4" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
        <text x="50" y="55" textAnchor="middle" fontSize="22" fontWeight="700" fill="#132B4A">
          {score === null ? "—" : score}
        </text>
      </svg>
      <div>
        <p className="text-sm text-slate-500">Financial Health Score</p>
        <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
          Based on savings rate (50%) and debt-to-income ratio (50%). A simple, explainable score —
          not a full 5-factor model yet.
        </p>
      </div>
    </div>
  );
}

function HealthMetrics({ latest, trends, recurringBurden }) {
  const score = computeHealthScore(latest.savings_rate, latest.debt_to_income_ratio);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Savings Rate"
          value={formatPercent(latest.savings_rate)}
          sublabel={trends.savings_rate_declining ? "Declining" : "Stable or improving"}
          tone={trends.savings_rate_declining ? "attention" : "healthy"}
          icon={PiggyBank}
        />
        <MetricCard
          label="Debt-to-Income"
          value={formatPercent(latest.debt_to_income_ratio)}
          sublabel={trends.debt_to_income_rising ? "Rising" : "Stable or improving"}
          tone={trends.debt_to_income_rising ? "attention" : "healthy"}
          icon={CreditCard}
        />
        <MetricCard
          label="Monthly Recurring Burden"
          value={formatCurrency(recurringBurden)}
          sublabel="EMI, rent, subscriptions"
          icon={Repeat}
        />
        <MetricCard
          label="Net Cash Flow (latest month)"
          value={formatCurrency(latest.savings)}
          sublabel="Observed"
          icon={Wallet}
        />
      </div>

      <HealthScoreDonut score={score} />
    </div>
  );
}

export default HealthMetrics;
