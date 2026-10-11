import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Loader2,
  X,
  Shield,
  Database,
  Sun,
  Moon,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import VaultUpload from "./components/VaultUpload";

export default function Onboarding() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // ---------------------------------------------------------------------------
  // THEME MANAGEMENT (Light / Dark mode toggle)
  // ---------------------------------------------------------------------------
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return true;
  });

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
        try {
          localStorage.setItem("theme", "dark");
        } catch (_) {}
      } else {
        document.documentElement.classList.remove("dark");
        try {
          localStorage.setItem("theme", "light");
        } catch (_) {}
      }
      return next;
    });
  };

  useEffect(() => {
    if (typeof document !== "undefined") {
      if (isDarkMode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [isDarkMode]);

  // ---------------------------------------------------------------------------
  // STATE MANAGEMENT
  // ---------------------------------------------------------------------------
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // ---------------------------------------------------------------------------
  // DRAG & DROP AND FILE SELECTION HANDLERS
  // ---------------------------------------------------------------------------
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
    setUploadError("");

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileChange = (e) => {
    setUploadError("");
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    const ext = selectedFile.name.toLowerCase();
    if (ext.endsWith(".csv") || ext.endsWith(".json")) {
      setFile(selectedFile);
    } else {
      setUploadError("Invalid format. Please upload a .CSV or .JSON statement.");
    }
  };

  // Pre-select a simulated sample file
  const handleSelectSampleFile = () => {
    const sampleBlob = new Blob(["sample data"], { type: "text/csv" });
    const sampleFile = new File([sampleBlob], "hdfc_bank_statement_2026.csv", {
      type: "text/csv",
    });
    setFile(sampleFile);
    setUploadError("");
  };

  // ---------------------------------------------------------------------------
  // DATA PROCESSING HANDLERS
  // ---------------------------------------------------------------------------
  // Left Column: Process uploaded user file (simulates 1.5s then routes to /dashboard)
  const handleUpload = async (e) => {
    e?.preventDefault();
    if (!file) return;

    setIsProcessing(true);
    setUploadError("");

    try {
      localStorage.setItem("spendshield_data_source", "user_uploaded");
      localStorage.setItem("spendshield_uploaded_file", file.name);

      // Simulate parsing, categorisation, and synthetic twin calibration
      setTimeout(() => {
        setIsProcessing(false);
        navigate("/dashboard");
      }, 1500);
    } catch (err) {
      setIsProcessing(false);
      setUploadError("Failed to process statement. Please try again.");
    }
  };

  // Right Column: Load Pre-configured Synthetic Demo Persona A (Instant Route)
  const handleDemoLoad = () => {
    localStorage.setItem("spendshield_data_source", "persona_a");
    localStorage.setItem("spendshield_persona", "Persona A (RBI Calibrated)");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0f0d] text-slate-900 dark:text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden font-sans selection:bg-emerald-500/30 selection:text-emerald-300 transition-colors duration-300">
      {/* =======================================================================
          THEME TOGGLE BUTTON (Absolute Top-Right)
         ======================================================================= */}
      <div className="absolute top-5 right-5 sm:top-7 sm:right-7 z-50">
        <button
          onClick={toggleTheme}
          type="button"
          aria-label="Toggle Theme"
          className="p-2.5 rounded-full border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-[#141816]/80 text-slate-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 backdrop-blur-md shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>
      </div>

      {/* =======================================================================
          1. GLOBAL BACKGROUND & 3D MOTION
         ======================================================================= */}
      {/* Dot Grid Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#059669_1px,transparent_1px)] dark:bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-10 dark:opacity-20 pointer-events-none" />

      {/* Floating 3D Background Decorative Elements (Slow drift and orbit) */}
      <motion.div
        animate={{ x: [-20, 20, -20], y: [-20, 20, -20] }}
        transition={{ repeat: Infinity, duration: 10, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"
      />
      <motion.div
        animate={{ x: [20, -20, 20], y: [15, -25, 15] }}
        transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
        className="absolute bottom-1/4 right-1/4 translate-x-1/3 translate-y-1/4 w-[480px] h-[480px] rounded-full bg-teal-500/10 blur-3xl pointer-events-none"
      />
      <motion.div
        animate={{ x: [-15, 25, -15], y: [20, -15, 20] }}
        transition={{ repeat: Infinity, duration: 15, ease: "easeInOut" }}
        className="absolute top-1/2 right-1/3 w-80 h-80 rounded-full bg-emerald-400/5 dark:bg-emerald-600/10 blur-3xl pointer-events-none"
      />

      {/* =======================================================================
          2. HEADER SECTION
         ======================================================================= */}
      <div className="text-center max-w-xl mx-auto mb-8 sm:mb-10 z-10 space-y-2.5">
        {/* Top Pill with Shield Icon */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30 dark:border dark:border-emerald-500/30 text-xs font-bold mb-1 shadow-xs">
          <Shield className="w-3.5 h-3.5" />
          <span>Step 2: Data Import & Telemetry Setup</span>
        </div>

        {/* Main Title */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white drop-shadow-xs">
          Initialize Your Shield
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
          Connect your financial data to activate the dashboard.
        </p>
      </div>

      {/* =======================================================================
          3. MAIN BENTO BOX UI (The Split Container)
         ======================================================================= */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 p-6 sm:p-10 rounded-3xl bg-white/70 dark:bg-[#111513]/80 backdrop-blur-xl border border-slate-200 dark:border-white/5 shadow-2xl relative z-10"
      >
        {/* =====================================================================
            5. MIDDLE DIVIDER
           ===================================================================== */}
        {/* Desktop Vertical Divider with Dark Circular "OR" Badge */}
        <div className="hidden md:flex absolute inset-y-10 left-1/2 -translate-x-1/2 flex-col items-center justify-center pointer-events-none z-20">
          <div className="w-px flex-1 bg-gradient-to-b from-transparent via-slate-300 dark:via-white/15 to-slate-300 dark:to-white/15" />
          <div className="my-3 px-3 py-1 rounded-full bg-slate-100 dark:bg-[#141414] border border-slate-300 dark:border-white/10 text-[11px] font-black text-slate-600 dark:text-slate-400 tracking-widest uppercase shadow-lg">
            OR
          </div>
          <div className="w-px flex-1 bg-gradient-to-b from-slate-300 dark:from-white/15 via-slate-300 dark:via-white/15 to-transparent" />
        </div>

        {/* =====================================================================
            4. LEFT COLUMN: UPLOAD CUSTOM STATEMENT (VaultUpload Component)
           ===================================================================== */}
        <div className="flex flex-col justify-between">
          <VaultUpload
            onFileSelected={validateAndSetFile}
            onUploadSuccess={handleUpload}
            selectedFile={file}
            onClearFile={() => setFile(null)}
            isProcessing={isProcessing}
            uploadError={uploadError}
            showSyncLimits={false}
            title="Upload Custom Statement"
            subtitle="Import your real bank statement to extract recurring bills and cashflow risks."
          />
        </div>

        {/* Mobile Horizontal Divider */}
        <div className="flex md:hidden items-center my-1 text-slate-400 dark:text-slate-500">
          <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
          <span className="px-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            OR
          </span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
        </div>

        {/* =====================================================================
            6. RIGHT COLUMN: LOAD DEMO PERSONA A
           ===================================================================== */}
        <div className="rounded-2xl p-6 sm:p-7 bg-slate-100/70 dark:bg-gradient-to-b dark:from-emerald-950/30 dark:via-slate-900/40 dark:to-[#0c1a12]/50 border border-slate-200 dark:border-emerald-500/30 hover:border-emerald-400/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-all duration-300 flex flex-col justify-between group">
          <div className="space-y-4">
            {/* Header Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
                  Load Demo Persona A
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                  <Sparkles className="w-3 h-3" />
                  Quick Start
                </span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono hidden sm:inline-block">
                ZERO-SETUP
              </span>
            </div>

            {/* Description */}
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
              Explore SpendShield using synthetic financial data calibrated to RBI statistics. Perfect for a quick tour.
            </p>

            {/* Features List with Green Checkmarks */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-zinc-200">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[3] shrink-0" />
                <span className="font-semibold">12-Month Transaction History</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-zinc-200">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[3] shrink-0" />
                <span className="font-semibold">Pre-configured Action Plan</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-zinc-200">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[3] shrink-0" />
                <span className="font-semibold">Active Lock Path Bills</span>
              </div>
            </div>

            {/* Info Box: Dark Nested Card */}
            <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-200/80 dark:border-emerald-500/20 text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Pre-calibrated Defense Parameters</span>
              </div>
              <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                Calibrated with the ₹12,450 Safe-to-Spend floor and ₹25k reserve target for immediate telemetry preview.
              </p>
            </div>
          </div>

          {/* Launch Demo Button */}
          <div className="pt-6">
            <button
              type="button"
              onClick={handleDemoLoad}
              className="w-full py-3.5 px-5 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-transparent dark:border dark:border-emerald-500 dark:text-emerald-400 hover:dark:bg-emerald-500 hover:dark:text-black font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-md dark:shadow-none active:scale-[0.99] cursor-pointer group/btn"
            >
              <span>Launch Demo</span>
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Footer Navigation Links */}
      <div className="mt-8 text-center text-xs text-slate-500 dark:text-zinc-500 z-10">
        <span>Already have an active session? </span>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-semibold hover:underline transition-colors"
        >
          Skip to Dashboard
        </button>
        <span className="mx-2">•</span>
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 font-medium hover:underline transition-colors"
        >
          Back to Sign In
        </button>
      </div>
    </div>
  );
}
