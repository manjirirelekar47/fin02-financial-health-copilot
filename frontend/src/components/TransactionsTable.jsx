// src/components/TransactionsTable.jsx
// Presentational only — same pattern as RecurringTable.jsx: receives already-
// fetched data as props, no API calls, no state. Backs the "Transactions" tab.
//
// Props:
//   transactions - array from /api/transactions, e.g.:
//     { date, merchant, amount, type, account_type, category,
//       category_confidence, needs_review }

const CATEGORY_BADGE_TONES = {
  Income: "bg-healthy/10 text-healthy",
  "Debt Payment": "bg-risk/10 text-risk",
  Housing: "bg-navy/10 text-navy",
  Subscriptions: "bg-accent/10 text-accent",
  Utilities: "bg-attention/10 text-attention",
  Uncategorised: "bg-slate-100 text-slate-500",
};

function formatCurrency(value, type) {
  const sign = type === "credit" ? "+" : "−";
  return `${sign}₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function CategoryBadge({ category, needsReview }) {
  const classes = CATEGORY_BADGE_TONES[category] || "bg-slate-100 text-slate-500";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${classes}`}>{category}</span>
      {needsReview && (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-attention/10 text-attention">
          Needs review
        </span>
      )}
    </span>
  );
}

function TransactionsTable({ transactions }) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="bg-white rounded-[14px] border border-cardborder shadow-sm p-8 text-center text-slate-400">
        No transactions loaded yet.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[14px] border border-cardborder shadow-sm overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-canvas text-slate-500 uppercase text-xs">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Merchant</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Account</th>
            <th className="px-4 py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t, i) => (
            <tr
              key={`${t.date}-${t.merchant}-${i}`}
              className="border-t border-cardborder hover:bg-canvas/60 transition-colors"
            >
              <td className="px-4 py-3 text-slate-400">{t.date}</td>
              <td className="px-4 py-3 font-medium text-navy">{t.merchant}</td>
              <td className="px-4 py-3">
                <CategoryBadge category={t.category} needsReview={t.needs_review} />
              </td>
              <td className="px-4 py-3 text-slate-500 capitalize">
                {(t.account_type || "").replace("_", " ")}
              </td>
              <td
                className={`px-4 py-3 text-right font-medium ${
                  t.type === "credit" ? "text-healthy" : "text-slate-700"
                }`}
              >
                {formatCurrency(t.amount, t.type)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TransactionsTable;
