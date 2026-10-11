import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { getCalendar, getPriorityList } from "../api";

const PRIORITY_STYLES = {
  Critical: "bg-red-50 text-red-700 ring-red-200",
  High: "bg-amber-50 text-amber-800 ring-amber-200",
  Medium: "bg-blue-50 text-blue-700 ring-blue-200",
  Low: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export default function PriorityCalendarScreen({ sessionId, mode }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  useEffect(() => {
    setLoading(true);
    setError("");
    (mode === "priority" ? getPriorityList(sessionId) : getCalendar(sessionId))
      .then(setData).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [mode, sessionId]);
  const items = data?.priority_list || [];
  const bills = data?.calendar || [];
  const calendarCells = useMemo(() => {
    const firstWeekday = month.getDay();
    const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: Math.ceil((firstWeekday + dayCount) / 7) * 7 }, (_, index) => {
      const day = index - firstWeekday + 1;
      if (day < 1 || day > dayCount) return null;
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      return { date, bills: bills.filter((bill) => bill.next_due === dateKey(date)) };
    });
  }, [bills, month]);
  const Icon = mode === "priority" ? ListChecks : CalendarDays;
  return (
    <section className="rounded-2xl border border-cardborder bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2"><Icon className="text-accent" /><h2 className="text-xl font-semibold text-navy">{mode === "priority" ? "Priority List" : "Bill Calendar"}</h2></div>
      <p className="mt-1 text-sm text-slate-500">{mode === "priority" ? "Monthly spending grouped by payment urgency. Critical and essential costs appear first." : "Upcoming recurring payments estimated from your transaction history."}</p>
      {error && <p role="alert" className="mt-4 text-sm text-risk">Could not load this view: {error}</p>}
      {loading && <p className="mt-6 text-sm text-slate-500">Loading your {mode === "priority" ? "priority list" : "bill calendar"}…</p>}

      {!loading && !error && mode === "priority" && (
        <div className="mt-6 space-y-3">
          {items.map((item) => (
            <article key={`${item.priority}-${item.category}`} className="flex flex-col gap-3 rounded-xl border border-cardborder p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.Medium}`}>{item.priority}</span>
                <div><h3 className="font-semibold text-navy">{item.category}</h3><p className="text-xs text-slate-500">{item.transaction_count} transactions in the period</p></div>
              </div>
              <div className="sm:text-right"><p className="text-sm font-bold text-navy">{money(item.monthly_amount)}<span className="ml-1 font-normal text-slate-400">/ month</span></p><p className="text-xs text-slate-500">{money(item.amount)} observed total</p></div>
            </article>
          ))}
          {items.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No spending categories are available yet. Upload a statement to build your priority list.</p>}
        </div>
      )}

      {!loading && !error && mode === "calendar" && (
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-lg border border-cardborder p-2 text-slate-600 hover:bg-slate-50"><ChevronLeft size={18} /></button>
            <h3 className="font-semibold text-navy">{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h3>
            <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-lg border border-cardborder p-2 text-slate-600 hover:bg-slate-50"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="py-2">{day}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, index) => cell ? (
              <div key={dateKey(cell.date)} className={`min-h-20 rounded-lg border p-1.5 sm:min-h-24 sm:p-2 ${cell.bills.length ? "border-emerald-200 bg-emerald-50/60" : "border-slate-100 bg-white"}`}>
                <span className="text-xs font-medium text-slate-600">{cell.date.getDate()}</span>
                <div className="mt-1 space-y-1">{cell.bills.slice(0, 2).map((bill) => <div key={bill.id} title={`${bill.merchant}: ${money(bill.amount)}`} className="truncate rounded bg-white px-1 py-0.5 text-[10px] font-medium text-emerald-800">{bill.merchant}</div>)}</div>
                {cell.bills.length > 2 && <p className="text-[9px] text-slate-500">+{cell.bills.length - 2} more</p>}
              </div>
            ) : <div key={`blank-${index}`} className="min-h-20 sm:min-h-24" />)}
          </div>
          <p className="mt-3 text-xs text-slate-400">Due dates are estimates based on each payment’s recent interval.</p>
          <div className="mt-5 divide-y divide-cardborder">{bills.filter((bill) => bill.next_due.startsWith(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`)).map((bill) => <div key={bill.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-medium text-navy">{bill.merchant}</p><p className="text-xs text-slate-500">{bill.category} · {new Date(`${bill.next_due}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p></div><div className="text-right"><p className="text-sm font-semibold text-navy">{money(bill.amount)}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLES[bill.priority] || PRIORITY_STYLES.Medium}`}>{bill.priority}</span></div></div>)}</div>
          {bills.length === 0 && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No recurring bills detected yet. More transaction history helps identify monthly payments.</p>}
        </div>
      )}
    </section>
  );
}
