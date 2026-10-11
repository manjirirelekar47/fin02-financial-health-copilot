// src/components/Sidebar.jsx
// Left navigation with multi-language support (English, Hindi, Marathi).
import React from "react";
import {
  LayoutDashboard,
  Receipt,
  Target,
  Sliders,
  CreditCard,
  Database,
  Bot,
  CheckSquare,
} from "lucide-react";
import { useSettings } from "../context/SettingsContext";

export const DEFAULT_TABS = [
  { id: "Dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "Transactions", label: "Transactions", icon: Receipt },
  { id: "Action Plan", label: "Action Plan", icon: Target },
  { id: "Scenarios", label: "Scenarios", icon: Sliders },
  { id: "Subscriptions", label: "Subscriptions", icon: CreditCard },
  { id: "Data Sync", label: "Data Sync", icon: Database },
  { id: "Co-Pilot", label: "Co-Pilot", icon: Bot },
  { id: "Review", label: "Review", icon: CheckSquare },
];

function Sidebar({ tabs = DEFAULT_TABS, activeTab, onSelect, onSwitchMode }) {
  const { t } = useSettings();
  const displayTabs = tabs && tabs.length > 0 ? tabs : DEFAULT_TABS;

  return (
    <aside className="w-64 bg-white/70 dark:bg-[#061d12]/90 backdrop-blur-xl border-r border-cardborder dark:border-emerald-800/40 flex flex-col h-screen shrink-0 sticky top-0">
      <div className="px-5 py-6 flex items-center gap-3">
        <img
          src="/logo-icon.png"
          alt="SpendShield logo"
          className="w-11 h-11 object-contain shrink-0 drop-shadow-sm"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/logo.png";
          }}
        />
        <span className="text-[22px] font-display font-extrabold tracking-tight leading-none">
          <span className="text-navy dark:text-white">Spend</span>
          <span className="bg-gradient-to-r from-[#1D604C] to-[#3FA873] bg-clip-text text-transparent">
            Shield
          </span>
        </span>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {displayTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect && onSelect(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left cursor-pointer ${
                isActive
                  ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-950 dark:text-emerald-300 font-semibold shadow-sm ring-1 ring-emerald-600/15"
                  : "text-slate-500 hover:bg-emerald-500/10 hover:text-emerald-950 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {Icon && <Icon size={17} className={isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"} />}
              <span>{t(tab.label || tab.id)}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-6 py-5 border-t border-cardborder dark:border-emerald-800/40">
        <p className="text-xs font-semibold text-navy/80 dark:text-zinc-300">{t("Simulate the consequences.")}</p>
        <p className="text-xs font-semibold text-accent text-emerald-600 dark:text-emerald-400">{t("Then decide.")}</p>
        {onSwitchMode && (
          <button
            type="button"
            onClick={onSwitchMode}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-600/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer"
          >
            ⚡ {t("Switch Data / Demo")}
          </button>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
