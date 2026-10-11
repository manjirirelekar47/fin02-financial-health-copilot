// src/components/VaultUpload.jsx — Reusable 3D Data Sync Vault Dropzone & File Ingestion
import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Shield,
  Lock,
  Eye,
  ArrowUp,
  Loader2,
  Database,
  Sparkles,
} from "lucide-react";
import { useSettings } from "../context/SettingsContext";

export default function VaultUpload({
  onFileSelected = null,
  onUploadSuccess = null,
  selectedFile = null,
  onClearFile = null,
  isProcessing = false,
  uploadError = "",
  showSyncLimits = true,
  className = "",
  title = "Data Sync Vault",
  subtitle = "Smart liquidity sync with autoshield.",
}) {
  const { t } = useSettings();
  const [internalFile, setInternalFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [internalError, setInternalError] = useState("");
  const fileInputRef = useRef(null);

  const activeFile = selectedFile || internalFile;
  const activeError = uploadError || internalError;

  const executeUpload = async (file) => {
    if (!file) return;
    setIsSyncing(true);
    setInternalError("");
    try {
      const sessionId = typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") || "demo" : "demo";
      const formData = new FormData();
      formData.append("file", file);
      formData.append("session_id", sessionId);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "X-Session-ID": sessionId,
        },
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.detail?.message || errJson?.detail || `Upload failed (${res.status})`);
      }

      const data = await res.json();
      const count = data?.accepted?.length || data?.rowCount || "All";
      setFeedback(`✓ Ingestion verified: ${count} transactions loaded into defensive engine!`);
      if (onUploadSuccess) {
        onUploadSuccess(data);
      }
    } catch (err) {
      setInternalError(err.message || "Failed to process statement.");
    } finally {
      setIsSyncing(false);
    }
  };

  const validateAndProcess = async (file) => {
    if (!file) return;
    setInternalError("");
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".csv") && !ext.endsWith(".json")) {
      setInternalError("Invalid format. Please upload a .CSV or .JSON statement.");
      return;
    }

    setInternalFile(file);
    if (onFileSelected) {
      onFileSelected(file);
    }
    setFeedback(`✓ Ingesting ${file.name}...`);
    await executeUpload(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndProcess(file);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndProcess(file);
    }
  };

  const handleClear = (e) => {
    e?.stopPropagation();
    setInternalFile(null);
    setInternalError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (onClearFile) {
      onClearFile();
    }
  };

  const handleSyncLimits = () => {
    setIsSyncing(true);
    setFeedback("✓ Liquidity limits synced with Autoshield floor");
    setTimeout(() => {
      setIsSyncing(false);
      setTimeout(() => setFeedback(null), 3000);
    }, 1200);
  };

  const handleSelectSample = () => {
    const sampleBlob = new Blob(["date,narration,amount,type\n2026-03-01,HDFC Salary Inflow,85000,credit"], { type: "text/csv" });
    const sampleFile = new File([sampleBlob], "hdfc_bank_statement_2026.csv", { type: "text/csv" });
    validateAndProcess(sampleFile);
  };

  return (
    <div
      className={`bg-white dark:bg-[#061d12] rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100 dark:border-emerald-800/40 flex flex-col justify-between ${className}`}
    >
      {/* 1. Header Section */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            {t(title)}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {t(subtitle)}
          </p>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-emerald-950/60 border border-slate-200/50 dark:border-emerald-800/40 flex items-center justify-center text-slate-600 dark:text-emerald-400 shadow-2xs shrink-0">
          <Eye className="w-4 h-4" />
        </div>
      </div>

      {/* 2. The 3D Card Stack (Dropzone) */}
      <div className="relative pt-3 pb-1 select-none">
        {/* Back Card (Dark slate/gray peeking out at top) */}
        <div className="absolute top-0 left-3 right-3 h-20 rounded-2xl bg-slate-800 dark:bg-slate-900 border border-slate-700/60 shadow-md opacity-85 transform -rotate-1 flex items-start justify-between px-4 pt-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>LOCKED RESERVE VAULT</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-bold">#4921</span>
        </div>

        {/* Front Card (Active Dropzone with Emerald Gradient) */}
        <motion.div
          whileHover={{ y: -2 }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-900 border transition-all duration-200 cursor-pointer shadow-xl ${
            isDragging
              ? "border-emerald-300 ring-4 ring-emerald-400/40 scale-[1.02]"
              : "border-emerald-600/40 hover:border-emerald-400/60"
          }`}
        >
          {/* Subtle radial sheen on card */}
          <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />

          {/* Top row: Gold EMV chip + DATA VAULT shield */}
          <div className="flex items-center justify-between mb-3">
            {/* Gold EMV chip */}
            <div className="w-8 h-6 rounded-md bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-500 border border-amber-200/90 shadow-xs relative overflow-hidden flex items-center justify-center">
              <div className="w-full h-[1px] bg-amber-700/40 absolute top-1.5" />
              <div className="w-full h-[1px] bg-amber-700/40 absolute bottom-1.5" />
              <div className="h-full w-[1px] bg-amber-700/40 absolute left-2.5" />
              <div className="h-full w-[1px] bg-amber-700/40 absolute right-2.5" />
              <div className="w-2 h-1.5 rounded-xs border border-amber-700/50 bg-amber-200/70" />
            </div>

            {/* DATA VAULT */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-400/30 text-[10px] font-bold text-emerald-200 tracking-wider">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>{t("DATA VAULT")}</span>
            </div>
          </div>

          {/* Middle row: Monospace DRAG & DROP FILES HERE */}
          <div className="my-3 sm:my-3.5 text-center py-1">
            <p className="font-mono font-bold text-white text-xs sm:text-sm tracking-widest drop-shadow-sm">
              {t("DRAG & DROP FILES HERE")}
            </p>
          </div>

          {/* Bottom row: SUPPORTED FORMATS & STATUS */}
          <div className="flex items-end justify-between pt-1 border-t border-emerald-600/30">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-emerald-200/70 font-semibold block">
                {t("SUPPORTED FORMATS")}
              </span>
              <span className="text-xs font-bold text-white tracking-wide">
                CSV, JSON
              </span>
            </div>
            <div className="text-right">
              <span className="text-[9px] uppercase tracking-wider text-emerald-200/70 font-semibold block">
                {t("STATUS")}
              </span>
              <span className="text-xs font-bold text-emerald-300 tracking-wide flex items-center justify-end gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {activeFile ? t("Ready") : t("READY")}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Selected File Banner */}
      {activeFile && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {activeFile.name}
              </p>
              <p className="text-[10px] text-zinc-500">
                {(activeFile.size / 1024).toFixed(1)} KB • Ready for telemetry sync
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Error Alert */}
      {activeError && (
        <div className="mt-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{activeError}</span>
        </div>
      )}

      {/* 3. Footer & Action Buttons */}
      <div className="mt-3">
        {/* Light gray pill container */}
        <div className="bg-slate-50 dark:bg-[#072418] border border-slate-100 dark:border-emerald-800/30 rounded-xl px-4 py-2 flex items-center justify-between text-xs mb-3">
          <span className="font-medium text-slate-600 dark:text-zinc-300">
            {t("Target Analysis Engine")}
          </span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
            {t("Ready ••")}
          </span>
        </div>

        {/* Buttons: Side-by-side action buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Primary Button */}
          {activeFile && onUploadSuccess ? (
            <button
              type="button"
              onClick={() => onUploadSuccess(activeFile)}
              disabled={isProcessing}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm py-2.5 px-3 sm:px-4 rounded-full flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t("Processing...") || "Processing..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t("Process Data") || "Process Data"}</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-emerald-950 hover:bg-emerald-900 dark:bg-[#042416] dark:hover:bg-[#05321f] text-white font-bold text-xs sm:text-sm py-2.5 px-3 sm:px-4 rounded-full flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-98"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>{t("Upload Files")}</span>
            </button>
          )}

          {/* Secondary Button */}
          {showSyncLimits ? (
            <button
              type="button"
              onClick={handleSyncLimits}
              disabled={isSyncing}
              className="bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold text-xs sm:text-sm py-2.5 px-3 sm:px-4 rounded-full flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
            >
              <Lock className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{t("Sync Now")}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSelectSample}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold text-xs py-2.5 px-3 rounded-full transition-all text-center"
            >
              Sample Data
            </button>
          )}
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".csv,.json,.xlsx"
          className="hidden"
          onChange={handleFileInput}
        />

        {feedback && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-2 text-center"
          >
            {feedback}
          </motion.p>
        )}
      </div>
    </div>
  );
}
