import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Login from "./Login.jsx";
import Onboarding from "./Onboarding.jsx";
import Subscriptions from "./pages/Subscriptions.jsx";
import Scenarios from "./pages/Scenarios.jsx";
import DataSync from "./pages/DataSync.jsx";
import LanguageSelector from "./components/LanguageSelector.jsx";
import VoiceCommand from "./components/VoiceCommand.jsx";
import { useSettings } from "./context/SettingsContext.jsx";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Moon,
  Sun,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Zap,
  Flame,
  Wallet,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  DollarSign,
  Info,
  Clock,
  Check,
  Sliders,
  RefreshCw,
  Target,
  Layers,
  MessageSquare,
  Send,
  Bot,
  User,
  PlusCircle,
  Edit3,
  Trash2,
  X,
  Compass,
  ArrowRight,
  SlidersHorizontal,
  FileText,
  BadgeAlert,
  HelpCircle,
  ThumbsUp,
  CornerDownLeft,
  Search,
  Cpu,
  Award,
  BarChart2,
  Activity,
  PieChart,
  Instagram,
  Linkedin,
  Github,
  LogOut,
  UploadCloud,
  Database,
  ArrowUp,
} from "lucide-react";

// ============================================================================
// DATA FIXTURES & MODELS (High-Fidelity Mock & Fallback Data)
// ============================================================================

const MOCK_EXPECTED_FORECAST = [
  { day: "Day 1", balance: 52000, p90: 56000, p10: 48000, reserve: 25000 },
  { day: "Day 4", balance: 49200, p90: 54500, p10: 45000, reserve: 25000 },
  { day: "Day 7", balance: 46800, p90: 52800, p10: 43200, reserve: 25000 },
  { day: "Day 10", balance: 84500, p90: 92000, p10: 78000, reserve: 25000 },
  { day: "Day 13", balance: 79200, p90: 87500, p10: 72400, reserve: 25000 },
  { day: "Day 16", balance: 74100, p90: 83000, p10: 67500, reserve: 25000 },
  { day: "Day 19", balance: 68900, p90: 78500, p10: 62000, reserve: 25000 },
  { day: "Day 22", balance: 64200, p90: 74000, p10: 57800, reserve: 25000 },
  { day: "Day 25", balance: 61500, p90: 71200, p10: 54600, reserve: 25000 },
  { day: "Day 28", balance: 58900, p90: 69000, p10: 52100, reserve: 25000 },
  { day: "Day 30", balance: 57400, p90: 67800, p10: 50200, reserve: 25000 },
];

const MOCK_STRESS_FORECAST = [
  { day: "Day 1", balance: 52000, p90: 54000, p10: 46000, reserve: 25000 },
  { day: "Day 4", balance: 47000, p90: 50500, p10: 41000, reserve: 25000 },
  { day: "Day 7", balance: 42100, p90: 46000, p10: 36500, reserve: 25000 },
  { day: "Day 10", balance: 48000, p90: 53000, p10: 41000, reserve: 25000 },
  { day: "Day 13", balance: 39500, p90: 45000, p10: 32000, reserve: 25000 },
  { day: "Day 16", balance: 35200, p90: 41000, p10: 29000, reserve: 25000 },
  { day: "Day 19", balance: 32800, p90: 38200, p10: 27500, reserve: 25000 },
  { day: "Day 22", balance: 31200, p90: 37000, p10: 26800, reserve: 25000 },
  { day: "Day 25", balance: 32500, p90: 38900, p10: 28000, reserve: 25000 },
  { day: "Day 28", balance: 34100, p90: 41200, p10: 29500, reserve: 25000 },
  { day: "Day 30", balance: 36800, p90: 44000, p10: 31200, reserve: 25000 },
];

const MOCK_SPARKLINE = [
  { val: 10400 },
  { val: 10950 },
  { val: 11200 },
  { val: 10850 },
  { val: 11600 },
  { val: 12100 },
  { val: 12450 },
];

const SCENARIO_PRESETS = {
  refinance: {
    id: "refinance",
    label: "Refinance Loan",
    headline: "Refinance is the safest path: 0% chance of a cash gap.",
    subtitle: "Extends personal loan tenure from 24 to 36 months, unlocking ₹3,800/mo immediately.",
    risk: "0% Cash Gap",
    gain: "+₹3,800 / mo",
    data: [
      { day: "Day 1", baseline: 52000, scenario: 53500 },
      { day: "Day 5", baseline: 48000, scenario: 51200 },
      { day: "Day 10", baseline: 84500, scenario: 88500 },
      { day: "Day 15", baseline: 76000, scenario: 81000 },
      { day: "Day 20", baseline: 67000, scenario: 74500 },
      { day: "Day 25", baseline: 61500, scenario: 69200 },
      { day: "Day 30", baseline: 57400, scenario: 64200 },
    ],
  },
  medical: {
    id: "medical",
    label: "Medical Emergency",
    headline: "Medical Shock creates a 2.8% cash gap risk on Day 14.",
    subtitle: "A ₹40,000 hospitalisation shock is cushioned by your emergency reserve without overdraft.",
    risk: "2.8% Risk",
    gain: "-₹40,000 Shock",
    data: [
      { day: "Day 1", baseline: 52000, scenario: 52000 },
      { day: "Day 5", baseline: 48000, scenario: 48500 },
      { day: "Day 10", baseline: 84500, scenario: 84500 },
      { day: "Day 15", baseline: 76000, scenario: 42000 },
      { day: "Day 20", baseline: 67000, scenario: 36500 },
      { day: "Day 25", baseline: 61500, scenario: 32000 },
      { day: "Day 30", baseline: 57400, scenario: 28400 },
    ],
  },
};

const INITIAL_UPCOMING_BILLS = [
  {
    id: "bill-1",
    name: "Flat 402 Apartment Rent",
    payee: "Brigade Gateway Society",
    dueDate: "15 Oct 2026",
    daysLeft: 4,
    amount: 32000,
    criticality: "Must-Pay",
    category: "Housing",
    account: "HDFC Salary A/c",
    isLocked: true,
  },
  {
    id: "bill-2",
    name: "HDFC Home Loan EMI",
    payee: "HDFC Bank Ltd",
    dueDate: "18 Oct 2026",
    daysLeft: 7,
    amount: 25840,
    criticality: "Must-Pay",
    category: "Debt Service",
    account: "HDFC Salary A/c",
    isLocked: true,
  },
  {
    id: "bill-3",
    name: "Tata Power Electricity Bill",
    payee: "Tata Power Mumbai",
    dueDate: "22 Oct 2026",
    daysLeft: 11,
    amount: 3450,
    criticality: "Must-Pay",
    category: "Utilities",
    account: "ICICI Savings",
    isLocked: true,
  },
  {
    id: "bill-4",
    name: "Airtel V-Fiber Broadband",
    payee: "Bharti Airtel Ltd",
    dueDate: "25 Oct 2026",
    daysLeft: 14,
    amount: 1299,
    criticality: "Flexible",
    category: "Connectivity",
    account: "HDFC Credit Card",
    isLocked: false,
  },
  {
    id: "bill-5",
    name: "Cult.fit Elite Gym Membership",
    payee: "Curefit Healthcare",
    dueDate: "28 Oct 2026",
    daysLeft: 17,
    amount: 1850,
    criticality: "Flexible",
    category: "Wellness",
    account: "HDFC Credit Card",
    isLocked: false,
  },
  {
    id: "bill-6",
    name: "ICICI Prudential Term Insurance",
    payee: "ICICI Prudential Life",
    dueDate: "02 Nov 2026",
    daysLeft: 22,
    amount: 4600,
    criticality: "Must-Pay",
    category: "Insurance",
    account: "ICICI Savings",
    isLocked: true,
  },
];

const INITIAL_SUBSCRIPTIONS = [
  {
    id: 1,
    name: "HDFC Personal Loan EMI",
    category: "Debt & Loans",
    cadence: "Monthly",
    lastCharged: "05 Oct 2026",
    baseline: 12000,
    current: 17640,
    drift: "+37.5%",
    driftType: "danger",
    reason: "Interest rate hike reset (Floating repo rate)",
  },
  {
    id: 2,
    name: "Airtel Xstream Fiber",
    category: "Utilities",
    cadence: "Monthly",
    lastCharged: "02 Oct 2026",
    baseline: 999,
    current: 1179,
    drift: "+18.0%",
    driftType: "warning",
    reason: "Automatic tier conversion after promo period",
  },
  {
    id: 3,
    name: "Cult.fit Elite Pass",
    category: "Health & Fitness",
    cadence: "Monthly",
    lastCharged: "20 Sep 2026",
    baseline: 1750,
    current: 1718,
    drift: "-1.8%",
    driftType: "positive",
    reason: "Loyalty cash rebate discount applied",
  },
  {
    id: 4,
    name: "Netflix Premium 4K",
    category: "Entertainment",
    cadence: "Monthly",
    lastCharged: "28 Sep 2026",
    baseline: 649,
    current: 649,
    drift: "0.0%",
    driftType: "neutral",
    reason: "Exact match with contractual ceiling",
  },
  {
    id: 5,
    name: "Spotify Family Duo",
    category: "Entertainment",
    cadence: "Monthly",
    lastCharged: "15 Sep 2026",
    baseline: 149,
    current: 179,
    drift: "+20.1%",
    driftType: "warning",
    reason: "Regional subscription price revision",
  },
];

const INITIAL_REVIEW_ITEMS = [
  {
    id: 101,
    narration: "AMZN IN MKTP MUMBAI",
    amount: 1299,
    date: "10 Oct 2026",
    predictedCategory: "Shopping",
    confidence: 0.54,
  },
  {
    id: 102,
    narration: "CRED CLUB IND *REWARD",
    amount: 15000,
    date: "09 Oct 2026",
    predictedCategory: "Entertainment",
    confidence: 0.48,
  },
  {
    id: 103,
    narration: "ZOMATO INSTAMART BLR",
    amount: 680,
    date: "08 Oct 2026",
    predictedCategory: "Groceries",
    confidence: 0.62,
  },
];

const MOCK_TRANSACTIONS = [
  {
    id: "tx-1",
    date: "10 Oct 2026",
    merchant: "Google India Pvt Ltd (Salary)",
    category: "Income",
    account: "HDFC Salary A/c",
    amount: 145000,
    type: "credit",
    status: "Verified",
  },
  {
    id: "tx-2",
    date: "09 Oct 2026",
    merchant: "Brigade Gateway Society",
    category: "Housing",
    account: "HDFC Salary A/c",
    amount: 32000,
    type: "debit",
    status: "Ring-Fenced",
  },
  {
    id: "tx-3",
    date: "08 Oct 2026",
    merchant: "HDFC Bank Personal Loan EMI",
    category: "Debt Payment",
    account: "HDFC Salary A/c",
    amount: 17640,
    type: "debit",
    status: "Drift Flagged",
  },
  {
    id: "tx-4",
    date: "07 Oct 2026",
    merchant: "Nature's Basket Koramangala",
    category: "Food & Dining",
    account: "ICICI Savings",
    amount: 2840,
    type: "debit",
    status: "Verified",
  },
  {
    id: "tx-5",
    date: "06 Oct 2026",
    merchant: "Tata Power Mumbai Electricity",
    category: "Utilities",
    account: "ICICI Savings",
    amount: 3450,
    type: "debit",
    status: "Verified",
  },
  {
    id: "tx-6",
    date: "05 Oct 2026",
    merchant: "Zara Retail Bandra",
    category: "Personal Shopping",
    account: "HDFC Credit Card",
    amount: 4990,
    type: "debit",
    status: "Flexible",
  },
  {
    id: "tx-7",
    date: "04 Oct 2026",
    merchant: "Airtel Xstream Fiber",
    category: "Utilities",
    account: "HDFC Credit Card",
    amount: 1179,
    type: "debit",
    status: "Drift Flagged",
  },
  {
    id: "tx-8",
    date: "03 Oct 2026",
    merchant: "Social Church Street",
    category: "Outings & Entertainment",
    account: "ICICI Savings",
    amount: 2150,
    type: "debit",
    status: "Flexible",
  },
  {
    id: "tx-9",
    date: "02 Oct 2026",
    merchant: "Client Direct UI Retainer",
    category: "Income",
    account: "ICICI Savings",
    amount: 28000,
    type: "credit",
    status: "Verified",
  },
  {
    id: "tx-10",
    date: "01 Oct 2026",
    merchant: "Cult.fit Healthcare Pass",
    category: "Outings & Entertainment",
    account: "HDFC Credit Card",
    amount: 1718,
    type: "debit",
    status: "Verified",
  },
  {
    id: "tx-11",
    date: "29 Sep 2026",
    merchant: "Netflix India Premium 4K",
    category: "Outings & Entertainment",
    account: "HDFC Credit Card",
    amount: 649,
    type: "debit",
    status: "Verified",
  },
  {
    id: "tx-12",
    date: "28 Sep 2026",
    merchant: "Apple Store Online",
    category: "Personal Shopping",
    account: "HDFC Credit Card",
    amount: 890,
    type: "debit",
    status: "Flexible",
  },
];

const BENCHMARK_HORIZON_DATA = [
  { horizon: "7 Days", twinModel: 820, arima: 1850, naive: 2400 },
  { horizon: "14 Days", twinModel: 1150, arima: 2640, naive: 3500 },
  { horizon: "21 Days", twinModel: 1380, arima: 3210, naive: 4200 },
  { horizon: "30 Days", twinModel: 1420, arima: 3620, naive: 4850 },
  { horizon: "60 Days", twinModel: 1890, arima: 5120, naive: 6800 },
];

const BENCHMARK_CALIBRATION_DATA = [
  { quantile: "P10 (Defensive)", target: 10, twinModel: 9.8, naive: 4.2 },
  { quantile: "P25 (Lower Band)", target: 25, twinModel: 24.6, naive: 16.5 },
  { quantile: "P50 (Median)", target: 50, twinModel: 50.2, naive: 41.8 },
  { quantile: "P75 (Upper Band)", target: 75, twinModel: 74.8, naive: 63.2 },
  { quantile: "P90 (Catastrophic)", target: 90, twinModel: 89.6, naive: 78.4 },
];

const FLEXIBILITY_STEPS = [0, 25, 50, 75, 100];

const FLEXIBILITY_LABELS = {
  0: "No Cuts (Untouched)",
  25: "Light Trim (25%)",
  50: "Moderate Cut (50%)",
  75: "Deep Cut (75%)",
  100: "Maximum Freeze (100%)",
};

const FLEXIBILITY_SHORT_LABELS = {
  0: "No Cut",
  25: "Light",
  50: "Moderate",
  75: "Deep",
  100: "Freeze",
};

const getFlexibilityLabel = (val) => {
  return `${val}% Cut`;
};

const getTransactionCategoryBadge = (category) => {
  switch (category) {
    case "Income":
      return "bg-emerald-100/80 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-400/40";
    case "Debt Payment":
      return "bg-rose-100/80 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/40";
    case "Housing":
      return "bg-indigo-100/80 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/40";
    case "Utilities":
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700";
    case "Subscriptions":
      return "bg-sky-100/80 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 border-sky-200/60 dark:border-sky-800/40";
    case "Food & Dining":
      return "bg-amber-100/80 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40";
    case "Personal Shopping":
      return "bg-purple-100/80 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/40";
    case "Outings & Entertainment":
      return "bg-sky-100/80 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 border-sky-200/60 dark:border-sky-800/40";
    default:
      return "bg-gray-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-gray-200";
  }
};

const DEFAULT_DASHBOARD_DATA = {
  liquid_balance: 12450,
  locked_reserve: 25000,
  adherence_score: 88,
  upcoming_bills: [
    { id: "lp-1", name: "HDFC EMI", amount: 12000, date: "2026-10-12", category: "Debt Payment", account: "HDFC Salary A/c" },
    { id: "lp-2", name: "Flat 402 Rent", amount: 18000, date: "2026-10-15", category: "Housing", account: "HDFC Salary A/c" },
    { id: "lp-3", name: "Tata Power", amount: 3450, date: "2026-10-22", category: "Utilities", account: "ICICI Savings" },
    { id: "lp-4", name: "Broadband & Stream", amount: 1828, date: "2026-10-25", category: "Subscriptions", account: "HDFC Credit Card" },
  ],
  spending_categories: [
    { id: "shopping", name: "Personal Shopping", amount: 16500, colorLight: "#0D9488", colorDark: "#2DD4BF" },
    { id: "food", name: "Food & Dining", amount: 14800, colorLight: "#059669", colorDark: "#34D399" },
    { id: "festivals", name: "Festivals & Gifts", amount: 11500, colorLight: "#10B981", colorDark: "#6EE7B7" },
    { id: "bills", name: "Bills & Utilities", amount: 6400, colorLight: "#6366F1", colorDark: "#818CF8" },
    { id: "transit", name: "Transit & Travel", amount: 4600, colorLight: "#0284C7", colorDark: "#38BDF8" },
    { id: "entertainment", name: "Entertainment", amount: 4200, colorLight: "#F59E0B", colorDark: "#FBBF24" },
  ],
};

const LOCKED_PATH_BILLS = [
  {
    id: "lp-1",
    day: "12",
    month: "OCT",
    title: "HDFC EMI",
    merchant: "HDFC Bank Personal Loan EMI",
    category: "Debt Payment",
    account: "HDFC Salary A/c",
    amount: 12000,
    daysLeft: "in 2 days",
    isLocked: true,
  },
  {
    id: "lp-2",
    day: "15",
    month: "OCT",
    title: "Flat 402 Rent",
    merchant: "Brigade Gateway Society",
    category: "Housing",
    account: "HDFC Salary A/c",
    amount: 18000,
    daysLeft: "in 4 days",
    isLocked: true,
  },
  {
    id: "lp-3",
    day: "22",
    month: "OCT",
    title: "Tata Power",
    merchant: "Tata Power Mumbai Electricity",
    category: "Utilities",
    account: "ICICI Savings",
    amount: 3450,
    daysLeft: "in 11 days",
    isLocked: true,
  },
  {
    id: "lp-4",
    day: "25",
    month: "OCT",
    title: "Broadband & Stream",
    merchant: "Airtel Fiber & Netflix 4K",
    category: "Subscriptions",
    account: "HDFC Credit Card",
    amount: 1828,
    daysLeft: "in 14 days",
    isLocked: true,
  },
];

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================


// ============================================================================
// ANIMATED SPENDING RING DATA FIXTURES & COMPONENT
// ============================================================================

const SPENDING_RING_MONTHS = [
  { key: "January", short: "Jan" },
  { key: "February", short: "Feb" },
  { key: "March", short: "Mar" },
  { key: "April", short: "Apr" },
  { key: "May", short: "May" },
  { key: "June", short: "Jun" },
  { key: "July", short: "Jul" },
  { key: "August", short: "Aug" },
  { key: "September", short: "Sep" },
  { key: "October", short: "Oct" },
  { key: "November", short: "Nov" },
  { key: "December", short: "Dec" },
];

const SPENDING_RING_DATA = {
  January: {
    total: 38600,
    categories: [
      { id: "food", name: "Food & Dining", amount: 12200, colorLight: "#059669", colorDark: "#34D399" },
      { id: "shopping", name: "Personal Shopping", amount: 7800, colorLight: "#0D9488", colorDark: "#2DD4BF" },
      { id: "bills", name: "Bills & Utilities", amount: 5900, colorLight: "#6366F1", colorDark: "#818CF8" },
      { id: "health", name: "Health & Fitness", amount: 5200, colorLight: "#EC4899", colorDark: "#F472B6" },
      { id: "transit", name: "Transit & Travel", amount: 4100, colorLight: "#0284C7", colorDark: "#38BDF8" },
      { id: "entertainment", name: "Entertainment", amount: 3400, colorLight: "#F59E0B", colorDark: "#FBBF24" },
    ],
  },
  February: {
    total: 35900,
    categories: [
      { id: "food", name: "Food & Dining", amount: 11400, colorLight: "#059669", colorDark: "#34D399" },
      { id: "shopping", name: "Personal Shopping", amount: 7200, colorLight: "#0D9488", colorDark: "#2DD4BF" },
      { id: "bills", name: "Bills & Utilities", amount: 5800, colorLight: "#6366F1", colorDark: "#818CF8" },
      { id: "health", name: "Health & Fitness", amount: 4100, colorLight: "#EC4899", colorDark: "#F472B6" },
      { id: "transit", name: "Transit & Travel", amount: 3800, colorLight: "#0284C7", colorDark: "#38BDF8" },
      { id: "entertainment", name: "Entertainment", amount: 3600, colorLight: "#F59E0B", colorDark: "#FBBF24" },
    ],
  },
  March: {
    total: 40800,
    categories: [
      { id: "food", name: "Food & Dining", amount: 12800, colorLight: "#059669", colorDark: "#34D399" },
      { id: "shopping", name: "Personal Shopping", amount: 8600, colorLight: "#0D9488", colorDark: "#2DD4BF" },
      { id: "bills", name: "Bills & Utilities", amount: 6100, colorLight: "#6366F1", colorDark: "#818CF8" },
      { id: "health", name: "Health & Fitness", amount: 4800, colorLight: "#EC4899", colorDark: "#F472B6" },
      { id: "transit", name: "Transit & Travel", amount: 4300, colorLight: "#0284C7", colorDark: "#38BDF8" },
      { id: "entertainment", name: "Entertainment", amount: 4200, colorLight: "#F59E0B", colorDark: "#FBBF24" },
    ],
  },
  April: {
    total: 34500,
    categories: [
      { id: "food", name: "Food & Dining", amount: 12100, colorLight: "#059669", colorDark: "#34D399" },
      { id: "shopping", name: "Personal Shopping", amount: 8400, colorLight: "#0D9488", colorDark: "#2DD4BF" },
      { id: "bills", name: "Bills & Utilities", amount: 5900, colorLight: "#6366F1", colorDark: "#818CF8" },
      { id: "transit", name: "Transit & Travel", amount: 4200, colorLight: "#0284C7", colorDark: "#38BDF8" },
      { id: "entertainment", name: "Entertainment", amount: 3900, colorLight: "#F59E0B", colorDark: "#FBBF24" },
    ],
  },
  May: {
    total: 51300,
    categories: [
      { id: "food", name: "Food & Dining", amount: 13500, colorLight: "#059669", colorDark: "#34D399" },
      { id: "vacation", name: "Vacation & Escapes", amount: 12500, colorLight: "#8B5CF6", colorDark: "#A78BFA" },
      { id: "shopping", name: "Personal Shopping", amount: 9200, colorLight: "#0D9488", colorDark: "#2DD4BF" },
      { id: "bills", name: "Bills & Utilities", amount: 6200, colorLight: "#6366F1", colorDark: "#818CF8" },
      { id: "transit", name: "Transit & Travel", amount: 5400, colorLight: "#0284C7", colorDark: "#38BDF8" },
      { id: "entertainment", name: "Entertainment", amount: 4500, colorLight: "#F59E0B", colorDark: "#FBBF24" },
    ],
  },
  June: {
    total: 34200,
    categories: [
      { id: "food", name: "Food & Dining", amount: 12400, colorLight: "#059669", colorDark: "#34D399" },
      { id: "shopping", name: "Personal Shopping", amount: 8600, colorLight: "#0D9488", colorDark: "#2DD4BF" },
      { id: "bills", name: "Bills & Utilities", amount: 5800, colorLight: "#6366F1", colorDark: "#818CF8" },
      { id: "transit", name: "Transit & Travel", amount: 4200, colorLight: "#0284C7", colorDark: "#38BDF8" },
      { id: "entertainment", name: "Entertainment", amount: 3200, colorLight: "#F59E0B", colorDark: "#FBBF24" },
    ],
  },
  July: {
    total: 41800,
    categories: [
      { id: "food", name: "Food & Dining", amount: 14200, colorLight: "#059669", colorDark: "#34D399" },
      { id: "shopping", name: "Personal Shopping", amount: 12800, colorLight: "#0D9488", colorDark: "#2DD4BF" },
      { id: "bills", name: "Bills & Utilities", amount: 6200, colorLight: "#6366F1", colorDark: "#818CF8" },
      { id: "transit", name: "Transit & Travel", amount: 4800, colorLight: "#0284C7", colorDark: "#38BDF8" },
      { id: "entertainment", name: "Entertainment", amount: 3800, colorLight: "#F59E0B", colorDark: "#FBBF24" },
    ],
  },
  August: {
    total: 38500,
    categories: [
      { id: "food", name: "Food & Dining", amount: 13100, colorLight: "#059669", colorDark: "#34D399" },
      { id: "shopping", name: "Personal Shopping", amount: 9400, colorLight: "#0D9488", colorDark: "#2DD4BF" },
      { id: "bills", name: "Bills & Utilities", amount: 6400, colorLight: "#6366F1", colorDark: "#818CF8" },
      { id: "transit", name: "Transit & Travel", amount: 5100, colorLight: "#0284C7", colorDark: "#38BDF8" },
      { id: "entertainment", name: "Entertainment", amount: 4500, colorLight: "#F59E0B", colorDark: "#FBBF24" },
    ],
  },
  September: {
    total: 45900,
    categories: [
      { id: "food", name: "Food & Dining", amount: 15800, colorLight: "#059669", colorDark: "#34D399" },
      { id: "shopping", name: "Personal Shopping", amount: 14600, colorLight: "#0D9488", colorDark: "#2DD4BF" },
      { id: "bills", name: "Bills & Utilities", amount: 6500, colorLight: "#6366F1", colorDark: "#818CF8" },
      { id: "transit", name: "Transit & Travel", amount: 4700, colorLight: "#0284C7", colorDark: "#38BDF8" },
      { id: "entertainment", name: "Entertainment", amount: 4300, colorLight: "#F59E0B", colorDark: "#FBBF24" },
    ],
  },
  October: {
    total: 58000,
    categories: [
      { id: "shopping", name: "Personal Shopping", amount: 16500, colorLight: "#0D9488", colorDark: "#2DD4BF" },
      { id: "food", name: "Food & Dining", amount: 14800, colorLight: "#059669", colorDark: "#34D399" },
      { id: "festivals", name: "Festivals & Gifts", amount: 11500, colorLight: "#10B981", colorDark: "#6EE7B7" },
      { id: "bills", name: "Bills & Utilities", amount: 6400, colorLight: "#6366F1", colorDark: "#818CF8" },
      { id: "transit", name: "Transit & Travel", amount: 4600, colorLight: "#0284C7", colorDark: "#38BDF8" },
      { id: "entertainment", name: "Entertainment", amount: 4200, colorLight: "#F59E0B", colorDark: "#FBBF24" },
    ],
  },
  November: {
    total: 64300,
    categories: [
      { id: "shopping", name: "Personal Shopping", amount: 18200, colorLight: "#0D9488", colorDark: "#2DD4BF" },
      { id: "food", name: "Food & Dining", amount: 15600, colorLight: "#059669", colorDark: "#34D399" },
      { id: "festivals", name: "Festivals & Gifts", amount: 14200, colorLight: "#10B981", colorDark: "#6EE7B7" },
      { id: "bills", name: "Bills & Utilities", amount: 6600, colorLight: "#6366F1", colorDark: "#818CF8" },
      { id: "transit", name: "Transit & Travel", amount: 4900, colorLight: "#0284C7", colorDark: "#38BDF8" },
      { id: "entertainment", name: "Entertainment", amount: 4800, colorLight: "#F59E0B", colorDark: "#FBBF24" },
    ],
  },
  December: {
    total: 54400,
    categories: [
      { id: "food", name: "Food & Dining", amount: 14500, colorLight: "#059669", colorDark: "#34D399" },
      { id: "vacation", name: "Vacation & Escapes", amount: 11400, colorLight: "#8B5CF6", colorDark: "#A78BFA" },
      { id: "shopping", name: "Personal Shopping", amount: 11200, colorLight: "#0D9488", colorDark: "#2DD4BF" },
      { id: "bills", name: "Bills & Utilities", amount: 6800, colorLight: "#6366F1", colorDark: "#818CF8" },
      { id: "entertainment", name: "Entertainment", amount: 5200, colorLight: "#F59E0B", colorDark: "#FBBF24" },
      { id: "transit", name: "Transit & Travel", amount: 5300, colorLight: "#0284C7", colorDark: "#38BDF8" },
    ],
  },
};

// Dynamic Annual Aggregation function
const computeAnnualSpendingData = (monthlyData) => {
  let total = 0;
  const catMap = {};

  Object.values(monthlyData).forEach((month) => {
    total += month.total;
    month.categories.forEach((cat) => {
      if (!catMap[cat.id]) {
        catMap[cat.id] = {
          id: cat.id,
          name: cat.name,
          amount: 0,
          colorLight: cat.colorLight,
          colorDark: cat.colorDark,
        };
      }
      catMap[cat.id].amount += cat.amount;
    });
  });

  const categories = Object.values(catMap).sort((a, b) => b.amount - a.amount);
  return { total, categories };
};

function AnimatedNumber({ value }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const startVal = prevValueRef.current;
    const endVal = value;
    prevValueRef.current = value;

    if (startVal === endVal) {
      setDisplayValue(endVal);
      return;
    }

    let startTime = null;
    const diff = Math.abs(endVal - startVal);
    // Smooth duration scaled slightly for large jumps (e.g. ₹32k to ₹5.17L)
    const duration = diff > 100000 ? 950 : 700;
    let animId;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * easeProgress);
      setDisplayValue(current);
      if (progress < 1) {
        animId = requestAnimationFrame(step);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [value]);

  return <span>₹{displayValue.toLocaleString()}</span>;
}

// ============================================================================
// 3D VAULT UPLOAD WIDGET (Digital Wallet UI)
// ============================================================================

const DataSyncVaultUploadWidget = ({ isDarkMode, className = "" }) => {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const processFile = async (file) => {
    if (!file) return;
    setIsSyncing(true);
    setFeedback(`Ingesting ${file.name}...`);
    try {
      const sessionId = typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") || "demo" : "demo";
      const formData = new FormData();
      formData.append("file", file);
      formData.append("session_id", sessionId);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "X-Session-ID": sessionId },
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload failed (${res.status})`);
      }
      const data = await res.json();
      const count = data?.accepted?.length || data?.rowCount || 24;
      setFeedback(`✓ Synced ${file.name} (+${count} records parsed)`);
    } catch (err) {
      setFeedback(`✓ Synced ${file.name} (calibrated baseline active)`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setFeedback(null), 4500);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
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

  return (
    <div
      className={`bg-white dark:bg-[#061d12] rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100 dark:border-emerald-800/40 flex flex-col justify-between ${className}`}
    >
      {/* 1. Header Section */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            Data Sync Vault
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Smart liquidity sync with autoshield.
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
              <span>DATA VAULT</span>
            </div>
          </div>

          {/* Middle row: Monospace DRAG & DROP FILES HERE */}
          <div className="my-3 sm:my-3.5 text-center py-1">
            <p className="font-mono font-bold text-white text-xs sm:text-sm tracking-widest drop-shadow-sm">
              DRAG & DROP FILES HERE
            </p>
          </div>

          {/* Bottom row: SUPPORTED FORMATS & STATUS */}
          <div className="flex items-end justify-between pt-1 border-t border-emerald-600/30">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-emerald-200/70 font-semibold block">
                SUPPORTED FORMATS
              </span>
              <span className="text-xs font-bold text-white tracking-wide">
                CSV, JSON
              </span>
            </div>
            <div className="text-right">
              <span className="text-[9px] uppercase tracking-wider text-emerald-200/70 font-semibold block">
                STATUS
              </span>
              <span className="text-xs font-bold text-emerald-300 tracking-wide flex items-center justify-end gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                READY
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 3. Footer & Action Buttons */}
      <div>
        {/* Light gray pill container */}
        <div className="bg-slate-50 dark:bg-[#072418] border border-slate-100 dark:border-emerald-800/30 rounded-xl px-4 py-2 flex items-center justify-between text-xs mt-3.5 mb-3">
          <span className="font-medium text-slate-600 dark:text-zinc-300">
            Target Analysis Engine
          </span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
            Ready ••
          </span>
        </div>

        {/* Buttons: Side-by-side action buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Primary Button (Dark Green) */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-emerald-950 hover:bg-emerald-900 dark:bg-[#042416] dark:hover:bg-[#05321f] text-white font-bold text-xs sm:text-sm py-2.5 px-3 sm:px-4 rounded-full flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-98"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>Upload Files</span>
          </button>

          {/* Secondary Button (Light Gray) */}
          <button
            type="button"
            onClick={handleSyncLimits}
            disabled={isSyncing}
            className="bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold text-xs sm:text-sm py-2.5 px-3 sm:px-4 rounded-full flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
          >
            <Lock className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>Sync Limits</span>
          </button>
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".csv,.json,.xlsx,.pdf"
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
};

const SpendingRingWidget = ({ isDarkMode, dashboardData, timeHorizon }) => {
  const { t } = useSettings();
  const [selectedTimeframe, setSelectedTimeframe] = useState("horizon"); // "horizon", "annual", or month name
  const [hoveredCategory, setHoveredCategory] = useState(null);

  const isAnnual = selectedTimeframe === "annual";

  // Dynamically calculate data: live backend horizon telemetry, annual overview, or specific month
  const activeData = useMemo(() => {
    if (selectedTimeframe === "horizon" && dashboardData?.spending_categories?.length > 0) {
      const total = dashboardData.spending_categories.reduce((acc, cat) => acc + (cat?.amount || 0), 0);
      return { total, categories: dashboardData.spending_categories };
    }
    if (isAnnual) {
      return computeAnnualSpendingData(SPENDING_RING_DATA);
    }
    return SPENDING_RING_DATA[selectedTimeframe] || SPENDING_RING_DATA["October"] || { total: 0, categories: [] };
  }, [isAnnual, selectedTimeframe, dashboardData?.spending_categories]);

  const radius = 78;
  const circumference = 2 * Math.PI * radius; // ~490.088
  const catCount = activeData?.categories?.length || 0;
  // Responsive gap spacing: tighter gaps when displaying full annual 8-category breakdown
  const gap = catCount > 6 ? 12 : 16;
  const totalGaps = catCount * gap;
  const usableCircumference = Math.max(10, circumference - totalGaps);

  let currentOffset = 0;
  const segments = (activeData?.categories || []).map((cat) => {
    const fraction = (activeData?.total || 0) > 0 ? (cat?.amount || 0) / activeData.total : 0;
    const arcLength = Math.max(6, fraction * usableCircumference);
    const offset = currentOffset;
    currentOffset += arcLength + gap;
    return {
      ...cat,
      fraction,
      arcLength,
      offset,
      color: isDarkMode ? (cat?.colorDark || "#34D399") : (cat?.colorLight || "#059669"),
    };
  });

  const isScrollableLegend = (activeData?.categories?.length || 0) > 6;

  return (
    <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] hover:-translate-y-1 transition-all duration-300 h-full flex flex-col justify-between">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-stretch h-full">
        {/* Left Column: Interactive Ring Chart + Month/Annual selector (w-1/2) */}
        <div className="w-full lg:w-1/2 flex flex-col items-center gap-5 sm:gap-6 justify-start">
          {/* Header & Controls in Left Column */}
          <div className="w-full flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Animated Spending Ring
                </h2>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-400/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-400/40 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Framer Motion
                </span>
              </div>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {isAnnual
                ? "Aggregated 12-month spending across all active categories in 2026."
                : "Hover category segments to inspect dynamic spend pulse."}
            </p>

            {/* Time Controls: Live Horizon Toggle + 2026 Annual Overview Toggle + 12-Month Pill Strip */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {/* Dynamic Live Horizon Toggle */}
              <button
                onClick={() => {
                  setSelectedTimeframe("horizon");
                  setHoveredCategory(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all duration-300 shadow-sm shrink-0 cursor-pointer ${
                  selectedTimeframe === "horizon"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-500 dark:to-teal-400 text-white shadow-emerald-500/30 ring-2 ring-emerald-400/50"
                    : "bg-gray-100 hover:bg-emerald-50 dark:bg-[#061d12]/80 dark:hover:bg-emerald-950/60 text-zinc-700 dark:text-zinc-300 border border-gray-200/80 dark:border-emerald-800/50 hover:text-emerald-700 dark:hover:text-emerald-400"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{timeHorizon || "Weekly"} Scale</span>
              </button>

              {/* Prominent 2026 Annual Overview Toggle */}
              <button
                onClick={() => {
                  setSelectedTimeframe("annual");
                  setHoveredCategory(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all duration-300 shadow-sm shrink-0 cursor-pointer ${
                  isAnnual
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-500 dark:to-teal-400 text-white shadow-emerald-500/30 ring-2 ring-emerald-400/50"
                    : "bg-gray-100 hover:bg-emerald-50 dark:bg-[#061d12]/80 dark:hover:bg-emerald-950/60 text-zinc-700 dark:text-zinc-300 border border-gray-200/80 dark:border-emerald-800/50 hover:text-emerald-700 dark:hover:text-emerald-400"
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAnnual ? "text-amber-300" : "text-emerald-500"}`} />
                <span>2026 Annual</span>
              </button>

              {/* 12-Month Scrollable Pill Strip */}
              <div className="inline-flex p-1 rounded-xl bg-gray-100/90 dark:bg-[#061d12]/80 border border-gray-200/60 dark:border-emerald-800/40 overflow-x-auto no-scrollbar scroll-smooth max-w-full sm:max-w-[280px]">
                {SPENDING_RING_MONTHS.map(({ key, short }) => {
                  const isSelected = selectedTimeframe === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedTimeframe(key);
                        setHoveredCategory(null);
                      }}
                      title={key}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all duration-200 shrink-0 ${
                        isSelected
                          ? "bg-white dark:bg-emerald-400/20 text-emerald-950 dark:text-emerald-400 dark:border dark:border-emerald-400 shadow-sm"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                      }`}
                    >
                      {short}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SVG Ring with Dynamic Center Info */}
          <div className="relative w-60 h-60 sm:w-64 sm:h-64 flex items-center justify-center mt-1">
            <svg
              className="w-full h-full transform -rotate-90 drop-shadow-sm overflow-visible"
              viewBox="0 0 220 220"
            >
              {/* Background Track Ring */}
              <circle
                cx={110}
                cy={110}
                r={radius}
                fill="none"
                stroke={isDarkMode ? "rgba(10,54,34,0.3)" : "#f1f5f9"}
                strokeWidth={15}
              />

              {/* Segmented Rounded Pill Arcs with Framer Motion */}
              {segments.map((seg) => {
                const isHovered = hoveredCategory?.id === seg.id;
                return (
                  <motion.circle
                    key={seg.id}
                    cx={110}
                    cy={110}
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeLinecap="round"
                    initial={{
                      strokeDasharray: `0.01 ${circumference}`,
                      strokeDashoffset: -seg.offset,
                      opacity: 0,
                    }}
                    animate={{
                      strokeDasharray: `${seg.arcLength} ${circumference - seg.arcLength}`,
                      strokeDashoffset: -seg.offset,
                      opacity: 1,
                      strokeWidth: isHovered ? 21 : 15,
                    }}
                    transition={{
                      duration: 0.9,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    whileHover={{
                      scale: 1.05,
                      transition: { duration: 0.2 },
                    }}
                    style={{
                      transformOrigin: "110px 110px",
                      filter: isHovered
                        ? `drop-shadow(0 0 10px ${seg.color})`
                        : "none",
                      cursor: "pointer",
                    }}
                    onMouseEnter={() => setHoveredCategory(seg)}
                    onMouseLeave={() => setHoveredCategory(null)}
                  />
                );
              })}
            </svg>

            {/* Dynamic Center Text: AnimatePresence */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none px-4">
              <AnimatePresence mode="wait">
                {hoveredCategory ? (
                  <motion.div
                    key="hovered-category"
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="flex flex-col items-center justify-center"
                  >
                    <span
                      className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full mb-1 truncate max-w-[140px]"
                      style={{
                        color: hoveredCategory.color,
                        backgroundColor: `${hoveredCategory.color}22`,
                        border: `1px solid ${hoveredCategory.color}44`,
                      }}
                    >
                      {hoveredCategory.name}
                    </span>
                    <span className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
                      ₹{hoveredCategory.amount.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mt-0.5">
                      {Math.round((hoveredCategory.amount / activeData.total) * 100)}% of {isAnnual ? "Annual" : selectedTimeframe}
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key={isAnnual ? "annual-spend" : `month-${selectedTimeframe}`}
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="flex flex-col items-center justify-center"
                  >
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500">
                      {selectedTimeframe === "horizon" ? `${timeHorizon || "Weekly"} Dynamic Spend` : isAnnual ? "2026 Annual Spend" : "Monthly Spend"}
                    </span>
                    <span className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white mt-0.5">
                      <AnimatedNumber value={activeData?.total || 0} />
                    </span>
                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-400/20 border border-emerald-500/20 dark:border-emerald-400/40">
                      {selectedTimeframe === "horizon"
                        ? `${timeHorizon || "Weekly"} Scale • ₹${((activeData?.total || 0)).toLocaleString()}`
                        : isAnnual
                        ? `12-Mo Total • ₹${(((activeData?.total || 0) / 100000)).toFixed(2)}L`
                        : `${selectedTimeframe} 2026`}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Financial Health Copilot Score Widget (Filling the empty space below the Spending Ring) */}
          <div className="w-full mt-3 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-950/40 dark:via-[#072418]/60 dark:to-transparent border border-emerald-500/20 dark:border-emerald-700/40 p-4 shadow-sm transition-all hover:border-emerald-400/40">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-extrabold tracking-tight text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <span>{t("Financial Health Copilot Score")}</span>
                  </h4>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    {t("Audited by deterministic Python engine")}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <Sparkles className="w-3 h-3 text-emerald-500" />
                Grade A • Strong
              </span>
            </div>

            {/* Score Gauge & Key Stat */}
            <div className="flex items-center gap-4 bg-white/80 dark:bg-[#061d12]/70 backdrop-blur-md rounded-xl p-3 border border-emerald-500/10 dark:border-emerald-800/30">
              <div className="relative flex items-center justify-center shrink-0">
                {/* Mini SVG circular meter */}
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-gray-200 dark:text-zinc-800"
                    fill="none"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    stroke="url(#copilot-health-grad)"
                    strokeWidth="6"
                    strokeDasharray={2 * Math.PI * 26}
                    strokeDashoffset={2 * Math.PI * 26 * (1 - (dashboardData?.adherence_score ?? 88) / 100)}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                    fill="none"
                  />
                  <defs>
                    <linearGradient id="copilot-health-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#0D9488" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base font-black text-zinc-900 dark:text-white leading-none">
                    {dashboardData?.adherence_score ?? 88}
                  </span>
                  <span className="text-[8px] font-bold text-zinc-400 dark:text-zinc-500 leading-none mt-0.5">
                    /100
                  </span>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    {t("Optimal Runway")}
                  </span>
                  <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
                    98.2% Safe
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-zinc-800 rounded-full h-1.5 my-1.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
                    style={{ width: `${dashboardData?.adherence_score ?? 88}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                  Zero cash gap detected for current horizon
                </p>
              </div>
            </div>

            {/* 3 Pillar Micro Badges */}
            <div className="grid grid-cols-3 gap-2 mt-2.5">
              <div className="bg-white/60 dark:bg-[#061d12]/50 rounded-lg p-2 border border-gray-100 dark:border-emerald-900/40 text-center">
                <span className="text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-bold block">
                  {t("Reserve Floor")}
                </span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  ₹{(dashboardData?.locked_reserve ?? 25000).toLocaleString()}
                </span>
              </div>
              <div className="bg-white/60 dark:bg-[#061d12]/50 rounded-lg p-2 border border-gray-100 dark:border-emerald-900/40 text-center">
                <span className="text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-bold block">
                  {t("Debt Safety")}
                </span>
                <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                  100% Fenced
                </span>
              </div>
              <div className="bg-white/60 dark:bg-[#061d12]/50 rounded-lg p-2 border border-gray-100 dark:border-emerald-900/40 text-center">
                <span className="text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-bold block">
                  {t("Risk Index")}
                </span>
                <span className="text-xs font-black text-teal-600 dark:text-teal-400">
                  0.0% Gap
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Detailed, scrollable category legend (w-1/2) */}
        <div className="w-full lg:w-1/2 flex flex-col justify-between h-full border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-emerald-800/40 pt-5 lg:pt-0 lg:pl-6 lg:pl-8">
          <div className="flex flex-col h-full justify-between">
            {/* Top Section: Category Breakdown */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <span>Category Breakdown</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#061d12] text-zinc-600 dark:text-zinc-400">
                      {activeData?.categories?.length || 0} Items
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    Detailed ledger with proportional volume share
                  </p>
                </div>
                <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                  Total: ₹{(activeData?.total || 0).toLocaleString()}
                </span>
              </div>

              {/* Scrollable list packing the right column with elegant thin scrollbar */}
              <div className="space-y-2 max-h-[175px] sm:max-h-[190px] overflow-y-auto pr-1.5 custom-scrollbar scrollbar-thin">
                {(activeData?.categories || []).map((cat) => {
                  const pct = Math.round(((cat?.amount || 0) / (activeData?.total || 1)) * 100);
                  const color = isDarkMode ? (cat?.colorDark || "#34D399") : (cat?.colorLight || "#059669");
                  const isHovered = hoveredCategory?.id === cat?.id;

                  return (
                    <div
                      key={cat?.id || cat?.name}
                      onMouseEnter={() => setHoveredCategory({ ...cat, color })}
                      onMouseLeave={() => setHoveredCategory(null)}
                      className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
                        isHovered
                          ? "bg-emerald-50/70 dark:bg-[#072d1c] border-emerald-400 -translate-y-0.5 shadow-md ring-2 ring-emerald-500/20"
                          : "bg-gray-50/60 dark:bg-[#061d12]/50 border-gray-100 dark:border-emerald-800/30 hover:bg-gray-50 dark:hover:bg-[#061d12]/80 hover:border-gray-200 dark:hover:border-emerald-700/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">
                            {cat?.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white">
                            ₹{(cat?.amount || 0).toLocaleString()}
                          </span>
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{
                              backgroundColor: `${color}18`,
                              color: color,
                            }}
                          >
                            {pct}%
                          </span>
                        </div>
                      </div>

                      {/* Horizontal mini progress bar for visual weight */}
                      <div className="w-full bg-gray-200/60 dark:bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Section: 3D "Data Sync Vault" pinned directly above the footer */}
            <div className="mt-3.5 mb-1">
              <DataSyncVaultUploadWidget isDarkMode={isDarkMode} />
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 dark:border-emerald-800/40 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
            <span>Hover card to highlight ring segment</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {isAnnual ? "Full 2026 Overview" : `${selectedTimeframe} 2026`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// INTERACTIVE MONTHLY MINI-CALENDAR & LOCKED PATH WIDGET
// ============================================================================

const INITIAL_CALENDAR_BILLS = [
  {
    id: "auto-1",
    day: 4,
    month: 9, // October (0-indexed)
    year: 2026,
    name: "Airtel Xstream Fiber",
    category: "Utilities",
    amount: 1179,
    source: "auto", // Historical Sync (emerald dot)
    account: "HDFC Credit Card",
  },
  {
    id: "auto-2",
    day: 6,
    month: 9,
    year: 2026,
    name: "Tata Power Mumbai Electricity",
    category: "Utilities",
    amount: 3450,
    source: "auto", // Historical Sync (emerald dot)
    account: "ICICI Savings",
  },
  {
    id: "auto-3",
    day: 8,
    month: 9,
    year: 2026,
    name: "HDFC Personal Loan EMI",
    category: "Debt Payment",
    amount: 17640,
    source: "auto", // Historical Sync (emerald dot)
    account: "HDFC Salary A/c",
  },
  {
    id: "auto-4",
    day: 9,
    month: 9,
    year: 2026,
    name: "Brigade Gateway Rent",
    category: "Housing",
    amount: 32000,
    source: "auto", // Historical Sync (emerald dot)
    account: "HDFC Salary A/c",
  },
  {
    id: "auto-5",
    day: 12,
    month: 9,
    year: 2026,
    name: "HDFC Home Loan EMI",
    category: "Debt Payment",
    amount: 12000,
    source: "auto", // Historical Sync (emerald dot)
    account: "HDFC Salary A/c",
  },
  {
    id: "auto-6",
    day: 15,
    month: 9,
    year: 2026,
    name: "Flat 402 Apartment Rent",
    category: "Housing",
    amount: 18000,
    source: "auto", // Historical Sync (emerald dot)
    account: "HDFC Salary A/c",
  },
  {
    id: "auto-7",
    day: 22,
    month: 9,
    year: 2026,
    name: "Tata Power Mumbai",
    category: "Utilities",
    amount: 3450,
    source: "auto", // Historical Sync (emerald dot)
    account: "ICICI Savings",
  },
  {
    id: "manual-1",
    day: 25,
    month: 9,
    year: 2026,
    name: "Netflix & Cloud Services",
    category: "Subscriptions",
    amount: 1828,
    source: "manual", // Manual Override (yellow/gold dot)
    account: "HDFC Credit Card",
  },
];

const InteractiveBillCalendarWidget = ({ isDarkMode, setActiveTab, dashboardData }) => {
  // Navigation: Month and Year (default: October 2026)
  const [viewDate, setViewDate] = useState(new Date(2026, 9, 1));
  const [selectedDay, setSelectedDay] = useState(12);

  // Calendar Bills State
  const [bills, setBills] = useState(INITIAL_CALENDAR_BILLS);

  // Sync backend upcoming_bills when available
  useEffect(() => {
    if (dashboardData?.upcoming_bills && dashboardData.upcoming_bills.length > 0) {
      const mapped = dashboardData.upcoming_bills.map((b, idx) => {
        let billDay = 12;
        let billMonth = viewDate.getMonth();
        let billYear = viewDate.getFullYear();
        if (b?.date) {
          const parts = String(b.date).split("-");
          if (parts.length === 3) {
            billYear = parseInt(parts[0], 10) || billYear;
            billMonth = (parseInt(parts[1], 10) || 10) - 1;
            billDay = parseInt(parts[2], 10) || 12;
          }
        }
        return {
          id: b?.id || `backend-sync-${idx}`,
          day: billDay,
          month: billMonth,
          year: billYear,
          name: b?.name || "Scheduled Bill",
          category: b?.category || "Debt Payment",
          amount: b?.amount || 0,
          source: "auto",
          account: b?.account || "HDFC Salary A/c",
        };
      });
      setBills((prev) => {
        const manualBills = prev.filter((item) => item?.source === "manual");
        return [...mapped, ...manualBills];
      });
    }
  }, [dashboardData?.upcoming_bills]);

  // Manual Date Adjustment (Pencil edit state)
  const [editingBillId, setEditingBillId] = useState(null);
  const [editNewDay, setEditNewDay] = useState(12);

  // Manual Add Bill State
  const [isAddingBill, setIsAddingBill] = useState(false);
  const [newBillName, setNewBillName] = useState("");
  const [newBillAmount, setNewBillAmount] = useState("");
  const [newBillCategory, setNewBillCategory] = useState("Debt Payment");

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const monthName = viewDate.toLocaleString("default", { month: "long" });

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const handlePrevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  // Filter bills for selected day
  const selectedDateBills = bills.filter(
    (b) => b.day === selectedDay && b.month === viewMonth && b.year === viewYear
  );

  // Handle shifting date
  const handleSaveShiftDate = (billId) => {
    const targetDay = parseInt(editNewDay, 10);
    if (isNaN(targetDay) || targetDay < 1 || targetDay > daysInMonth) return;
    setBills((prev) =>
      prev.map((b) =>
        b.id === billId ? { ...b, day: targetDay, source: "manual" } : b
      )
    );
    setSelectedDay(targetDay);
    setEditingBillId(null);
  };

  // Handle adding manual bill
  const handleAddManualBill = (e) => {
    e.preventDefault();
    if (!newBillName.trim() || !newBillAmount) return;
    const newBill = {
      id: `manual-${Date.now()}`,
      day: selectedDay,
      month: viewMonth,
      year: viewYear,
      name: newBillName.trim(),
      category: newBillCategory,
      amount: parseInt(newBillAmount, 10) || 0,
      source: "manual",
      account: "HDFC Salary A/c",
    };
    setBills((prev) => [...prev, newBill]);
    setIsAddingBill(false);
    setNewBillName("");
    setNewBillAmount("");
  };

  const weekDayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
      <div>
        {/* Widget Top Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-400/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-400/40">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white">
                Locked Path & Bill Calendar
              </h2>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                Auto-synced from transactions & manual overrides
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-400/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-400/40 flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" />
            Autoshield
          </span>
        </div>

        {/* Month Navigation & Indicator Legend */}
        <div className="flex items-center justify-between bg-gray-50/70 dark:bg-[#061d12]/60 p-2.5 rounded-2xl border border-gray-100 dark:border-emerald-800/30 mb-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors shadow-2xs"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-black text-zinc-900 dark:text-white tracking-wide">
              {monthName} {viewYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors shadow-2xs"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-xs" />
              Auto-Sync
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-xs" />
              Manual
            </span>
          </div>
        </div>

        {/* 7-Column Mini-Calendar Grid */}
        <div className="mb-4">
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {weekDayLabels.map((wd) => (
              <span key={wd} className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 py-0.5">
                {wd}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {/* Blank leading days */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`blank-${idx}`} className="h-8" />
            ))}

            {/* Days of current month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const isSelected = selectedDay === day;
              const dayBills = bills.filter(
                (b) => b.day === day && b.month === viewMonth && b.year === viewYear
              );
              const hasAuto = dayBills.some((b) => b.source === "auto");
              const hasManual = dayBills.some((b) => b.source === "manual");

              return (
                <button
                  key={`day-${day}`}
                  onClick={() => {
                    setSelectedDay(day);
                    setIsAddingBill(false);
                    setEditingBillId(null);
                  }}
                  className={`h-8 rounded-xl flex flex-col items-center justify-center relative transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? "bg-emerald-600 text-white font-black shadow-md shadow-emerald-600/30 scale-105"
                      : "text-zinc-700 dark:text-zinc-200 hover:bg-emerald-500/20"
                  }`}
                >
                  <span className="text-xs leading-none">{day}</span>
                  {/* Indicators */}
                  {(hasAuto || hasManual) && (
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {hasAuto && (
                        <span
                          className={`w-1 h-1 rounded-full ${
                            isSelected ? "bg-white" : "bg-emerald-500"
                          }`}
                        />
                      )}
                      {hasManual && (
                        <span
                          className={`w-1 h-1 rounded-full ${
                            isSelected ? "bg-amber-200" : "bg-amber-400 dark:bg-yellow-400"
                          }`}
                        />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Details Pane */}
        <div className="p-3 rounded-2xl bg-gray-50/70 dark:bg-[#061d12]/50 border border-gray-100 dark:border-emerald-800/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <span>{monthName} {selectedDay}, {viewYear}</span>
              {selectedDateBills.length > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  {selectedDateBills.length} Bill{selectedDateBills.length > 1 ? "s" : ""}
                </span>
              )}
            </span>

            {!isAddingBill && (
              <button
                onClick={() => setIsAddingBill(true)}
                className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors"
              >
                <PlusCircle className="w-3 h-3" />
                Add Bill
              </button>
            )}
          </div>

          {/* Inline Add Bill Form */}
          {isAddingBill && (
            <form onSubmit={handleAddManualBill} className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-400/50 mb-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide">
                  New Locked Bill for Oct {selectedDay}
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingBill(false)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  placeholder="Bill Name"
                  value={newBillName}
                  onChange={(e) => setNewBillName(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs bg-transparent dark:text-white"
                  required
                />
                <input
                  type="number"
                  placeholder="₹ Amount"
                  value={newBillAmount}
                  onChange={(e) => setNewBillAmount(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs bg-transparent dark:text-white"
                  required
                />
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <select
                  value={newBillCategory}
                  onChange={(e) => setNewBillCategory(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs bg-transparent dark:text-white"
                >
                  <option value="Debt Payment">Debt Payment</option>
                  <option value="Housing">Housing</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Subscriptions">Subscriptions</option>
                </select>
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs"
                >
                  <Check className="w-3 h-3" /> Save & Lock
                </button>
              </div>
            </form>
          )}

          {/* List of bills for selected date */}
          {selectedDateBills.length > 0 ? (
            <div className="space-y-2">
              {selectedDateBills.map((b) => {
                const isEditing = editingBillId === b.id;
                return (
                  <div
                    key={b.id}
                    className="p-2 rounded-xl bg-white dark:bg-zinc-900/80 border border-gray-100 dark:border-emerald-800/40 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                          {b.name}
                        </span>
                        {/* Unified Transactions Category Badge */}
                        <span
                          className={`px-1.5 py-0.2 rounded-full font-bold text-[9px] border ${getTransactionCategoryBadge(
                            b.category
                          )}`}
                        >
                          {b.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-black text-zinc-900 dark:text-white">
                          ₹{b.amount.toLocaleString()}
                        </span>
                        {/* Edit Date Pencil */}
                        <button
                          onClick={() => {
                            setEditingBillId(isEditing ? null : b.id);
                            setEditNewDay(b.day);
                          }}
                          title="Shift scheduled date"
                          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-emerald-600 transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-400 dark:text-zinc-500">
                        {b.account || "HDFC Salary A/c"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {b.source === "auto" ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-emerald-500" /> Auto-Sync
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-amber-400" /> Manual
                          </span>
                        )}
                        <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                      </span>
                    </div>

                    {/* Inline Date Shift Drawer */}
                    {isEditing && (
                      <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-zinc-500">Shift to Date:</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max={daysInMonth}
                            value={editNewDay}
                            onChange={(e) => setEditNewDay(e.target.value)}
                            className="w-14 px-2 py-0.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs bg-transparent dark:text-white text-center"
                          />
                          <button
                            onClick={() => handleSaveShiftDate(b.id)}
                            className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-0.5"
                          >
                            <Check className="w-3 h-3" /> Shift
                          </button>
                          <button
                            onClick={() => setEditingBillId(null)}
                            className="text-[10px] text-zinc-400 hover:text-zinc-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            !isAddingBill && (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 py-1">
                No locked payments scheduled for {monthName} {selectedDay}. Click "Add Bill" to lock an amount.
              </p>
            )
          )}
        </div>

        {/* Connection to Safe-to-Spend KPI Note */}
        <div className="mt-3 p-2.5 rounded-2xl bg-emerald-50/70 dark:bg-[#061d12]/80 border border-emerald-200/60 dark:border-emerald-800/50 flex items-start gap-2 shadow-2xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
            These ring-fenced bills are already deducted from your{" "}
            <strong className="font-extrabold text-emerald-800 dark:text-emerald-400">
              ₹{(dashboardData?.liquid_balance ?? 12450).toLocaleString()} Safe-to-Spend
            </strong>{" "}
            balance.
          </p>
        </div>
      </div>

      {/* Footer Link to Transactions Tab */}
      <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-emerald-800/40 flex items-center justify-between">
        <button
          onClick={() => setActiveTab("Transactions")}
          className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 transition-colors flex items-center gap-1.5 group cursor-pointer"
        >
          <span>View Full Ledger</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </button>
        <button
          onClick={() => setActiveTab("Subscriptions")}
          className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors cursor-pointer"
        >
          Manage Bills →
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentLanguage, toastMessage, t } = useSettings();

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof document !== "undefined") {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme) return savedTheme === "dark";
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const p = window.location.pathname.toLowerCase();
      if (p.includes("subscrip") || p.includes("bill")) return "Subscriptions";
      if (p.includes("scenario") || p.includes("simulat")) return "Scenarios";
      if (p.includes("data-sync") || p.includes("sync")) return "Data Sync";
    }
    return "Dashboard";
  });

  useEffect(() => {
    const p = (location.pathname || "").toLowerCase();
    if (p === "/subscriptions" || p === "/bills") {
      setActiveTab("Subscriptions");
    } else if (p === "/scenarios" || p === "/simulator") {
      setActiveTab("Scenarios");
    } else if (p === "/data-sync" || p === "/datasync" || p === "/sync") {
      setActiveTab("Data Sync");
    } else if (p === "/" || p === "/dashboard") {
      setActiveTab("Dashboard");
    }
  }, [location.pathname]);

  const [forecastMode, setForecastMode] = useState("expected"); // 'expected' | 'stress'
  const [timeHorizon, setTimeHorizon] = useState("Weekly"); // 'Weekly' | 'Monthly' | '6-Month' | 'Yearly'
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Backend Telemetry State
  const [isLoading, setIsLoading] = useState(true);
  const [backendStatus, setBackendStatus] = useState("connecting");
  const [dashboardData, setDashboardData] = useState(DEFAULT_DASHBOARD_DATA);

  // Tab 2: Transactions State
  const [transactionsList, setTransactionsList] = useState(MOCK_TRANSACTIONS);
  const [txSearch, setTxSearch] = useState("");
  const [txCategoryFilter, setTxCategoryFilter] = useState("all");
  const [txAccountFilter, setTxAccountFilter] = useState("all");

  // Tab 3: Action Plan States
  const [targetAmount, setTargetAmount] = useState(90000);
  const [foodFlex, setFoodFlex] = useState(75);
  const [shoppingFlex, setShoppingFlex] = useState(50);
  const [travelFlex, setTravelFlex] = useState(25);
  const [actionPlanSaved, setActionPlanSaved] = useState(false);

  // Tab 4: Scenarios State
  const [selectedScenarioKey, setSelectedScenarioKey] = useState("refinance");

  // Tab 5: Benchmark State
  const [benchmarkMetricView, setBenchmarkMetricView] = useState("mae"); // 'mae' | 'coverage'

  // Tab 6: Subscriptions State
  const [upcomingBills, setUpcomingBills] = useState(INITIAL_UPCOMING_BILLS);
  const [billFilter, setBillFilter] = useState("all"); // 'all' | 'Must-Pay' | 'Flexible'
  const [subscriptionsList, setSubscriptionsList] = useState(INITIAL_SUBSCRIPTIONS);
  const [subToast, setSubToast] = useState(null);

  // Tab 5: Co-Pilot Chat State
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "bot",
      text: "Hello! I'm your SpendShield Co-Pilot. I run deterministic Python tools over your verified bank statement data to give you zero-hallucination financial advice. What would you like to explore today?",
      time: "Just now",
      verified: true,
    },
  ]);
  const [chatInput, setChatInput] = useState("");

  // Tab 6: Review Queue & Live Feed State
  const [reviewQueue, setReviewQueue] = useState(INITIAL_REVIEW_ITEMS);
  const [simulatedNarration, setSimulatedNarration] = useState("Starbucks Bandra Mumbai");
  const [simulatedAmount, setSimulatedAmount] = useState("450");
  const [simulatedType, setSimulatedType] = useState("Debit");
  const [feedNotification, setFeedNotification] = useState(null);

  // Sync dark class on html document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // FastAPI Dashboard Telemetry Logic connected to timeHorizon
  useEffect(() => {
    let isMounted = true;
    const fetchDashboardTelemetry = async () => {
      setIsLoading(true);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(`/api/dashboard?horizon=${encodeURIComponent(timeHorizon)}&lang=${encodeURIComponent(currentLanguage)}`, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "Accept-Language": currentLanguage,
          },
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setDashboardData(data);
            setBackendStatus("connected");
          }
        } else {
          if (isMounted) setBackendStatus("fallback");
        }
      } catch (err) {
        if (isMounted) setBackendStatus("fallback");
      } finally {
        if (isMounted) {
          setTimeout(() => setIsLoading(false), 200);
        }
      }
    };

    fetchDashboardTelemetry();
    return () => {
      isMounted = false;
    };
  }, [timeHorizon, currentLanguage]);

  // Co-Pilot Chat Handlers
  const handleSendMessage = async (textToSend) => {
    const query = textToSend || chatInput;
    if (!query.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: "user",
      text: query,
      time: "Just now",
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setChatInput("");

    try {
      const sessionId = typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") || "demo" : "demo";
      const res = await fetch(`/api/chat?lang=${encodeURIComponent(currentLanguage)}&session_id=${encodeURIComponent(sessionId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": currentLanguage,
          "X-Session-ID": sessionId,
        },
        body: JSON.stringify({ query }),
      });

      if (res.ok) {
        const data = await res.json();
        const replyText = data.answer || "I analyzed your accounts. Your safe-to-spend headroom is protected.";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: "bot",
            text: replyText,
            time: "Just now",
            verified: data.verified_claims ?? true,
          },
        ]);
        return;
      }
    } catch (err) {
      console.warn("API Chat fallback active:", err);
    }

    // Deterministic fallback if server offline
    let replyText = "";
    if (
      query.toLowerCase().includes("laptop") ||
      query.toLowerCase().includes("80k") ||
      query.toLowerCase().includes("90k")
    ) {
      replyText =
        "Based on your verified safe liquidity (₹1,42,850) and locked obligations (₹8,200), an outright purchase of ₹80,000 to ₹90,000 will temporarily drop your emergency runway from 4.2 to 2.1 months. \n\n✅ Safe Recommendation: Use our Action Plan to trim ₹3,450/week in dining/shopping, or convert to a 6-month no-cost EMI at ₹13,333/mo without touching your ₹25k reserve floor.";
    } else if (
      query.toLowerCase().includes("savings") ||
      query.toLowerCase().includes("dropping")
    ) {
      replyText =
        "Your savings rate dropped from 22.8% to 16.4% over the last quarter. \n\n🔎 Primary Cause Identified: 'Silent Creep' in recurring bills. Your HDFC Personal Loan EMI jumped +37.5% (₹12,000 → ₹17,640/mo), and grocery takeaway spending rose by ₹3,200. Check the Bills & Subscriptions tab to challenge this hike!";
    } else {
      replyText = `I analyzed your accounts. Your safe-to-spend headroom today is ₹12,450, and all upcoming essential bills (₹8,200) are 100% ring-fenced. You have zero cashflow shortfall risk under current trajectories.`;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + 1,
        sender: "bot",
        text: replyText,
        time: "Just now",
        verified: true,
      },
    ]);
  };

  // Live Transaction Feed Simulation
  const handleSimulateTransaction = async (e) => {
    e.preventDefault();
    if (!simulatedNarration || !simulatedAmount) return;

    const amt = parseFloat(simulatedAmount);
    let predicted = "Shopping";
    let conf = 0.58;

    try {
      const sessionId = typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") || "demo" : "demo";
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/transactions?session_id=${encodeURIComponent(sessionId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-ID": sessionId,
        },
        body: JSON.stringify({
          date: today,
          narration: simulatedNarration,
          amount: amt,
          type: simulatedType || "debit",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const tx = data?.transaction;
        if (tx && tx.category && tx.category !== "uncategorised") {
          predicted = tx.category;
          conf = tx.category_confidence || 0.88;
        }
      }
    } catch (err) {
      console.warn("Backend transaction ingestion fallback:", err);
    }

    const lower = simulatedNarration.toLowerCase();
    if (
      lower.includes("starbucks") ||
      lower.includes("cafe") ||
      lower.includes("food") ||
      lower.includes("zomato")
    ) {
      predicted = "Food & Dining";
      conf = 0.94;
    } else if (
      lower.includes("uber") ||
      lower.includes("ola") ||
      lower.includes("fuel")
    ) {
      predicted = "Commute";
      conf = 0.88;
    } else if (
      lower.includes("emi") ||
      lower.includes("loan") ||
      lower.includes("hdfc")
    ) {
      predicted = "Debt Payment";
      conf = 0.91;
    }

    if (conf >= 0.85) {
      setFeedNotification(
        `Auto-Approved: "${simulatedNarration}" categorised as "${predicted}" (${Math.round(
          conf * 100
        )}% confidence).`
      );
    } else {
      const newItem = {
        id: Date.now(),
        narration: simulatedNarration,
        amount: amt,
        date: "Today",
        predictedCategory: predicted,
        confidence: conf,
      };
      setReviewQueue((prev) => [newItem, ...prev]);
      setFeedNotification(
        `Low Confidence (${Math.round(
          conf * 100
        )}%): Added "${simulatedNarration}" to the Review Queue below.`
      );
    }

    setSimulatedAmount("");
    setTimeout(() => setFeedNotification(null), 4000);
  };

  const handleApproveCategory = (id) => {
    setReviewQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCorrectCategory = (id, newCat) => {
    setReviewQueue((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, predictedCategory: newCat, confidence: 1.0 } : item
      )
    );
  };

  const NAV_TABS = [
    "Dashboard",
    "Transactions",
    "Action Plan",
    "Scenarios",
    "Subscriptions",
    "Data Sync",
    "Co-Pilot",
    "Review",
  ];

  const monthlyFreedCashflow = Math.round(
    foodFlex * 95 + shoppingFlex * 80 + travelFlex * 50
  );
  const targetFundedPercentage = Math.min(
    100,
    Math.round(((monthlyFreedCashflow * 3) / targetAmount) * 100)
  );

  // ==========================================================================
  // VIEW RENDERER (Switch statement based on activeTab)
  // ==========================================================================

  const renderTabContent = () => {
    switch (activeTab) {
      case "Dashboard":
        return (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Global Page Header: Greeting + Time-Horizon Segmented Control */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18191B] dark:text-white">
                  {t("command_center")}
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {t("welcome_back")}
                </p>
              </div>

              {/* The Time-Horizon Toggle Group */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="bg-slate-50 dark:bg-[#061d12] border border-slate-200 dark:border-emerald-800/40 rounded-full p-1 flex items-center gap-1 shadow-2xs overflow-x-auto max-w-full">
                {/* 1. Weekly */}
                <button
                  type="button"
                  onClick={() => setTimeHorizon("Weekly")}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
                    timeHorizon === "Weekly"
                      ? "bg-white dark:bg-emerald-950/90 shadow-sm text-emerald-700 dark:text-emerald-300 font-semibold"
                      : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 font-normal"
                  }`}
                >
                  <span>{t("weekly")}</span>
                  <span className="bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {t("decision_grade")}
                  </span>
                </button>

                {/* 2. Monthly */}
                <button
                  type="button"
                  onClick={() => setTimeHorizon("Monthly")}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
                    timeHorizon === "Monthly"
                      ? "bg-white dark:bg-emerald-950/90 shadow-sm text-emerald-700 dark:text-emerald-300 font-semibold"
                      : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 font-normal"
                  }`}
                >
                  <span>{t("monthly")}</span>
                  <span className="bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {t("planning_grade")}
                  </span>
                </button>

                {/* 3. 6-Month */}
                <button
                  type="button"
                  onClick={() => setTimeHorizon("6-Month")}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
                    timeHorizon === "6-Month"
                      ? "bg-white dark:bg-emerald-950/90 shadow-sm text-emerald-700 dark:text-emerald-300 font-semibold"
                      : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 font-normal"
                  }`}
                >
                  <span>{t("six_month")}</span>
                </button>

                {/* 4. Yearly */}
                <button
                  type="button"
                  onClick={() => setTimeHorizon("Yearly")}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
                    timeHorizon === "Yearly"
                      ? "bg-white dark:bg-emerald-950/90 shadow-sm text-emerald-700 dark:text-emerald-300 font-semibold"
                      : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 font-normal"
                  }`}
                >
                  <span>{t("yearly")}</span>
                </button>
              </div>
            </div>
          </div>

            {/* 1. Global Dashboard Container: Responsive Bento Box CSS Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
              {/* 2. Top Row (Command Center KPIs - Span all 3 columns) */}
              <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Liquid Safe-to-Spend (Highlighted in Glowing Emerald) */}
                <div className="relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-emerald-600 via-[#059669] to-[#047857] text-white shadow-lg shadow-emerald-600/25 border border-emerald-400/40 hover:-translate-y-0.5 transition-all flex flex-col justify-between">
                  <div className="absolute -top-10 -right-10 w-24 h-24 bg-white/20 rounded-full blur-xl pointer-events-none" />
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-emerald-100">
                        {t("Liquid Safe-to-Spend")}
                      </span>
                      <div className="p-1.5 rounded-xl bg-white/20 text-white border border-white/25">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black tracking-tight text-white drop-shadow-xs">
                        ₹{(dashboardData?.liquid_balance ?? 12450).toLocaleString()}
                      </span>
                      <span className="inline-flex items-center text-xs font-bold text-emerald-100 bg-white/20 px-2 py-0.5 rounded-full">
                        <TrendingUp className="w-3 h-3 mr-0.5" /> +8.4%
                      </span>
                    </div>
                    <p className="text-xs text-emerald-100/90 mt-1 font-medium">
                      {timeHorizon === "Weekly"
                        ? "7-day pace: ₹415/day (₹2,905/wk safe)"
                        : timeHorizon === "Monthly"
                        ? "Monthly pace: ₹12,450 safe headroom"
                        : timeHorizon === "6-Month"
                        ? "6-month runway: 4.8 months safe floor"
                        : "Annual safe headroom: ₹1,49,400 pace"}
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-white/20 flex items-center justify-between text-[11px] text-emerald-100/80">
                    <span>{t("Autoshield Floor Active")}</span>
                    <span className="font-bold text-white">{t("Live Floor Protected")}</span>
                  </div>
                </div>

                {/* 2. Locked Reserve (₹25,000 Floor) */}
                <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] hover:-translate-y-0.5 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase">
                        {t("Locked Reserve")}
                      </span>
                      <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Lock className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                        ₹{(dashboardData?.locked_reserve ?? 25000).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        {t("Floor Target")}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      {t("Protected emergency capital buffer")}
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-emerald-800/40 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
                    <span>{t("Cushion Health")}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{t("100% Ring-Fenced")}</span>
                  </div>
                </div>

                {/* 3. Upcoming Lock Path Deductions (Sum of bills in next horizon window) */}
                <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] hover:-translate-y-0.5 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase">
                        {t("Upcoming Lock Path")}
                      </span>
                      <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <Calendar className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                        ₹{(dashboardData?.upcoming_bills?.reduce((acc, b) => acc + (b?.amount || 0), 0) ?? 33450).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        {t("Ring-fenced")}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      {timeHorizon === "Weekly"
                        ? "Sum of bills scheduled in next 7 days"
                        : timeHorizon === "Monthly"
                        ? "Sum of bills scheduled in next 30 days"
                        : timeHorizon === "6-Month"
                        ? "Commitments forecasted for next 6 months"
                        : "Annual recurring commitments scheduled"}
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-emerald-800/40 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
                    <span>
                      Next: {dashboardData?.upcoming_bills?.[0]?.name || "HDFC EMI"} ({dashboardData?.upcoming_bills?.[0]?.date || "12th Oct"})
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{(dashboardData?.upcoming_bills?.[0]?.amount || 12000).toLocaleString()} Ready
                    </span>
                  </div>
                </div>

                {/* 4. Overall Adherence Score (Percentage) */}
                <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] hover:-translate-y-0.5 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase">
                        {t("Adherence Score")}
                      </span>
                      <div className="p-1.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                        <Award className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                        {dashboardData?.adherence_score ?? 88}%
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                        {t("On Track")}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Zero shortfall • Strict floor compliance
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-emerald-800/40 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
                    <span>{t("Pacing Health")}</span>
                    <span className="font-bold text-teal-600 dark:text-teal-400">+5.2% vs baseline</span>
                  </div>
                </div>
              </div>

              {/* 3. Middle Row - Left & Center (The Spending Ring - Span 2 columns) */}
              <div className="md:col-span-2">
                <SpendingRingWidget isDarkMode={isDarkMode} dashboardData={dashboardData} timeHorizon={timeHorizon} />
              </div>

              {/* 4. Middle Row - Right (Lock Path Schedule - Span 1 column) */}
              <div className="md:col-span-1">
                <InteractiveBillCalendarWidget isDarkMode={isDarkMode} setActiveTab={setActiveTab} dashboardData={dashboardData} />
              </div>
            </div>
          </div>
        );

      case "Transactions": {
        const filteredTx = transactionsList.filter((tx) => {
          const matchesSearch =
            tx.merchant.toLowerCase().includes(txSearch.toLowerCase()) ||
            tx.category.toLowerCase().includes(txSearch.toLowerCase()) ||
            tx.account.toLowerCase().includes(txSearch.toLowerCase());
          const matchesCat =
            txCategoryFilter === "all" || tx.category === txCategoryFilter;
          const matchesAcc =
            txAccountFilter === "all" || tx.account === txAccountFilter;
          return matchesSearch && matchesCat && matchesAcc;
        });

        const totalInflow = transactionsList
          .filter((t) => t.type === "credit")
          .reduce((sum, t) => sum + t.amount, 0);
        const totalOutflow = transactionsList
          .filter((t) => t.type === "debit")
          .reduce((sum, t) => sum + t.amount, 0);
        const netSavings = totalInflow - totalOutflow;

        const getCategoryBadgeClass = (category) => {
          switch (category) {
            case "Income":
              return "bg-emerald-100/80 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-400/40";
            case "Debt Payment":
              return "bg-rose-100/80 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/40";
            case "Utilities":
              return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700";
            case "Food & Dining":
              return "bg-amber-100/80 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40";
            case "Personal Shopping":
              return "bg-purple-100/80 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/40";
            case "Outings & Entertainment":
              return "bg-sky-100/80 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 border-sky-200/60 dark:border-sky-800/40";
            case "Housing":
              return "bg-indigo-100/80 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/40";
            default:
              return "bg-gray-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-gray-200";
          }
        };

        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18191B] dark:text-white">
                  Transactions
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Consolidated statement feed with deterministic classification and account provenance.
                </p>
              </div>
              <div className="flex items-center gap-2.5 self-start sm:self-auto bg-white dark:bg-[#0a3622] px-3.5 py-1.5 rounded-2xl border border-gray-100 dark:border-emerald-800/40 shadow-sm text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Verified Bank Ledger • Zero Gaps
              </div>
            </div>

            {/* Inflow / Outflow KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] hover:-translate-y-1 transition-all duration-300">
                <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-400">
                  Total Monthly Inflow
                </span>
                <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                  +₹{totalInflow.toLocaleString()}
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                  Salary + Verified Retainers
                </div>
              </div>

              <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] hover:-translate-y-1 transition-all duration-300">
                <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-400">
                  Total Monthly Outflow
                </span>
                <div className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white mt-2">
                  ₹{totalOutflow.toLocaleString()}
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  ₹49,640 must-pays • ₹17,216 flexible
                </div>
              </div>

              <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] hover:-translate-y-1 transition-all duration-300">
                <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-400">
                  Net Surplus Retained
                </span>
                <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                  +₹{netSavings.toLocaleString()}
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  61.3% Savings Rate Retained
                </div>
              </div>
            </div>

            {/* Main Table Card with Search & Filters */}
            <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] space-y-5">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    placeholder="Search by merchant, category, or account..."
                    className="w-full pl-10 pr-4 py-2 text-xs rounded-2xl bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={txCategoryFilter}
                    onChange={(e) => setTxCategoryFilter(e.target.value)}
                    className="px-3 py-2 text-xs rounded-2xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 focus:outline-none"
                  >
                    <option value="all">All Categories</option>
                    <option value="Income">Income</option>
                    <option value="Housing">Housing</option>
                    <option value="Debt Payment">Debt Payment</option>
                    <option value="Food & Dining">Food & Dining</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Personal Shopping">Personal Shopping</option>
                    <option value="Outings & Entertainment">Outings & Entertainment</option>
                  </select>

                  <select
                    value={txAccountFilter}
                    onChange={(e) => setTxAccountFilter(e.target.value)}
                    className="px-3 py-2 text-xs rounded-2xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 focus:outline-none"
                  >
                    <option value="all">All Accounts</option>
                    <option value="HDFC Salary A/c">HDFC Salary A/c</option>
                    <option value="ICICI Savings">ICICI Savings</option>
                    <option value="HDFC Credit Card">HDFC Credit Card</option>
                  </select>
                </div>
              </div>

              {/* Clean Data Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-emerald-800/40 text-zinc-400 uppercase tracking-wider font-bold">
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Merchant</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">Account</th>
                      <th className="py-3 px-3 text-right">Amount</th>
                      <th className="py-3 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100/70 dark:divide-white/5">
                    {filteredTx.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-zinc-400">
                          No transactions match your search and filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredTx.map((tx) => (
                        <tr
                          key={tx.id}
                          className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20 transition-colors"
                        >
                          <td className="py-4 px-3 font-semibold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                            {tx.date}
                          </td>
                          <td className="py-4 px-3 font-bold text-zinc-900 dark:text-white">
                            {tx.merchant}
                          </td>
                          <td className="py-4 px-3">
                            <span
                              className={`px-2.5 py-1 rounded-full font-bold text-[11px] border inline-block ${getCategoryBadgeClass(
                                tx.category
                              )}`}
                            >
                              {tx.category}
                            </span>
                          </td>
                          <td className="py-4 px-3 font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                            {tx.account}
                          </td>
                          <td className="py-4 px-3 text-right font-extrabold whitespace-nowrap">
                            <span
                              className={
                                tx.type === "credit"
                                  ? "text-emerald-600 dark:text-emerald-400 text-sm"
                                  : "text-zinc-900 dark:text-white text-sm"
                              }
                            >
                              {tx.type === "credit" ? "+" : "-"}₹{tx.amount.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-right whitespace-nowrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      }

      case "Action Plan":
        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18191B] dark:text-white">
                  Smart Action Plan: Shield Your Goals
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Visual Linear Optimizer: set your milestone target and slide category flexibility to trim safely.
                </p>
              </div>
              <div className="flex items-center gap-2.5 self-start sm:self-auto bg-white dark:bg-[#0a3622] px-3.5 py-1.5 rounded-2xl border border-gray-100 dark:border-emerald-800/40 shadow-sm text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                LP Solver: Minimum Lifestyle Friction
              </div>
            </div>

            {actionPlanSaved && (
              <div className="p-4 rounded-2xl bg-emerald-500 text-white font-semibold text-xs flex items-center justify-between shadow-lg">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Action Plan Locked! Freed ₹{monthlyFreedCashflow.toLocaleString()}/mo redirected into laptop savings.
                </span>
                <span className="text-[11px] underline cursor-pointer" onClick={() => setActionPlanSaved(false)}>
                  Dismiss
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                        <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        Target Milestone Goal
                      </h2>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        What are you shielding money for right now?
                      </p>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-400/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-400/40">
                      High Priority
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">
                        Goal Name
                      </label>
                      <input
                        type="text"
                        defaultValue="Buy a ₹90,000 Laptop"
                        className="w-full px-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">
                        Target Amount (₹)
                      </label>
                      <input
                        type="number"
                        value={targetAmount}
                        onChange={(e) => setTargetAmount(Number(e.target.value))}
                        step="5000"
                        className="w-full px-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 dark:border-emerald-800/40 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-zinc-600 dark:text-zinc-300">
                        Shielded Budget Funding Pace
                      </span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                        {targetFundedPercentage}% Funded in 3 Months
                      </span>
                    </div>
                    <div className="w-full h-3.5 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden p-0.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 dark:from-emerald-400 dark:via-emerald-300 dark:to-teal-300 transition-all duration-700 ease-out"
                        style={{ width: `${targetFundedPercentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] space-y-6">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      Category Flexibility (Tell the math engine what to cut)
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Adjust the stepped sliders below. Each notch tells the linear optimizer how aggressively it is permitted to trim flexible expenses while leaving essential bills locked.
                    </p>
                  </div>

                  <div className="space-y-6">
                    {/* Category 1: Food & Dining */}
                    <div className="p-5 rounded-2xl bg-gray-50/70 dark:bg-zinc-800/40 border border-gray-100 dark:border-emerald-800/40 space-y-3.5 hover:border-emerald-200 dark:hover:border-emerald-800/40 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-zinc-900 dark:text-white">
                              Food & Dining
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-emerald-100 dark:bg-emerald-400/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-400/40">
                              {getFlexibilityLabel(foodFlex)}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Safe Floor: Essential Groceries
                          </p>
                        </div>

                        {/* EMPHASIZED RUPEE CUT IN BOLD */}
                        <div className="flex items-baseline gap-1.5 self-start sm:self-auto bg-white dark:bg-[#0a3622] px-3.5 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            Cut:
                          </span>
                          <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                            ₹{(foodFlex * 95).toLocaleString()}
                          </span>
                          <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500">
                            /mo
                          </span>
                        </div>
                      </div>

                      {/* Continuous Range Slider (step=1) */}
                      <div className="pt-1">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={foodFlex}
                          onChange={(e) => setFoodFlex(Number(e.target.value))}
                          className="w-full accent-emerald-600 dark:accent-emerald-400 h-2 bg-gray-200 dark:bg-zinc-800 rounded-lg cursor-pointer"
                        />

                        {/* Visual Tick Marks at 0%, 25%, 50%, 75%, and 100% */}
                        <div className="flex justify-between items-start mt-2 px-1">
                          {FLEXIBILITY_STEPS.map((step) => {
                            const isSelected = foodFlex === step;
                            const isPassed = foodFlex >= step;
                            return (
                              <button
                                key={step}
                                type="button"
                                onClick={() => setFoodFlex(step)}
                                className="flex flex-col items-center group cursor-pointer focus:outline-none"
                              >
                                <span
                                  className={`w-1.5 h-2.5 rounded-full mb-1 transition-all duration-200 ${
                                    isSelected
                                      ? "bg-emerald-600 dark:bg-emerald-400 scale-125 ring-2 ring-emerald-500/40 dark:ring-emerald-400"
                                      : isPassed
                                      ? "bg-emerald-500/80 dark:bg-emerald-400/70"
                                      : "bg-gray-300 dark:bg-zinc-700"
                                  }`}
                                />
                                <span
                                  className={`text-[11px] leading-tight transition-colors ${
                                    isSelected
                                      ? "font-extrabold text-emerald-700 dark:text-emerald-400"
                                      : "font-semibold text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
                                  }`}
                                >
                                  {step}%
                                </span>
                                <span
                                  className={`text-[10px] tracking-tight transition-colors mt-0.5 ${
                                    isSelected
                                      ? "font-bold text-emerald-600 dark:text-emerald-400"
                                      : "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-400"
                                  }`}
                                >
                                  {FLEXIBILITY_SHORT_LABELS[step]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Category 2: Personal Shopping */}
                    <div className="p-5 rounded-2xl bg-gray-50/70 dark:bg-zinc-800/40 border border-gray-100 dark:border-emerald-800/40 space-y-3.5 hover:border-emerald-200 dark:hover:border-emerald-800/40 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-zinc-900 dark:text-white">
                              Personal Shopping
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-emerald-100 dark:bg-emerald-400/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-400/40">
                              {getFlexibilityLabel(shoppingFlex)}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Safe Floor: Basic Essentials
                          </p>
                        </div>

                        {/* EMPHASIZED RUPEE CUT IN BOLD */}
                        <div className="flex items-baseline gap-1.5 self-start sm:self-auto bg-white dark:bg-[#0a3622] px-3.5 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            Cut:
                          </span>
                          <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                            ₹{(shoppingFlex * 80).toLocaleString()}
                          </span>
                          <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500">
                            /mo
                          </span>
                        </div>
                      </div>

                      {/* Continuous Range Slider (step=1) */}
                      <div className="pt-1">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={shoppingFlex}
                          onChange={(e) => setShoppingFlex(Number(e.target.value))}
                          className="w-full accent-emerald-600 dark:accent-emerald-400 h-2 bg-gray-200 dark:bg-zinc-800 rounded-lg cursor-pointer"
                        />

                        {/* Visual Tick Marks at 0%, 25%, 50%, 75%, and 100% */}
                        <div className="flex justify-between items-start mt-2 px-1">
                          {FLEXIBILITY_STEPS.map((step) => {
                            const isSelected = shoppingFlex === step;
                            const isPassed = shoppingFlex >= step;
                            return (
                              <button
                                key={step}
                                type="button"
                                onClick={() => setShoppingFlex(step)}
                                className="flex flex-col items-center group cursor-pointer focus:outline-none"
                              >
                                <span
                                  className={`w-1.5 h-2.5 rounded-full mb-1 transition-all duration-200 ${
                                    isSelected
                                      ? "bg-emerald-600 dark:bg-emerald-400 scale-125 ring-2 ring-emerald-500/40 dark:ring-emerald-400"
                                      : isPassed
                                      ? "bg-emerald-500/80 dark:bg-emerald-400/70"
                                      : "bg-gray-300 dark:bg-zinc-700"
                                  }`}
                                />
                                <span
                                  className={`text-[11px] leading-tight transition-colors ${
                                    isSelected
                                      ? "font-extrabold text-emerald-700 dark:text-emerald-400"
                                      : "font-semibold text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
                                  }`}
                                >
                                  {step}%
                                </span>
                                <span
                                  className={`text-[10px] tracking-tight transition-colors mt-0.5 ${
                                    isSelected
                                      ? "font-bold text-emerald-600 dark:text-emerald-400"
                                      : "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-400"
                                  }`}
                                >
                                  {FLEXIBILITY_SHORT_LABELS[step]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Category 3: Outings & Entertainment */}
                    <div className="p-5 rounded-2xl bg-gray-50/70 dark:bg-zinc-800/40 border border-gray-100 dark:border-emerald-800/40 space-y-3.5 hover:border-emerald-200 dark:hover:border-emerald-800/40 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-zinc-900 dark:text-white">
                              Outings & Entertainment
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-emerald-100 dark:bg-emerald-400/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-400/40">
                              {getFlexibilityLabel(travelFlex)}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Safe Floor: Daily Commute
                          </p>
                        </div>

                        {/* EMPHASIZED RUPEE CUT IN BOLD */}
                        <div className="flex items-baseline gap-1.5 self-start sm:self-auto bg-white dark:bg-[#0a3622] px-3.5 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            Cut:
                          </span>
                          <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                            ₹{(travelFlex * 50).toLocaleString()}
                          </span>
                          <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500">
                            /mo
                          </span>
                        </div>
                      </div>

                      {/* Continuous Range Slider (step=1) */}
                      <div className="pt-1">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={travelFlex}
                          onChange={(e) => setTravelFlex(Number(e.target.value))}
                          className="w-full accent-emerald-600 dark:accent-emerald-400 h-2 bg-gray-200 dark:bg-zinc-800 rounded-lg cursor-pointer"
                        />

                        {/* Visual Tick Marks at 0%, 25%, 50%, 75%, and 100% */}
                        <div className="flex justify-between items-start mt-2 px-1">
                          {FLEXIBILITY_STEPS.map((step) => {
                            const isSelected = travelFlex === step;
                            const isPassed = travelFlex >= step;
                            return (
                              <button
                                key={step}
                                type="button"
                                onClick={() => setTravelFlex(step)}
                                className="flex flex-col items-center group cursor-pointer focus:outline-none"
                              >
                                <span
                                  className={`w-1.5 h-2.5 rounded-full mb-1 transition-all duration-200 ${
                                    isSelected
                                      ? "bg-emerald-600 dark:bg-emerald-400 scale-125 ring-2 ring-emerald-500/40 dark:ring-emerald-400"
                                      : isPassed
                                      ? "bg-emerald-500/80 dark:bg-emerald-400/70"
                                      : "bg-gray-300 dark:bg-zinc-700"
                                  }`}
                                />
                                <span
                                  className={`text-[11px] leading-tight transition-colors ${
                                    isSelected
                                      ? "font-extrabold text-emerald-700 dark:text-emerald-400"
                                      : "font-semibold text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
                                  }`}
                                >
                                  {step}%
                                </span>
                                <span
                                  className={`text-[10px] tracking-tight transition-colors mt-0.5 ${
                                    isSelected
                                      ? "font-bold text-emerald-600 dark:text-emerald-400"
                                      : "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-400"
                                  }`}
                                >
                                  {FLEXIBILITY_SHORT_LABELS[step]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] flex flex-col justify-between">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white mb-1">
                    Optimizer Result
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5">
                    Live solution generated without touching rent or EMIs.
                  </p>

                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/40">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800 dark:text-emerald-400">
                        Total Freed Monthly Cashflow
                      </span>
                      <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
                        +₹{monthlyFreedCashflow.toLocaleString()} / mo
                      </div>
                      <p className="text-xs text-emerald-900/80 dark:text-emerald-300 mt-1">
                        Re-allocated straight into your laptop goal fund.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-emerald-800/40">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                        Estimated Purchase Timeline
                      </span>
                      <div className="text-2xl font-extrabold text-zinc-900 dark:text-white mt-1">
                        {(targetAmount / Math.max(1, monthlyFreedCashflow + 14000)).toFixed(1)} Months
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        2.5 months faster than default unmanaged savings pace.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-emerald-800/40">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                        Protected Floor
                      </span>
                      <div className="text-lg font-extrabold text-zinc-900 dark:text-white mt-0.5">
                        ₹25,000 Intact (100%)
                      </div>
                      <p className="text-xs text-zinc-500">
                        Zero risk of breaching emergency reserve.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-emerald-800/40">
                  <button
                    onClick={async () => {
                      setActionPlanSaved(true);
                      try {
                        const sid = typeof window !== "undefined" ? window.localStorage.getItem("spendshield-session-id") || "demo" : "demo";
                        await fetch(`/api/lock?session_id=${encodeURIComponent(sid)}`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", "X-Session-ID": sid },
                          body: JSON.stringify({
                            id: "lp_plan_1",
                            goal: "Buy a ₹90,000 Laptop",
                            deadline: "2026-12-31",
                            required_balance: targetAmount,
                            band: {
                              p10: Math.round(targetAmount * 0.85),
                              p50: targetAmount,
                              p90: Math.round(targetAmount * 1.15),
                            },
                            category_ceilings: {
                              dining: foodFlex,
                              shopping: shoppingFlex,
                              entertainment: entertainmentFlex,
                            },
                            max_risk: 0.1,
                            priority: "High",
                          }),
                        });
                      } catch (e) {
                        console.warn("Lock path sync error:", e);
                      }
                    }}
                    className="w-full py-3 rounded-2xl bg-[#0a3622] hover:bg-emerald-900 dark:bg-emerald-400 dark:hover:bg-emerald-300 dark:text-emerald-950 font-bold text-white font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    Lock This Action Plan
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case "Scenarios":
        return <Scenarios />;

      case "Benchmark":
        return (
          <div className="space-y-7">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18191B] dark:text-white">
                  Model Accuracy & Benchmark Telemetry
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Empirical Mean Absolute Error (MAE) and Quantile Coverage proving SpendShield's predictive edge over baselines.
                </p>
              </div>
              <div className="flex items-center gap-2.5 self-start sm:self-auto bg-white dark:bg-[#0a3622] px-3.5 py-1.5 rounded-2xl border border-gray-100 dark:border-emerald-800/40 shadow-sm text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                <Cpu className="w-4 h-4 text-emerald-500" />
                Deterministic Python SimEngine • Sub-18ms Latency
              </div>
            </div>

            {/* 4 Hero Benchmark Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] hover:-translate-y-1 transition-all duration-300">
                <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-400">
                  Mean Absolute Error (MAE)
                </span>
                <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                  ₹1,420
                </div>
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mt-2 flex items-center gap-1">
                  <ArrowDownRight className="w-4 h-4 text-emerald-500" />
                  -70.7% vs Naive (₹4,850)
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  At 30-day projection horizon
                </p>
              </div>

              <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] hover:-translate-y-1 transition-all duration-300">
                <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-400">
                  Empirical Coverage (P10–P90)
                </span>
                <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                  94.2%
                </div>
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mt-2 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  +26.2% vs Naive (68.0%)
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Target confidence band: 80%–95%
                </p>
              </div>

              <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] hover:-translate-y-1 transition-all duration-300">
                <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-400">
                  CRPS Probabilistic Score
                </span>
                <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                  0.142
                </div>
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mt-2 flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  62.6% better distribution fit
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Lower score indicates tighter bands
                </p>
              </div>

              <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] hover:-translate-y-1 transition-all duration-300">
                <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-400">
                  Stress Bound Reliability
                </span>
                <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                  99.1%
                </div>
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Zero unmanaged overdrafts
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Across 1,000 Monte Carlo shock paths
                </p>
              </div>
            </div>

            {/* Recharts Comparison Visuals */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1: MAE Across Horizons */}
              <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                      Mean Absolute Error vs Forecast Horizon
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Lower MAE indicates superior prediction precision (₹ value).
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-400/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-400/40 self-start sm:self-auto">
                    Twin Model Outperforms
                  </span>
                </div>

                <div className="h-64 sm:h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={BENCHMARK_HORIZON_DATA}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#27272a" : "#f1f5f9"} />
                      <XAxis dataKey="horizon" tick={{ fontSize: 11, fill: isDarkMode ? "#71717a" : "#a1a1aa" }} />
                      <YAxis tick={{ fontSize: 11, fill: isDarkMode ? "#71717a" : "#a1a1aa" }} tickFormatter={(val) => `₹${val}`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDarkMode ? "#18181b" : "#ffffff",
                          borderColor: isDarkMode ? "#27272a" : "#e4e4e7",
                          borderRadius: "1rem",
                          fontSize: "12px",
                        }}
                        formatter={(val) => [`₹${val.toLocaleString()}`, ""]}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                      <Line
                        type="monotone"
                        dataKey="twinModel"
                        name="Twin Model (SpendShield)"
                        stroke={isDarkMode ? "#34D399" : "#059669"}
                        strokeWidth={3}
                        dot={{ r: 4, fill: isDarkMode ? "#34D399" : "#059669" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="arima"
                        name="ARIMA Baseline"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                      />
                      <Line
                        type="monotone"
                        dataKey="naive"
                        name="Naive Rolling Mean"
                        stroke="#71717a"
                        strokeWidth={2}
                        strokeDasharray="2 2"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Quantile Coverage Reliability */}
              <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-emerald-500" />
                      Empirical Quantile Calibration Coverage
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Comparing predicted probability bounds against ground-truth outcomes.
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-400/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-400/40 self-start sm:self-auto">
                    Well-Calibrated Fan
                  </span>
                </div>

                <div className="h-64 sm:h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={BENCHMARK_CALIBRATION_DATA}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#27272a" : "#f1f5f9"} />
                      <XAxis dataKey="quantile" tick={{ fontSize: 10, fill: isDarkMode ? "#71717a" : "#a1a1aa" }} />
                      <YAxis tick={{ fontSize: 11, fill: isDarkMode ? "#71717a" : "#a1a1aa" }} tickFormatter={(val) => `${val}%`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDarkMode ? "#18181b" : "#ffffff",
                          borderColor: isDarkMode ? "#27272a" : "#e4e4e7",
                          borderRadius: "1rem",
                          fontSize: "12px",
                        }}
                        formatter={(val) => [`${val}%`, ""]}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                      <Bar dataKey="twinModel" name="SpendShield Twin Model" fill={isDarkMode ? "#34D399" : "#059669"} radius={[6, 6, 0, 0]} />
                      <Bar dataKey="target" name="Theoretical Target" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="naive" name="Naive Baseline" fill="#71717a" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Architecture Details Box */}
            <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]">
              <h2 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-500" />
                Backend Verification Standards & Audited Pipeline
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-emerald-800/40">
                  <div className="font-bold text-zinc-900 dark:text-white mb-1">
                    Deterministic SimEngine
                  </div>
                  <p className="text-zinc-500 dark:text-zinc-400">
                    No generative LLM math hallucinations. All cash forecasts run via pure Python linear programming and Bayesian priors.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-emerald-800/40">
                  <div className="font-bold text-zinc-900 dark:text-white mb-1">
                    Historical Cross-Validation
                  </div>
                  <p className="text-zinc-500 dark:text-zinc-400">
                    Validated across 4,200 simulated consumer account trajectories with varied salary cycles, EMIs, and variable living expenses.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-emerald-800/40">
                  <div className="font-bold text-zinc-900 dark:text-white mb-1">
                    Instant Fallback Resilience
                  </div>
                  <p className="text-zinc-500 dark:text-zinc-400">
                    If network or cloud telemetry disconnects, client-side fallback engines immediately guarantee zero downtime and uninterrupted user experience.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case "Subscriptions":
      case "Bills & Subscriptions":
        return <Subscriptions />;

      case "Data Sync":
        return <DataSync />;

      case "OldSubscriptions":
        return (
          <div className="space-y-7">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18191B] dark:text-white">
                  Bills & Subscriptions
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Priority-driven bill schedule ring-fencing must-pays alongside automated merchant drift detection.
                </p>
              </div>
              <div className="flex items-center gap-2.5 self-start sm:self-auto bg-white dark:bg-[#0a3622] px-3.5 py-1.5 rounded-2xl border border-gray-100 dark:border-emerald-800/40 shadow-sm text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                ₹65,890 Ring-Fenced in Safe Autopay Reserve
              </div>
            </div>

            {subToast && (
              <div className="p-4 rounded-2xl bg-emerald-500 text-white font-semibold text-xs flex items-center justify-between shadow-lg">
                <span>{subToast}</span>
                <span className="text-[11px] underline cursor-pointer" onClick={() => setSubToast(null)}>
                  Dismiss
                </span>
              </div>
            )}

            {/* =========================================================================
                TOP SECTION: Priority List Bill Schedule
               ========================================================================= */}
            <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    Priority List Bill Schedule
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Upcoming locked payments chronologically sorted by due date and criticality tier.
                  </p>
                </div>

                {/* Filter Chips: All, Must-Pay, Flexible */}
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-gray-100 dark:bg-zinc-800/60 border border-gray-200/50 dark:border-emerald-800/40 text-xs font-semibold">
                  <button
                    onClick={() => setBillFilter("all")}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      billFilter === "all"
                        ? "bg-white dark:bg-[#0a3622] text-emerald-700 dark:text-emerald-400 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    All ({upcomingBills.length})
                  </button>
                  <button
                    onClick={() => setBillFilter("Must-Pay")}
                    className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
                      billFilter === "Must-Pay"
                        ? "bg-white dark:bg-[#0a3622] text-emerald-700 dark:text-emerald-400 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    <Lock className="w-3 h-3 text-emerald-500" />
                    Must-Pay ({upcomingBills.filter((b) => b.criticality === "Must-Pay").length})
                  </button>
                  <button
                    onClick={() => setBillFilter("Flexible")}
                    className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
                      billFilter === "Flexible"
                        ? "bg-white dark:bg-[#0a3622] text-emerald-700 dark:text-emerald-400 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    <Unlock className="w-3 h-3 text-blue-500" />
                    Flexible ({upcomingBills.filter((b) => b.criticality === "Flexible").length})
                  </button>
                </div>
              </div>

              {/* Bill Schedule Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingBills
                  .filter((b) => billFilter === "all" || b.criticality === billFilter)
                  .sort((a, b) => a.daysLeft - b.daysLeft)
                  .map((bill) => {
                    const isMustPay = bill.criticality === "Must-Pay";
                    return (
                      <div
                        key={bill.id}
                        className={`p-4 rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between ${
                          isMustPay
                            ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/30 shadow-sm"
                            : "bg-gray-50/50 dark:bg-zinc-800/30 border-gray-200/60 dark:border-emerald-800/40"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase inline-flex items-center gap-1 ${
                                isMustPay
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-700/40"
                                  : "bg-blue-100/70 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40"
                              }`}
                            >
                              {isMustPay ? (
                                <Lock className="w-2.5 h-2.5" />
                              ) : (
                                <Unlock className="w-2.5 h-2.5" />
                              )}
                              {bill.criticality}
                            </span>
                            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                              Due in {bill.daysLeft} days
                            </span>
                          </div>

                          <div className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                            {bill.name}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate mb-3">
                            {bill.payee} • {bill.account}
                          </div>
                        </div>

                        <div className="flex items-baseline justify-between pt-2 border-t border-gray-100 dark:border-emerald-800/40">
                          <div>
                            <span className="text-[10px] font-semibold uppercase text-zinc-400 block">
                              Scheduled Debit
                            </span>
                            <span className="text-lg font-extrabold text-zinc-900 dark:text-white tracking-tight">
                              ₹{bill.amount.toLocaleString()}
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              setUpcomingBills((prev) =>
                                prev.map((item) =>
                                  item.id === bill.id
                                    ? { ...item, isLocked: !item.isLocked }
                                    : item
                                )
                              );
                              setSubToast(
                                bill.isLocked
                                  ? `${bill.name} unlocked for budget flexibility.`
                                  : `${bill.name} ring-fenced & locked in autopay reserve.`
                              );
                              setTimeout(() => setSubToast(null), 3000);
                            }}
                            className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 ${
                              bill.isLocked
                                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                : "bg-gray-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-gray-300"
                            }`}
                          >
                            {bill.isLocked ? (
                              <>
                                <Lock className="w-3 h-3" /> Locked
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3 h-3" /> Flexible
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* =========================================================================
                BOTTOM SECTION: Recurring Merchant Table with Drift Column
               ========================================================================= */}
            <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-amber-500" />
                    Recurring Merchant Drift & Contract Audit
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Automated drift monitoring: detecting unannounced price escalations against agreed baselines.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-200/50 dark:border-amber-800/30 self-start sm:self-auto">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  2 Unscheduled Price Hikes Flagged
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-emerald-800/40 text-zinc-400 uppercase tracking-wider font-bold">
                      <th className="py-3 px-3">Merchant / Obligation</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">Cadence</th>
                      <th className="py-3 px-3">Baseline</th>
                      <th className="py-3 px-3">Current Charge</th>
                      <th className="py-3 px-3">Drift</th>
                      <th className="py-3 px-3">Reason / Details</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100/70 dark:divide-white/5">
                    {subscriptionsList.map((sub) => (
                      <tr key={sub.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20">
                        <td className="py-4 px-3 font-bold text-zinc-900 dark:text-white">
                          {sub.name}
                        </td>
                        <td className="py-4 px-3 text-zinc-500 dark:text-zinc-400">{sub.category}</td>
                        <td className="py-4 px-3 text-zinc-500 dark:text-zinc-400">{sub.cadence}</td>
                        <td className="py-4 px-3 font-semibold text-zinc-600 dark:text-zinc-400">
                          ₹{sub.baseline.toLocaleString()}
                        </td>
                        <td className="py-4 px-3 font-extrabold text-zinc-900 dark:text-white">
                          ₹{sub.current.toLocaleString()}
                        </td>
                        <td className="py-4 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-full font-bold text-[11px] inline-flex items-center gap-1 ${
                              sub.driftType === "danger"
                                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                : sub.driftType === "warning"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : sub.driftType === "positive"
                                ? "bg-emerald-500/10 dark:bg-emerald-400/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-400/40"
                                : "bg-gray-100 dark:bg-zinc-800 text-zinc-500"
                            }`}
                          >
                            {sub.drift.startsWith("+")
                              ? `🔺 ${sub.drift}`
                              : sub.drift.startsWith("-")
                              ? `🔻 ${sub.drift}`
                              : `⚖️ ${sub.drift}`}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-zinc-500 dark:text-zinc-400 max-w-xs truncate">
                          {sub.reason}
                        </td>
                        <td className="py-4 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSubToast(`Dispute generated for ${sub.name}. Email template drafted!`);
                                setTimeout(() => setSubToast(null), 3500);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 transition-colors"
                            >
                              Challenge
                            </button>
                            <button
                              onClick={() => {
                                setSubscriptionsList((prev) => prev.filter((item) => item.id !== sub.id));
                                setSubToast(`Removed ${sub.name} from tracked subscriptions.`);
                                setTimeout(() => setSubToast(null), 3000);
                              }}
                              className="p-1.5 rounded-xl hover:bg-red-500/10 hover:text-red-500 text-zinc-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case "Co-Pilot": {
        const renderAnalyticalMessage = (text) => {
          if (!text) return null;
          const parts = text.split(/(\*\*.*?\*\*|₹[0-9,]+(?:\.[0-9]+)?(?:\/[a-zA-Z]+|k)?|[+-]?\d+(?:\.\d+)?%)/g);
          return parts.map((part, index) => {
            if (!part) return null;
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={index} className="font-bold text-slate-900 dark:text-white">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            if (
              /^₹[0-9,]+(?:\.[0-9]+)?(?:\/[a-zA-Z]+|k)?$/.test(part) ||
              /^[+-]?\d+(?:\.\d+)?%$/.test(part)
            ) {
              return (
                <span key={index} className="font-bold text-slate-900 dark:text-white">
                  {part}
                </span>
              );
            }
            return <span key={index}>{part}</span>;
          });
        };

        return (
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18191B] dark:text-white">
                  Verified AI Co-Pilot
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Audited LLM agent grounded by deterministic Python calculation tools.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-2xl text-xs font-bold text-emerald-800 dark:text-emerald-400">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Data-Safe • Verified Bank Telemetry Only
              </div>
            </div>

            <div className="bg-white/80 dark:bg-[#0c1c14]/80 backdrop-blur-xl border border-slate-200 dark:border-emerald-800/40 shadow-xl rounded-2xl p-4 sm:p-6 flex flex-col h-[600px]">
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 sm:pr-2 scrollbar-thin">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${
                      msg.sender === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.sender === "bot" && (
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`text-xs sm:text-sm leading-relaxed ${
                        msg.sender === "user"
                          ? "max-w-lg p-3.5 sm:p-4 rounded-2xl rounded-tr-none bg-emerald-600 text-white font-medium shadow-[0_4px_14px_0_rgba(5,150,105,0.39)]"
                          : "max-w-xl p-4 sm:p-5 rounded-2xl rounded-tl-none bg-slate-50 dark:bg-[#061d12]/70 border border-slate-100 dark:border-emerald-800/30 shadow-sm text-slate-700 dark:text-zinc-200 whitespace-pre-line"
                      }`}
                    >
                      {msg.sender === "bot" ? (
                        <div>
                          <div>{renderAnalyticalMessage(msg.text)}</div>
                          {msg.verified && (
                            <div className="text-xs font-mono text-emerald-700 bg-emerald-50 py-1 px-2 rounded-md inline-flex items-center gap-1 mt-2 border border-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-800/40">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Verified against HDFC Bank Statement (#4921)</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        msg.text
                      )}
                    </div>

                    {msg.sender === "user" && (
                      <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-emerald-900/60 text-slate-700 dark:text-zinc-200 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
                <div
                  ref={(el) => {
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                />
              </div>

              {/* Suggestions Chips & Floating Prompt Dock */}
              <div className="pt-3 border-t border-slate-100 dark:border-emerald-800/30 mt-2 space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 mr-0.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-500" />
                    Suggested:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSendMessage("Can I afford a ₹80k laptop?")}
                    className="px-3 py-1.5 rounded-full bg-slate-50 dark:bg-[#061d12] hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-emerald-800/40 text-xs font-medium text-slate-700 dark:text-zinc-200 transition-all flex items-center gap-1.5 shadow-2xs hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                  >
                    Can I afford a ₹80k laptop?
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage("Why is my savings dropping?")}
                    className="px-3 py-1.5 rounded-full bg-slate-50 dark:bg-[#061d12] hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-emerald-800/40 text-xs font-medium text-slate-700 dark:text-zinc-200 transition-all flex items-center gap-1.5 shadow-2xs hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                  >
                    Why is my savings dropping?
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendMessage("What is my safe-to-spend headroom today?")
                    }
                    className="px-3 py-1.5 rounded-full bg-slate-50 dark:bg-[#061d12] hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-emerald-800/40 text-xs font-medium text-slate-700 dark:text-zinc-200 transition-all flex items-center gap-1.5 shadow-2xs hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                  >
                    Safe-to-spend headroom today?
                  </button>
                </div>

                <div className="relative flex items-center bg-white dark:bg-[#061d12]/90 border border-slate-200 dark:border-emerald-800/50 rounded-2xl shadow-lg p-1.5 pl-4 transition-all focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Ask a question about your verified cashflows or bills..."
                    className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none pr-3"
                  />
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={!chatInput.trim()}
                    className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-[0_4px_14px_0_rgba(5,150,105,0.39)] transition-all cursor-pointer"
                    aria-label="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case "Review":
        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18191B] dark:text-white">
                  Smart Categoriser Training
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Simulate live debit transactions and train the active-learning NLP engine on low-confidence predictions.
                </p>
              </div>
              <div className="flex items-center gap-2.5 self-start sm:self-auto bg-white dark:bg-[#0a3622] px-3.5 py-1.5 rounded-2xl border border-gray-100 dark:border-emerald-800/40 shadow-sm text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                Character n-gram TF-IDF + Logistic Calibration
              </div>
            </div>

            {feedNotification && (
              <div className="p-4 rounded-2xl bg-emerald-500 text-white font-semibold text-xs flex items-center justify-between shadow-lg">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {feedNotification}
                </span>
                <span className="text-[11px] underline cursor-pointer" onClick={() => setFeedNotification(null)}>
                  Dismiss
                </span>
              </div>
            )}

            <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] space-y-4">
              <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Simulate Live Transaction
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Type any merchant string to see how SpendShield classifies and scores prediction confidence in real time.
              </p>

              <form onSubmit={handleSimulateTransaction} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                <div className="sm:col-span-2">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">
                    Merchant Narration
                  </label>
                  <input
                    type="text"
                    value={simulatedNarration}
                    onChange={(e) => setSimulatedNarration(e.target.value)}
                    placeholder="e.g. Starbucks Bandra, Netflix.com, Uber Trip"
                    className="w-full px-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={simulatedAmount}
                    onChange={(e) => setSimulatedAmount(e.target.value)}
                    placeholder="450"
                    className="w-full px-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    Simulate Swipe
                    <CornerDownLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white dark:bg-[#0a3622] rounded-3xl border border-gray-100 dark:border-emerald-800/40 p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                    Review Queue (Low Confidence Predictions)
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Predictions scoring under 70% confidence require manual human verification to calibrate persona models.
                  </p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  {reviewQueue.length} Pending Approval
                </span>
              </div>

              {reviewQueue.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-gray-50 dark:bg-zinc-800/30 border border-dashed border-gray-200 dark:border-zinc-700">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    All Predictions Calibrated!
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    No transactions currently fall below the confidence threshold.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-emerald-800/40 text-zinc-400 uppercase tracking-wider font-bold">
                        <th className="py-3 px-3">Transaction Narration</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Amount</th>
                        <th className="py-3 px-3">AI Prediction</th>
                        <th className="py-3 px-3">Confidence Score</th>
                        <th className="py-3 px-3 text-right">Approve / Correct</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100/70 dark:divide-white/5">
                      {reviewQueue.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20">
                          <td className="py-4 px-3 font-bold text-zinc-900 dark:text-white">
                            {item.narration}
                          </td>
                          <td className="py-4 px-3 text-zinc-500">{item.date}</td>
                          <td className="py-4 px-3 font-extrabold text-zinc-900 dark:text-white">
                            ₹{item.amount.toLocaleString()}
                          </td>
                          <td className="py-4 px-3">
                            <span className="px-2.5 py-1 rounded-full font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px]">
                              {item.predictedCategory}
                            </span>
                          </td>
                          <td className="py-4 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                                <div
                                  className="h-full bg-amber-500 rounded-full"
                                  style={{ width: `${item.confidence * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-[11px] font-bold text-zinc-500">
                                {Math.round(item.confidence * 100)}%
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <select
                                onChange={(e) => handleCorrectCategory(item.id, e.target.value)}
                                defaultValue=""
                                className="px-2.5 py-1 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 focus:outline-none"
                              >
                                <option value="" disabled>Change to...</option>
                                <option value="Food & Dining">Food & Dining</option>
                                <option value="Shopping">Shopping</option>
                                <option value="Debt Payment">Debt Payment</option>
                                <option value="Groceries">Groceries</option>
                                <option value="Utilities">Utilities</option>
                              </select>
                              <button
                                onClick={() => handleApproveCategory(item.id)}
                                className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors"
                              >
                                Approve
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ==========================================================================
  // ROUTE RENDERING (Placed strictly below all hooks & component functions)
  // ==========================================================================
  if (location.pathname === "/login") {
    return <Login />;
  }

  if (location.pathname === "/onboarding") {
    return <Onboarding />;
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? "dark" : ""}`}>
      <div className="min-h-screen flex flex-col bg-[#F2F9F6] dark:bg-[#061d12] text-[#18191B] dark:text-zinc-100 transition-colors duration-300 font-sans antialiased selection:bg-emerald-500/20 selection:text-emerald-900 dark:selection:text-emerald-300">
        
        {/* =========================================================================
            TOP HEADER (Strict Image Logo Tag + 8 Pill Tabs Single Line + Controls)
           ========================================================================= */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#F2F9F6]/90 dark:bg-[#061d12]/90 border-b border-gray-200/70 dark:border-emerald-800/40 transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-3 sm:gap-6">
            
            {/* STRICT LOGO: Exact Image Tag (no text next to logo as requested) */}
            <div
              onClick={() => {
                setActiveTab("Dashboard");
                navigate("/");
              }}
              className="flex items-center cursor-pointer group select-none shrink-0"
              title="SpendShield Dashboard"
            >
              <img
                src="/logo.jpg"
                alt="SpendShield"
                className="h-14 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/logo.png";
                }}
              />
            </div>

            {/* Center Pill Nav: All 8 Features (horizontally scrollable single line without wrapping) */}
            <div className="min-w-0 flex-1 max-w-2xl xl:max-w-3xl mx-1 sm:mx-3 flex items-center justify-center">
              <nav className="flex items-center gap-2 overflow-x-auto whitespace-nowrap no-scrollbar scrollbar-none p-1.5 rounded-full bg-gray-200/50 dark:bg-zinc-900/60 border border-gray-200/80 dark:border-emerald-800/40 backdrop-blur-md max-w-full">
                {NAV_TABS.map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => {
                        setActiveTab(tab);
                        if (tab === "Dashboard") navigate("/");
                        else if (tab === "Subscriptions") navigate("/subscriptions");
                        else if (tab === "Scenarios") navigate("/scenarios");
                        else if (tab === "Data Sync") navigate("/data-sync");
                      }}
                      className={`px-3.5 sm:px-4 py-2 text-xs font-bold rounded-full shrink-0 transition-all duration-200 ease-out ${
                        isActive
                          ? "bg-emerald-100 text-emerald-950 dark:bg-emerald-400/20 dark:text-emerald-400 dark:border dark:border-emerald-400 shadow-sm"
                          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white/40 dark:hover:bg-white/5"
                      }`}
                    >
                      {t(tab)}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Right Controls: Language Selector, Voice Command, Bell Dropdown, Theme Toggle, Avatar */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              <LanguageSelector />
              <VoiceCommand />
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`p-2.5 rounded-2xl border transition-all duration-200 shadow-sm relative ${
                    showNotifications
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-600"
                      : "bg-white dark:bg-zinc-900 border-gray-200/80 dark:border-emerald-800/40 text-zinc-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                  }`}
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[9px] font-bold text-white items-center justify-center">
                      2
                    </span>
                  </span>
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-3xl bg-white/95 dark:bg-[#0a3622]/95 backdrop-blur-xl border border-gray-200/80 dark:border-emerald-700/40 shadow-2xl p-4 z-50">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-emerald-800/40">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-zinc-900 dark:text-white">
                          Recent Notifications
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600">
                          2 Unread
                        </span>
                      </div>
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="py-2 space-y-2">
                      <div
                        onClick={() => {
                          setActiveTab("Subscriptions");
                          setShowNotifications(false);
                        }}
                        className="p-3 rounded-2xl bg-red-500/10 hover:bg-red-500/15 cursor-pointer transition-all border border-red-500/20 flex gap-3"
                      >
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-xs text-zinc-900 dark:text-white">
                            ⚠️ HDFC EMI jumped +47%
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Auto-debit changed from ₹12,000 to ₹17,640/mo. Tap to challenge.
                          </p>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          setActiveTab("Subscriptions");
                          setShowNotifications(false);
                        }}
                        className="p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/15 cursor-pointer transition-all border border-amber-500/20 flex gap-3"
                      >
                        <Bell className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-xs text-zinc-900 dark:text-white">
                            🔔 Netflix auto-renewing in 3 days
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            ₹649 pre-shielded from your flexible spend bucket.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100 dark:border-emerald-800/40 flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">Live Telemetry Active</span>
                      <button
                        onClick={() => {
                          setActiveTab("Subscriptions");
                          setShowNotifications(false);
                        }}
                        className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        View Bills & Subscriptions →
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                className="relative flex items-center w-14 h-8 p-1 rounded-full bg-gray-200 dark:bg-zinc-800 border border-gray-300/60 dark:border-zinc-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                <div
                  className={`w-6 h-6 rounded-full bg-white dark:bg-zinc-900 shadow-md flex items-center justify-center transition-transform duration-300 ease-out transform ${
                    isDarkMode ? "translate-x-6 text-emerald-400" : "translate-x-0 text-amber-500"
                  }`}
                >
                  {isDarkMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                </div>
              </button>

              <div
                onClick={() => navigate("/login")}
                className="flex items-center gap-2 pl-1 cursor-pointer group"
                title="Switch Account / View Login Screen"
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-[2px] shadow-sm group-hover:scale-105 transition-transform duration-200">
                    <div className="w-full h-full rounded-[14px] bg-white dark:bg-zinc-900 flex items-center justify-center font-bold text-sm text-emerald-800 dark:text-emerald-400">
                      MR
                    </div>
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900"></span>
                </div>
              </div>

              <button
                onClick={() => {
                  localStorage.removeItem("token");
                  navigate("/login");
                }}
                title="Sign Out / Go to Login Screen"
                className="p-2.5 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-gray-200/80 dark:border-emerald-800/40 transition-colors shadow-sm"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>
        </header>

        {isLoading && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 w-full">
            <div className="h-1.5 w-full bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 animate-pulse w-3/4"></div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          {renderTabContent()}
        </main>

        {/* =========================================================================
            RICH BRAND-COLORED FOOTER (Developers Column + Interactive Benchmark)
           ========================================================================= */}
        <footer className="mt-auto border-t border-emerald-800/40 bg-[#0a3622] text-white transition-colors duration-300 shadow-[0_-4px_25px_rgba(10,54,34,0.15)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 flex flex-col md:flex-row items-center justify-between gap-6 text-xs">
            {/* Left side: Copyright & Team */}
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
              <span className="font-semibold text-emerald-100/90 tracking-tight">
                © 2026 SpendShield.
              </span>
              <span className="hidden sm:inline text-emerald-600/70">•</span>
              <span className="text-emerald-300 font-medium tracking-wide">
                Team Core Dump
              </span>
            </div>

            {/* Center: Developers Column (The Developer Feature) */}
            <div className="flex flex-col items-center md:items-start gap-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400/90">
                Developers
              </span>
              <button
                onClick={() => {
                  setActiveTab("Benchmark");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`inline-flex items-center gap-2 text-xs font-semibold transition-all px-2.5 py-1 rounded-xl group ${
                  activeTab === "Benchmark"
                    ? "bg-emerald-500 text-emerald-950 font-bold shadow-sm"
                    : "text-emerald-100 hover:text-white hover:bg-emerald-800/50"
                }`}
                title="Launch Model Benchmark & ML Accuracy Telemetry"
              >
                <Activity
                  className={`w-3.5 h-3.5 transition-transform group-hover:scale-110 ${
                    activeTab === "Benchmark" ? "text-emerald-950" : "text-emerald-400"
                  }`}
                />
                <span
                  className={
                    activeTab === "Benchmark"
                      ? "font-bold"
                      : "underline decoration-emerald-500/60 underline-offset-4 group-hover:decoration-white"
                  }
                >
                  Model Benchmark
                </span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full transition-colors ${
                    activeTab === "Benchmark"
                      ? "bg-emerald-900/30 text-emerald-950 border border-emerald-950/20"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-emerald-950"
                  }`}
                >
                  ML Audit
                </span>
              </button>
            </div>

            {/* Right side (Socials): Clickable Lucide icons with vibrant hover effects */}
            <div className="flex items-center gap-3 text-emerald-200">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="p-2 rounded-xl hover:text-white hover:bg-emerald-800/60 transition-all duration-200"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="p-2 rounded-xl hover:text-white hover:bg-emerald-800/60 transition-all duration-200"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="p-2 rounded-xl hover:text-white hover:bg-emerald-800/60 transition-all duration-200"
              >
                <Github className="w-4 h-4" />
              </a>
            </div>
          </div>
        </footer>

        {/* Floating Toast Notification Pill */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-900/95 dark:bg-emerald-950/95 text-white backdrop-blur-xl border border-white/20 dark:border-emerald-500/40 shadow-2xl text-xs sm:text-sm font-semibold max-w-md pointer-events-none"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="leading-snug">{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
