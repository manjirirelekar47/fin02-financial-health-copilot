import { useEffect, useState } from "react";
import { CalendarDays, ListChecks } from "lucide-react";
import { getCalendar, getPriorityList } from "../api";

export default function PriorityCalendarScreen({ sessionId, mode }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    (mode === "priority" ? getPriorityList(sessionId) : getCalendar(sessionId))
      .then(setData).catch((err) => setError(err.message));
  }, [mode, sessionId]);
  const items = mode === "priority" ? data?.priority_list || [] : data?.recurring || [];
  const Icon = mode === "priority" ? ListChecks : CalendarDays;
  return <section className="rounded-2xl border border-cardborder bg-white p-6 shadow-sm">
    <div className="flex items-center gap-2"><Icon className="text-accent" /><h2 className="text-xl font-semibold text-navy">{mode === "priority" ? "Priority List" : "Bill Calendar"}</h2></div>
    <p className="mt-1 text-sm text-slate-500">{mode === "priority" ? "Payment order and category priority from your financial analysis." : "Recurring payments and upcoming obligations from your financial analysis."}</p>
    {error && <p className="mt-4 text-sm text-risk">{error}</p>}
    <div className="mt-5 divide-y divide-cardborder">{items.map((item, index) => <div key={item.id || item.merchant || index} className="flex items-center justify-between gap-4 py-3"><div><p className="font-medium text-navy">{item.narration || item.merchant || item.id}</p><p className="text-xs text-slate-500">{item.category || item.recurring_type || "Recurring obligation"}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{item.priority || item.amount || "Scheduled"}</span></div>)}</div>
    {!error && items.length === 0 && <p className="mt-5 text-sm text-slate-500">No items available yet. Upload or add transactions to build this view.</p>}
  </section>;
}
