// src/App.jsx — owned by Member 1.
// Fetches all data on mount and passes it down as plain props. Child
// components (HealthMetrics, RecurringTable, ForecastChart, TransactionsTable)
// do NOT call the API themselves — this keeps their code simple and
// independently buildable by other members without needing to touch
// data-fetching.
//
// Tab/sidebar navigation added: Dashboard is the full 40%-prototype view;
// Transactions is wired to real /api/transactions data (was fetched by
// api.js but unused until now); Insights and Goals are honest placeholders
// for the 24-hour build (conversational Q&A / multi-path simulation /
// goal planning), not faked screens.

import { useEffect, useState } from "react";
import { LayoutDashboard, Receipt, Repeat, LineChart, Target } from "lucide-react";
import { getSummary, getTrends, getRecurring, getForecast, getTransactions } from "./api";
import Sidebar from "./components/Sidebar.jsx";
import HealthMetrics from "./components/HealthMetrics.jsx";
import RecurringTable from "./components/RecurringTable.jsx";
import ForecastChart from "./components/ForecastChart.jsx";
import AttentionPanel from "./components/AttentionPanel.jsx";
import TransactionsTable from "./components/TransactionsTable.jsx";
import PlaceholderTab from "./components/PlaceholderTab.jsx";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "transactions", label: "Transactions", icon: Receipt },
  { id: "recurring", label: "Recurring Payments", icon: Repeat },
  { id: "insights", label: "Insights", icon: LineChart },
  { id: "goals", label: "Goals", icon: Target },
];

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [summary, setSummary] = useState([]);
  const [trends, setTrends] = useState({});
  const [recurring, setRecurring] = useState({ payments: [], total_monthly_burden: 0 });
  const [forecast, setForecast] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    Promise.all([getSummary(), getTrends(), getRecurring(), getForecast(), getTransactions(100)])
      .then(([summaryData, trendsData, recurringData, forecastData, transactionsData]) => {
        setSummary(summaryData);
        setTrends(trendsData);
        setRecurring(recurringData);
        setForecast(forecastData);
        setTransactions(transactionsData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // If the API takes a while (e.g. a cold-started server), say so instead of
  // leaving the user staring at a blank screen.
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center app-bg px-6 text-center">
        <img src="/logo-icon.png" alt="SpendShield" className="w-20 h-20 animate-pulse" />
        <p className="mt-5 text-navy font-semibold">Loading your financial picture…</p>
        {slow && (
          <p className="mt-2 text-sm text-slate-500 max-w-xs">
            The server is waking up — the first load can take a little longer.
          </p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center app-bg px-6 text-center">
        <img src="/logo-icon.png" alt="SpendShield" className="w-16 h-16 opacity-80" />
        <p className="mt-5 text-navy font-semibold">Couldn't reach the SpendShield API.</p>
        <p className="mt-2 text-sm text-slate-500 max-w-md">
          Please refresh in a few seconds. Details: {error}. (Running locally? Check that the API is up on port 8000.)
        </p>
      </div>
    );
  }

  const latest = summary[summary.length - 1] || {};
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen app-bg flex">
      <Sidebar tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          <header className="mb-6 relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0E2E28] via-[#14503F] to-[#1D7A5F] text-white p-7 shadow-xl shadow-emerald-900/20">
            <img
              src="/logo-icon.png"
              alt=""
              aria-hidden="true"
              className="absolute -right-8 -top-8 w-64 h-64 object-contain brightness-0 invert opacity-10 select-none pointer-events-none"
            />
            <div className="absolute -left-12 -bottom-20 w-72 h-72 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none" />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/20 px-3 py-1 text-xs font-medium text-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                Persona A · synthetic data calibrated to RBI statistics
              </span>
              <h1 className="mt-3 text-3xl font-display font-extrabold tracking-tight">
                {TABS.find((t) => t.id === activeTab)?.label}
              </h1>
              <p className="mt-1.5 text-emerald-100/90">
                {greeting} 👋 Here's how Persona A is doing —{" "}
                {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </header>

          {/* key={activeTab} re-triggers the .tab-enter animation on every switch */}
          <div key={activeTab} className="tab-enter">
            {activeTab === "dashboard" && (
              <>
                <div className="mb-6">
                  <AttentionPanel trends={trends} recurring={recurring} />
                </div>

                <HealthMetrics latest={latest} trends={trends} recurringBurden={recurring.total_monthly_burden} />

                <section className="mt-8">
                  <h2 className="text-xl font-semibold text-slate-700 mb-3">
                    Cash Flow — Observed vs. Predicted
                  </h2>
                  <ForecastChart summary={summary} forecast={forecast} />
                </section>

                <section className="mt-8 mb-8">
                  <h2 className="text-xl font-semibold text-slate-700 mb-3">Recurring Payments</h2>
                  <RecurringTable payments={recurring.payments} />
                </section>
              </>
            )}

            {activeTab === "transactions" && (
              <div className="mb-8">
                <TransactionsTable transactions={transactions} />
              </div>
            )}

            {activeTab === "recurring" && (
              <div className="mb-8">
                <RecurringTable payments={recurring.payments} />
              </div>
            )}

            {activeTab === "insights" && (
              <div className="mb-8">
                <PlaceholderTab
                  icon={LineChart}
                  title="Conversational Q&A — coming in the 24-hour build"
                  note="Ask questions about spending, savings, and affordability directly against this data. Scoped for hours 4-9 of the final build."
                />
              </div>
            )}

            {activeTab === "goals" && (
              <div className="mb-8">
                <PlaceholderTab
                  icon={Target}
                  title="Multi-path simulation & goals — coming in the 24-hour build"
                  note="Compare 2-3 realistic decision paths side-by-side (cut spend / refinance / do nothing) and set savings goals. Scoped for hours 9-15 of the final build."
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
