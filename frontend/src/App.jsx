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
import { LayoutDashboard, Receipt, Repeat, Upload, Shuffle, FlaskConical, Sliders, MessageSquareText, Activity, CalendarDays, ListChecks, LockKeyhole, Sparkles, TrendingUp } from "lucide-react";
import { getSummary, getRecurring, getTransactions, getForecast } from "./api";
import Sidebar from "./components/Sidebar.jsx";
import HealthMetrics from "./components/HealthMetrics.jsx";
import RecurringTable from "./components/RecurringTable.jsx";
import ForecastChart from "./components/ForecastChart.jsx";
import AttentionPanel from "./components/AttentionPanel.jsx";
import TransactionsTable from "./components/TransactionsTable.jsx";
import PlaceholderTab from "./components/PlaceholderTab.jsx";
import SimulateScreen from "./components/SimulateScreen.jsx";
import BenchmarkScreen from "./components/BenchmarkScreen.jsx";
import OptimizerScreen from "./components/OptimizerScreen.jsx";
import ReviewQueueScreen from "./components/ReviewQueueScreen.jsx";
import VerifiedAgentChat from "./components/VerifiedAgentChat.jsx";
import UploadScreen from "./components/UploadScreen.jsx";
import PriorityCalendarScreen from "./components/PriorityCalendarScreen.jsx";
import LockPathScreen from "./components/LockPathScreen.jsx";
import StartScreen from "./components/StartScreen.jsx";
import PlanScreen from "./components/PlanScreen.jsx";
import ForecastScreen from "./components/ForecastScreen.jsx";

const TABS = [
  { id: "dashboard",   label: "Dashboard",            icon: LayoutDashboard },
  { id: "transactions",label: "Transactions",         icon: Receipt },
  { id: "recurring",   label: "Recurring Payments",   icon: Repeat },
  { id: "priority",    label: "Priority List",        icon: ListChecks },
  { id: "calendar",    label: "Bill Calendar",         icon: CalendarDays },
  { id: "plan",        label: "Priority LP Plan",     icon: Sparkles },
  { id: "forecast",    label: "Forecast Evidence",    icon: TrendingUp },
  { id: "upload",      label: "Upload Data",          icon: Upload },
  { id: "simulate",    label: "Simulate a Decision",  icon: Shuffle },
  { id: "lock",        label: "Lock a Path",           icon: LockKeyhole },
  { id: "benchmark",   label: "Model Benchmark",      icon: FlaskConical },
  { id: "optimizer",   label: "Minimum-Change Plan",  icon: Sliders },
  { id: "agent",       label: "AI Copilot",           icon: MessageSquareText },
  { id: "review",      label: "Categoriser Review",   icon: Activity },
];

function App() {
  const [hasStarted, setHasStarted] = useState(() => {
    return window.localStorage.getItem("spendshield-started") === "true";
  });
  const [dataSourceMode, setDataSourceMode] = useState(() => {
    return window.localStorage.getItem("spendshield-mode") || "demo";
  });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [summary, setSummary] = useState([]);
  const [trends, setTrends] = useState({});
  const [recurring, setRecurring] = useState({ payments: [], total_monthly_burden: 0 });
  const [forecast, setForecast] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    const existing = window.localStorage.getItem("spendshield-session-id");
    if (existing) return existing;
    const created = "demo";
    window.localStorage.setItem("spendshield-session-id", created);
    return created;
  });

  const handleSelectDemo = () => {
    window.localStorage.setItem("spendshield-started", "true");
    window.localStorage.setItem("spendshield-mode", "demo");
    window.localStorage.setItem("spendshield-session-id", "demo");
    setDataSourceMode("demo");
    setSessionId("demo");
    setHasStarted(true);
    setActiveTab("dashboard");
  };

  const handleUploadComplete = (newSessionId) => {
    window.localStorage.setItem("spendshield-started", "true");
    window.localStorage.setItem("spendshield-mode", "custom");
    setDataSourceMode("custom");
    setSessionId(newSessionId);
    setHasStarted(true);
    setActiveTab("dashboard");
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getSummary(sessionId),
      getRecurring(sessionId),
      getTransactions(50, sessionId).catch(() => []),
      getForecast(30, sessionId).catch(() => null),
    ])
      .then(([summaryData, recurringData, txData, forecastData]) => {
        const analysis = recurringData?.alerts ? recurringData : summaryData;
        const ratios = analysis?.ratios || {};
        setSummary(Array.isArray(summaryData) ? summaryData : [{
          savings_rate: ratios.savings_rate,
          debt_to_income_ratio: ratios.dti,
          savings: 0,
        }]);
        setTrends({});
        const rawPayments = analysis?.recurring || analysis?.payments || [];
        const normalizedPayments = rawPayments.map((p) => ({
          merchant: p.merchant || p.narration || p.id || "Subscription",
          recurring_type: p.recurring_type || p.category || "Subscription",
          occurrences: p.occurrences ?? 6,
          first_amount: p.first_amount ?? p.amount ?? 0,
          last_amount: p.last_amount ?? p.amount ?? p.avg_amount ?? 0,
          total_drift_pct: p.total_drift_pct ?? 0,
          last_seen: p.last_seen || "Recent",
        }));
        const totalBurden = recurringData?.total_monthly_burden || normalizedPayments.reduce((sum, p) => sum + (Number(p.last_amount) || 0), 0);
        setRecurring({
          payments: normalizedPayments,
          total_monthly_burden: totalBurden,
          alerts: analysis?.alerts || [],
        });
        setForecast(forecastData?.forecast ? forecastData : null);
        setTransactions(Array.isArray(txData) ? txData : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [sessionId, dataSourceMode]);

  // If the API takes a while (e.g. a cold-started server), say so instead of
  // leaving the user staring at a blank screen.
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, []);

  if (!hasStarted) {
    return (
      <StartScreen
        onSelectDemo={handleSelectDemo}
        onUploadComplete={handleUploadComplete}
      />
    );
  }

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
        <button
          type="button"
          onClick={() => setHasStarted(false)}
          className="mt-4 px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold shadow-sm"
        >
          Return to Start Page
        </button>
      </div>
    );
  }

  const latest = summary[summary.length - 1] || {};
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen app-bg flex">
      <Sidebar tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} onSwitchMode={() => setHasStarted(false)} />

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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/20 px-3 py-1 text-xs font-medium text-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  {dataSourceMode === "demo"
                    ? "Persona A · synthetic data calibrated to RBI statistics"
                    : "Custom Statement · Active Session"}
                </span>
                <button
                  type="button"
                  onClick={() => setHasStarted(false)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white px-3 py-1 text-xs font-semibold backdrop-blur-sm transition-all shadow-sm"
                >
                  ⚡ Switch Data / Demo
                </button>
              </div>
              <h1 className="mt-3 text-3xl font-display font-extrabold tracking-tight">
                {TABS.find((t) => t.id === activeTab)?.label}
              </h1>
              <p className="mt-1.5 text-emerald-100/90">
                {greeting} 👋 {dataSourceMode === "demo" ? "Here's how Persona A is doing" : "Here is your active financial analysis"} —{" "}
                {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <p className="mt-2 text-xs text-emerald-100/80">Decision support only. Not financial advice.</p>
            </div>
          </header>

          {/* key={activeTab} re-triggers the .tab-enter animation on every switch */}
          <div key={activeTab} className="tab-enter">
            {activeTab === "dashboard" && (
              <>
                <div className="mb-6">
                  <AttentionPanel alerts={recurring.alerts} />
                </div>

                <HealthMetrics latest={latest} trends={trends} recurringBurden={recurring.total_monthly_burden} />

                <section className="mt-8">
                  <h2 className="text-xl font-semibold text-slate-700 mb-3">
                    Cash Flow — Observed vs. Predicted
                  </h2>
                  <ForecastChart summary={summary} forecast={forecast} sessionId={sessionId} />
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

            {activeTab === "upload" && (
              <div className="mb-8">
                <UploadScreen sessionId={sessionId} />
              </div>
            )}

            {activeTab === "priority" && <PriorityCalendarScreen sessionId={sessionId} mode="priority" />}
            {activeTab === "calendar" && <PriorityCalendarScreen sessionId={sessionId} mode="calendar" />}

            {activeTab === "simulate" && (
              <div className="mb-8">
                <SimulateScreen sessionId={sessionId} />
              </div>
            )}

            {activeTab === "lock" && <LockPathScreen sessionId={sessionId} />}

            {activeTab === "benchmark" && (
              <div className="mb-8">
                <BenchmarkScreen sessionId={sessionId} />
              </div>
            )}

            {activeTab === "optimizer" && (
              <div className="mb-8">
                <OptimizerScreen sessionId={sessionId} />
              </div>
            )}

            {activeTab === "agent" && (
              <div className="mb-8">
                <VerifiedAgentChat sessionId={sessionId} />
              </div>
            )}

            {activeTab === "review" && (
              <div className="mb-8">
                <ReviewQueueScreen sessionId={sessionId} />
              </div>
            )}

            {activeTab === "plan" && (
              <div className="mb-8">
                <PlanScreen sessionId={sessionId} />
              </div>
            )}

            {activeTab === "forecast" && (
              <div className="mb-8">
                <ForecastScreen sessionId={sessionId} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
