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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas text-slate-500">
        Loading dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas text-red-600">
        Failed to load data: {error}. Is the API running on port 8000?
      </div>
    );
  }

  const latest = summary[summary.length - 1] || {};
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen bg-canvas flex">
      <Sidebar tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          <header className="mb-6">
            <h1 className="text-3xl font-display font-extrabold text-navy tracking-tight">
              {TABS.find((t) => t.id === activeTab)?.label}
            </h1>
            <p className="text-slate-500 mt-1">
              {greeting} 👋 Here's how Persona A is doing —{" "}
              {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </p>
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
