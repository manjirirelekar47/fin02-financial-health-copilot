// src/components/Sidebar.jsx
// Left navigation matching the SpendShield design spec. Purely presentational
// + a click handler — App.jsx owns which tab is active and what's shown.
//
// Props:
//   tabs      - array of { id, label, icon } in the order they should render
//   activeTab - id of the currently selected tab
//   onSelect  - (id) => void

import { ShieldCheck } from "lucide-react";

function Sidebar({ tabs, activeTab, onSelect }) {
  return (
    <aside className="w-64 bg-white border-r border-cardborder flex flex-col h-screen shrink-0 sticky top-0">
      <div className="px-6 py-6 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-navy/10 flex items-center justify-center shrink-0">
          <ShieldCheck size={18} className="text-navy" />
        </div>
        <span className="text-lg font-display font-extrabold text-navy tracking-tight">
          SpendShield
        </span>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                isActive
                  ? "bg-navy/10 text-navy font-semibold"
                  : "text-slate-500 hover:bg-canvas hover:text-navy"
              }`}
            >
              <Icon size={17} className={isActive ? "text-navy" : "text-slate-400"} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="px-6 py-5 border-t border-cardborder">
        <p className="text-xs text-slate-400 leading-relaxed">
          Persona A · 40% Prototype
        </p>
      </div>
    </aside>
  );
}

export default Sidebar;
