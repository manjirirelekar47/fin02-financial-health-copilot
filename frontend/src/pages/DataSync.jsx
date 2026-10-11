// src/pages/DataSync.jsx — Top-level Data Synchronization and Ingestion Hub
import React, { useState } from "react";
import { Database, Shield, RefreshCw, CheckCircle2, FileText, ArrowRight, Download, Server, Key, AlertCircle } from "lucide-react";
import VaultUpload from "../components/VaultUpload";
import { downloadStatementTemplate } from "../api";

export default function DataSync() {
  const [syncStatus, setSyncStatus] = useState("Connected");
  const [lastSyncTime, setLastSyncTime] = useState("Just now");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleForceRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastSyncTime("Just now");
    }, 1500);
  };

  const handleFileUploaded = (file) => {
    setSelectedFile(file);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-emerald-900/40 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Deterministic Ingestion Layer
            </span>
            <span className="text-xs text-zinc-400">• Sahamati AA & Statement Parser</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
            Data Sync Vault
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
            Synchronize external bank statements, Account Aggregator consent streams, and synthetic twin datasets into the SpendShield defensive engine.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={downloadStatementTemplate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-800 hover:bg-gray-50 border border-gray-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            CSV Template
          </button>
          <button
            type="button"
            onClick={handleForceRefresh}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Sync Now
          </button>
        </div>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Reusable 3D Vault Upload Component (5 cols) */}
        <div className="lg:col-span-5">
          <VaultUpload
            onFileSelected={handleFileUploaded}
            onUploadSuccess={(data) => {
              setSyncStatus("Synchronized");
              setLastSyncTime("Just now");
            }}
            title="3D Vault Dropzone"
            subtitle="Drag statements here to parse and update cashflow model."
            showSyncLimits={true}
          />
        </div>

        {/* Right Column: Account Aggregator & Telemetry Status (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Consent & Feed Health Card */}
          <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Live Account Telemetry
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Encrypted financial information provider (FIP) pipelines
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {syncStatus}
              </span>
            </div>

            {/* FIP Connection Items */}
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-900/60 border border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                    HDFC
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                      HDFC Bank (Salary Account ••9012)
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Primary Inflow • Updated {lastSyncTime}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Synchronized
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-900/60 border border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                    ICICI
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                      ICICI Credit Card (Coral ••3419)
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Discretionary & EMI Tracker • Real-time API
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Synchronized
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-900/60 border border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                    SETU
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                      Setu Account Aggregator Gateway
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Consent Artifact #AA-9982-IN • Valid until Dec 2026
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active Consent
                </span>
              </div>
            </div>
          </div>

          {/* Audit & Ingestion Telemetry Logs */}
          <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                Ingestion & Categorization Audit
              </h3>
              <span className="text-[11px] font-mono text-zinc-400">
                SHA-256 Verified
              </span>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-zinc-800/60 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Parsed 12-Month Banking Statement
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    238 debits, 12 credits categorized with 94.2% confidence
                  </p>
                </div>
                <span className="text-emerald-600 font-medium">Completed</span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Silent Creep Detector Executed
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    3 price adjustments identified (+₹3,200/mo)
                  </p>
                </div>
                <span className="text-emerald-600 font-medium">Completed</span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Monte Carlo Synthetic Twin Resampling
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    P10/P50/P90 cashflow quantiles updated on 8-week horizon
                  </p>
                </div>
                <span className="text-emerald-600 font-medium">Completed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
