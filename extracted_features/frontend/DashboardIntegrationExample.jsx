// frontend/DashboardIntegrationExample.jsx — Complete example showing how to assemble the 3 features.
import React, { useState, useEffect } from "react";
import CashReserveControl from "./CashReserveControl";
import SequenceComparisonTable from "./SequenceComparisonTable";
import AddTransactionForm from "./AddTransactionForm";
import SilentCreepCard from "./SilentCreepCard";

export default function DashboardIntegrationExample() {
  const [reserve, setReserve] = useState(45000);
  const [alerts, setAlerts] = useState([]);

  // Fetch initial alerts on mount
  useEffect(() => {
    fetch("/api/alerts")
      .then((res) => res.json())
      .then((data) => {
        if (data.alerts) setAlerts(data.alerts);
      })
      .catch((err) => console.error("Could not fetch alerts", err));
  }, []);

  const handleTransactionAdded = (response) => {
    if (response.alerts) {
      setAlerts(response.alerts);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900">Financial Copilot — Phase 1 Evaluation</h1>
        <p className="text-xs text-slate-500 mt-1">
          Minimum Cash Reserve, F5 8-Week Sequence Simulator, and Live Silent Creep Loop.
        </p>
      </div>

      {/* Feature 1: Minimum Cash Reserve */}
      <CashReserveControl initialReserve={reserve} onReserveChange={setReserve} />

      {/* Feature 3 (Part B): Silent Creep Alert Card */}
      <SilentCreepCard alerts={alerts} />

      {/* Feature 2: F5 8-Week Sequence Simulator */}
      <SequenceComparisonTable reserve={reserve} />

      {/* Feature 3 (Part A): Live Add Transaction Form */}
      <AddTransactionForm onTransactionAdded={handleTransactionAdded} />
    </div>
  );
}
