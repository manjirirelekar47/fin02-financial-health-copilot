import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Sun,
  Moon,
  Shield,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import LanguageSelector from "./components/LanguageSelector";
import VoiceCommand from "./components/VoiceCommand";
import { useSettings } from "./context/SettingsContext";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

export default function Login() {
  const navigate = useNavigate();
  const { currentLanguage, t } = useSettings();

  // ---------------------------------------------------------------------------
  // THEME MANAGEMENT (Light / Dark mode toggle)
  // ---------------------------------------------------------------------------
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
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

  // Sync theme with document class on mount
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [authMode, setAuthMode] = useState("sign_in");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const restoreSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        persistSession(session, session.user);
        navigate("/onboarding", { replace: true });
      }
    };

    restoreSession();
  }, [navigate]);

  // ---------------------------------------------------------------------------
  // API INTEGRATION & AUTHENTICATION HANDLING
  // ---------------------------------------------------------------------------
  const persistSession = (session, user) => {
    localStorage.setItem("token", session.access_token);
    localStorage.setItem("user_email", user.email || "");
    // The existing API uses this value to scope persisted user data. Supabase
    // user IDs are stable, unlike the previous generated demo session IDs.
    localStorage.setItem("spendshield-session-id", user.id);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setIsLoading(true);

    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error(
          "Authentication is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the frontend environment.",
        );
      }

      const trimmedEmail = email.trim();
      if (authMode === "sign_up") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });

        if (signUpError) throw signUpError;

        if (!data.session || !data.user) {
          setNotice("Account created. Check your email to confirm your address, then sign in.");
          return;
        }

        persistSession(data.session, data.user);
        navigate("/onboarding");
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) throw signInError;
      if (!data.session || !data.user) {
        throw new Error("Supabase did not return a user session.");
      }

      persistSession(data.session, data.user);
      navigate("/onboarding");
    } catch (err) {
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setError("");
    setNotice("");

    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error("Authentication is not configured yet.");
      }
      if (!email.trim()) {
        throw new Error("Enter your email address first.");
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/login` },
      );
      if (resetError) throw resetError;
      setNotice("If an account exists for this email, a password-reset link has been sent.");
    } catch (err) {
      setError(err.message || "Unable to send the password-reset email.");
    }
  };

  const handleOAuth = async (provider) => {
    setError("");
    setNotice("");
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error("Authentication is not configured yet.");
      }
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/login` },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err.message || "Unable to start social sign-in.");
    }
  };

  // Demo account autofill helper. It only fills the fields; authentication
  // is always performed by Supabase.
  const handleDemoFill = () => {
    setEmail("manjiri@spendshield.ai");
    setPassword("Autoshield@2026");
    setError("");
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-slate-50 dark:bg-[#0a0a0a] text-slate-900 dark:text-zinc-100 selection:bg-emerald-500/30 selection:text-emerald-600 dark:selection:text-emerald-300 font-sans transition-colors duration-300 relative">
      {/* =======================================================================
          TOP-RIGHT CONTROLS: Language Selector, Voice Command & Theme Toggle
         ======================================================================= */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-2">
        <LanguageSelector />
        <VoiceCommand />
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="p-2 rounded-full bg-white/15 dark:bg-black/20 border border-white/25 dark:border-white/10 text-slate-700 dark:text-zinc-200 hover:scale-105 active:scale-95 transition-all shadow-sm backdrop-blur-md cursor-pointer flex items-center justify-center select-none"
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>
      </div>

      {/* =======================================================================
          LEFT COLUMN: THE 3D ANIMATED HERO (Wallet Stack & Orbiting Data Cards)
         ======================================================================= */}
      <div className="relative hidden md:flex flex-col items-center justify-between overflow-hidden bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-[#061d12] dark:to-[#0a0a0a] border-r border-emerald-100 dark:border-emerald-950/60 select-none transition-colors duration-300 min-h-screen">
        {/* Ambient Glow Orbs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 -right-24 w-80 h-80 rounded-full bg-teal-400/10 blur-[120px] pointer-events-none" />

        {/* Subtle Geometric Grid Mesh */}
        <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-15 dark:opacity-20 pointer-events-none" />

        {/* =====================================================================
            1. TOP BADGES: ABSOLUTE POSITIONING
           ===================================================================== */}
        {/* Top-Left: Deterministic Cashflow Telemetry */}
        <div className="absolute top-8 left-8 sm:left-10 z-20 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/40 shadow-xs backdrop-blur-md">
          <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
          <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
            Deterministic Cashflow Telemetry
          </span>
        </div>

        {/* Top-Right: Pulsing Green Dot with v2.4 Active */}
        <div className="absolute top-8 right-8 sm:right-10 z-20 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-white/80 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/40 px-3.5 py-1.5 rounded-full backdrop-blur-md shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>v2.4 Active</span>
        </div>

        {/* =====================================================================
            3. THE 4 ORBITING DATA CARDS (ABSOLUTE POSITIONING & WHITE STYLING)
           ===================================================================== */}
        {/* Card 1 (Top-Left): "SAFE-TO-SPEND" - top-1/4 left-10 */}
        <motion.div
          animate={{ y: [-6, 6, -6] }}
          transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }}
          className="absolute top-[22%] left-6 lg:left-10 z-30 bg-white dark:bg-[#121915] shadow-xl rounded-xl p-4 border border-slate-100 dark:border-white/10 w-60 sm:w-64 select-none hover:scale-105 transition-transform"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              SAFE-TO-SPEND
            </span>
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              Live Floor
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            ₹12,450
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+14.2% buffer ring-fenced</span>
          </div>
        </motion.div>

        {/* Card 2 (Middle-Right): "BALANCE RADAR" - top-1/3 right-10 */}
        <motion.div
          animate={{ y: [7, -7, 7] }}
          transition={{ repeat: Infinity, duration: 6, ease: "easeInOut", delay: 0.3 }}
          className="absolute top-[30%] right-6 lg:right-10 z-30 bg-white dark:bg-[#121915] shadow-xl rounded-xl p-4 border border-slate-100 dark:border-white/10 w-60 sm:w-64 select-none hover:scale-105 transition-transform"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              BALANCE RADAR
            </span>
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-400">
              P50 Expected
            </span>
          </div>
          {/* Mini SVG Sparkline Chart */}
          <div className="my-1.5 h-7 w-full flex items-center">
            <svg className="w-full h-7 overflow-visible" viewBox="0 0 120 28">
              <path
                d="M0,22 Q20,24 40,15 T80,10 T120,4"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="120" cy="4" r="3" fill="#34d399" />
            </svg>
          </div>
          <div className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 flex items-center justify-between">
            <span>Terminal Cushion</span>
            <span className="font-black text-slate-900 dark:text-white">₹57,400</span>
          </div>
        </motion.div>

        {/* Card 3 (Bottom-Left): "Monthly Spend Ring" - bottom-1/4 left-16 */}
        <motion.div
          animate={{ y: [-5, 5, -5] }}
          transition={{ repeat: Infinity, duration: 7, ease: "easeInOut", delay: 0.6 }}
          className="absolute bottom-[22%] left-8 lg:left-16 z-30 bg-white dark:bg-[#121915] shadow-xl rounded-xl p-4 border border-slate-100 dark:border-white/10 w-60 sm:w-64 select-none hover:scale-105 transition-transform"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Monthly Spend Ring
            </span>
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              88% Adherence
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Mini Donut Chart with "₹12K" in center */}
            <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100 dark:text-zinc-800"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500"
                  strokeDasharray="88, 100"
                  strokeWidth="4"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-[10px] font-black text-slate-800 dark:text-emerald-300">
                ₹12K
              </span>
            </div>
            <div>
              <p className="text-xs font-black text-slate-900 dark:text-white">
                ₹12,850 Spent
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                88% Adherence pacing
              </p>
            </div>
          </div>
        </motion.div>

        {/* Card 4 (Bottom-Right): "HDFC EMI Locked" - bottom-1/4 right-20 */}
        <motion.div
          animate={{ y: [6, -6, 6] }}
          transition={{ repeat: Infinity, duration: 5.5, ease: "easeInOut", delay: 0.9 }}
          className="absolute bottom-[22%] right-10 lg:right-20 z-30 bg-white dark:bg-[#121915] shadow-xl rounded-xl p-4 border border-slate-100 dark:border-white/10 w-60 sm:w-64 select-none hover:scale-105 transition-transform"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-amber-500">
              <Lock className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                LOCKED BILL
              </span>
            </div>
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
              Ring-fenced
            </span>
          </div>
          <div className="text-base font-black text-slate-900 dark:text-white">
            HDFC EMI Locked
          </div>
          <p className="text-xs font-bold text-slate-600 dark:text-zinc-400 mt-0.5">
            Oct 12 • ₹12,000
          </p>
        </motion.div>

        {/* =====================================================================
            2. THE CENTERPIECE: 3D WALLET STACK IN ABSOLUTE CENTER ABOVE PEDESTAL
           ===================================================================== */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <motion.div
            animate={{ y: [-8, 8, -8] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
            className="relative w-80 sm:w-96 h-60 flex items-center justify-center pointer-events-auto"
          >
            {/* CARD 1 (Back / Top): "Locked Reserve Vault" (Dark slate) */}
            <motion.div
              initial={{ y: -60, opacity: 0, scale: 0.85 }}
              animate={{ y: -30, opacity: 0.75, scale: 0.9, rotate: -4 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="absolute inset-x-2 top-0 z-10 backdrop-blur-md bg-slate-900/90 dark:bg-[#0c141d]/95 border border-slate-700/60 dark:border-white/10 rounded-2xl p-4 shadow-2xl text-white hover:opacity-90 transition-opacity"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-300 block">
                      Locked Reserve Vault
                    </span>
                    <span className="text-[9px] text-zinc-400">Autoshield Floor Target</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Ring-fenced
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-slate-800">
                <span className="text-lg font-black text-white tracking-tight">
                  ₹25,000 Ring-Fenced
                </span>
                <span className="text-[10px] text-zinc-400">Floor Buffer</span>
              </div>
            </motion.div>

            {/* CARD 2 (Middle): "HDFC Salary Account" (Translucent emerald) */}
            <motion.div
              initial={{ y: -60, opacity: 0, scale: 0.9 }}
              animate={{ y: -15, opacity: 0.88, scale: 0.95, rotate: 3 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="absolute inset-x-1 top-4 z-20 backdrop-blur-md bg-emerald-900/60 dark:bg-emerald-950/75 border border-emerald-500/30 rounded-2xl p-4 shadow-2xl text-white hover:opacity-95 transition-opacity"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CreditCard className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-100 block">
                      HDFC Salary Account
                    </span>
                    <span className="text-[9px] text-emerald-300/80">Primary Operational Stream</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Active Feed
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-emerald-800/50">
                <span className="text-base font-extrabold text-white tracking-wider font-mono">
                  •••• 9012 | ₹68,000
                </span>
                <span className="text-[10px] text-emerald-300/80">Salary Provenance</span>
              </div>
            </motion.div>

            {/* CARD 3 (Front / Primary): "Shield Liquid Vault" (Solid emerald gradient) */}
            <motion.div
              initial={{ y: -60, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="absolute inset-x-0 top-8 z-30 rounded-2xl bg-gradient-to-tr from-[#064E3B] via-[#047857] to-[#022c22] p-5 text-white shadow-2xl shadow-emerald-950/60 border border-emerald-400/30 backdrop-blur-md flex flex-col justify-between overflow-hidden group hover:scale-[1.01] transition-transform"
            >
              {/* Soft ambient corner light flare */}
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-emerald-300/20 blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between z-10 mb-3">
                <div className="flex items-center gap-2.5">
                  {/* Golden Microchip Graphic */}
                  <div className="w-9 h-7 rounded-md bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 p-[1px] shadow-xs flex items-center justify-center">
                    <div className="w-full h-full rounded-[3px] border border-amber-600/40 grid grid-cols-2 gap-0.5 p-0.5 opacity-80">
                      <div className="bg-amber-300/60 rounded-xs"></div>
                      <div className="bg-amber-300/60 rounded-xs"></div>
                      <div className="bg-amber-300/60 rounded-xs"></div>
                      <div className="bg-amber-300/60 rounded-xs"></div>
                    </div>
                  </div>

                  <svg
                    className="w-4 h-4 text-emerald-200/80"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.5 14.5A2.5 2.5 0 0011 12m0 0a2.5 2.5 0 00-2.5-2.5M11 12H3m14-5.5a7.5 7.5 0 000 11m-3.5-8.5a4 4 0 000 6"
                    />
                  </svg>
                </div>

                <div className="flex items-center gap-1 text-emerald-200 text-xs font-bold tracking-wider uppercase bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-400/20">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Shield Liquid Vault</span>
                </div>
              </div>

              <div className="z-10 tracking-widest font-mono text-sm sm:text-base text-emerald-100 font-semibold drop-shadow-xs my-1">
                4921 •••• •••• 8842
              </div>

              <div className="flex items-end justify-between z-10 mt-3 pt-2 border-t border-emerald-400/20">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-emerald-300/80 font-semibold block">
                    CARDHOLDER
                  </span>
                  <p className="text-xs font-black tracking-wider uppercase text-white">
                    AUTHORIZED USER
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase tracking-wider text-emerald-300/80 font-semibold block">
                    LIQUID VAULT
                  </span>
                  <p className="text-sm sm:text-base font-extrabold text-white">
                    ₹1,42,850 Liquid
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* =====================================================================
            GLOWING GREEN ELLIPTICAL PEDESTAL AT ABSOLUTE BOTTOM CENTER
           ===================================================================== */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-80 sm:w-96 h-24 flex items-center justify-center pointer-events-none z-10">
          <div className="absolute inset-x-6 top-6 h-12 bg-emerald-500/25 dark:bg-emerald-500/35 blur-2xl rounded-full" />
          <div className="w-80 h-14 rounded-[100%] border-b-4 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.35)] bg-gradient-to-t from-emerald-200/60 dark:from-emerald-950/70 via-emerald-100/30 dark:via-emerald-900/20 to-transparent transform scale-y-50" />
          <div className="absolute w-56 h-10 rounded-[100%] border border-emerald-400/40 shadow-[0_0_25px_rgba(52,211,153,0.35)] transform scale-y-50" />
        </div>

        {/* Footer Tagline at Absolute Bottom */}
        <div className="absolute bottom-4 inset-x-0 z-20 text-center pointer-events-none px-4">
          <p className="text-sm font-bold tracking-wide text-emerald-800 dark:text-emerald-400 drop-shadow-xs">
            SpendShield: Your intelligent financial defense
          </p>
          <p className="text-[11px] text-slate-600 dark:text-zinc-500 mt-0.5">
            Zero-hallucination cashflow telemetry & autoshield liquidity vaults.
          </p>
        </div>
      </div>

      {/* =======================================================================
          RIGHT COLUMN: AUTH FORM & LOGO (Enlarged & Strictly Centered Logo)
         ======================================================================= */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-12 lg:p-16 relative bg-slate-50 dark:bg-[#0a0a0a] transition-colors duration-300">
        <div className="w-full max-w-md space-y-7 z-10 flex flex-col items-center justify-center text-center">
          {/* Brand Logo: Strictly Centered Horizontally above "Sign in", Large and Prominent */}
          <div className="w-full flex justify-center items-center">
            <img
              src="/logo.jpg"
              alt="SpendShield"
              className="h-24 md:h-28 w-auto mx-auto mb-6 object-contain"
            />
          </div>

          {/* Form Header Headline Container */}
          <div className="space-y-1.5 w-full text-center">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {t("sign_in")}
            </h1>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              {t("Welcome back. Enter your credentials to access your defense dashboard.")}
            </p>
          </div>

          {/* Apple & Google SSO Buttons (Dynamic Backgrounds) */}
          <div className="grid grid-cols-2 gap-3 w-full">
            {/* Google SSO Button */}
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              title="Continue with Google"
              className="py-3 px-4 rounded-2xl bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-white/10 hover:border-emerald-500/40 dark:hover:border-emerald-500/30 text-slate-800 dark:text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.98] shadow-xs hover:shadow-sm cursor-pointer group"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
                />
              </svg>
              <span>{t("Google")}</span>
            </button>

            {/* Apple SSO Button */}
            <button
              type="button"
              onClick={() => handleOAuth("apple")}
              title="Continue with Apple"
              className="py-3 px-4 rounded-2xl bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-white/10 hover:border-emerald-500/40 dark:hover:border-emerald-500/30 text-slate-800 dark:text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.98] shadow-xs hover:shadow-sm cursor-pointer group"
            >
              <svg className="w-4 h-4 fill-current shrink-0 text-slate-900 dark:text-white" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.93-2.85-.9.04-1.99.6-2.63 1.35-.57.65-1.06 1.72-.93 2.74 1.01.08 2.02-.49 2.63-1.24z" />
              </svg>
              <span>{t("Apple")}</span>
            </button>
          </div>

          {/* Subtle "or" Divider */}
          <div className="relative flex items-center justify-center w-full">
            <div className="border-t border-slate-200 dark:border-zinc-800 w-full" />
            <span className="bg-slate-50 dark:bg-[#0a0a0a] px-3 text-xs text-slate-400 dark:text-zinc-500 uppercase tracking-widest font-semibold shrink-0">
              {t("or")}
            </span>
            <div className="border-t border-slate-200 dark:border-zinc-800 w-full" />
          </div>

          {/* The Authentication Form */}
          <form onSubmit={handleLogin} className="space-y-4 w-full">
            {/* Email Field */}
            <div className="space-y-1.5 text-left">
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
              >
                {t("email_address")}
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoComplete="email"
                  className="w-full bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 rounded-2xl py-3 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 transition-all outline-none shadow-xs"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                >
                  {t("password")}
                </label>
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    handlePasswordReset();
                  }}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors"
                >
                  {t("Forgot password?")}
                </a>
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  className="w-full bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 rounded-2xl py-3 pl-10 pr-11 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 transition-all outline-none shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors p-0.5 cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2 text-left"
              >
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </motion.div>
            )}

            {notice && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2 text-left"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{notice}</span>
              </motion.div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{authMode === "sign_up" ? "Creating account..." : t("Signing in...")}</span>
                </>
              ) : (
                <>
                  <span>{authMode === "sign_up" ? "Create account" : t("sign_in")}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Bottom Links: "No account? Sign up" */}
          <div className="pt-2 text-center text-xs text-slate-600 dark:text-zinc-400 w-full">
            <span>{authMode === "sign_up" ? "Already have an account? " : t("No account? ")}</span>
            <a
              href="#signup"
              onClick={(e) => {
                e.preventDefault();
                setAuthMode((mode) => mode === "sign_up" ? "sign_in" : "sign_up");
                setError("");
                setNotice("");
              }}
              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold transition-colors"
            >
              {authMode === "sign_up" ? t("sign_in") : t("Sign up")}
            </a>
          </div>

          {/* Quick Demo Credentials Pill for Reviewers */}
          <div className="pt-4 border-t border-slate-200 dark:border-zinc-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-500 w-full">
            <span>Use an account created in Supabase</span>
            <button
              type="button"
              onClick={handleDemoFill}
              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold hover:underline transition-all cursor-pointer"
            >
              Auto-fill credentials
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
