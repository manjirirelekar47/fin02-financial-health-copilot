// src/components/RecurringTable.jsx — owned by Member 4.
//
// Presentational only — maps over the payments array it's handed and
// renders a table. Restyled to the SpendShield design spec: navy/accent
// palette, soft-shadow card, colored type badges, status-colored drift.
//
// Props:
//   payments - array of objects from /api/recurring, e.g.:
//     { merchant, recurring_type, occurrences, first_amount, last_amount,
//       total_drift_pct, avg_interval_days, last_seen, ... }

function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const TYPE_BADGE_STYLES = {
  EMI: "bg-risk/10 text-risk",
  Rent: "bg-navy/10 text-navy",
  Subscription: "bg-accent/10 text-accent",
  Utility: "bg-attention/10 text-attention",
  "Other recurring": "bg-slate-100 text-slate-500",
};

function TypeBadge({ type }) {
  const classes = TYPE_BADGE_STYLES[type] || TYPE_BADGE_STYLES["Other recurring"];
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${classes}`}>{type || "Recurring"}</span>
  );
}

function DriftBadge({ pct }) {
  if (pct === null || pct === undefined || isNaN(pct) || pct === 0) {
    return <span className="text-slate-400 text-sm">No change</span>;
  }
  const isIncrease = Number(pct) > 0;
  const tone = isIncrease ? "text-risk" : "text-healthy";
  return (
    <span className={`text-sm font-medium ${tone}`}>
      {isIncrease ? "▲" : "▼"} {isIncrease ? "+" : ""}
      {typeof pct === "number" ? pct.toFixed(1) : pct}%
    </span>
  );
}

function RecurringTable({ payments }) {
  if (!payments || payments.length === 0) {
    return (
      <div className="bg-white rounded-[14px] border border-cardborder shadow-sm p-8 text-center text-slate-400">
        No recurring payments detected yet.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[14px] border border-cardborder shadow-sm overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-canvas text-slate-500 uppercase text-xs">
          <tr>
            <th className="px-4 py-3">Merchant</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Occurrences</th>
            <th className="px-4 py-3">Latest Amount</th>
            <th className="px-4 py-3">Drift</th>
            <th className="px-4 py-3">Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p, idx) => {
            const merchant = p.merchant || p.narration || p.id || "Recurring Item";
            const type = p.recurring_type || p.category || "Subscription";
            const occurrences = p.occurrences ?? "—";
            const lastAmount = p.last_amount ?? p.amount ?? p.avg_amount ?? 0;
            const drift = p.total_drift_pct ?? 0;
            const lastSeen = p.last_seen || "Recent";

            return (
              <tr key={`${merchant}-${idx}`} className="border-t border-cardborder hover:bg-canvas/60 transition-colors">
                <td className="px-4 py-3 font-medium text-navy">{merchant}</td>
                <td className="px-4 py-3">
                  <TypeBadge type={type} />
                </td>
                <td className="px-4 py-3 text-slate-500">{occurrences}</td>
                <td className="px-4 py-3 text-slate-700 font-medium">{formatCurrency(lastAmount)}</td>
                <td className="px-4 py-3">
                  <DriftBadge pct={drift} />
                </td>
                <td className="px-4 py-3 text-slate-400">{lastSeen}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default RecurringTable;
