// src/components/Sidebar.jsx
// Left navigation. Purely presentational + a click handler — App.jsx owns
// which tab is active and what's shown.
//
// Branding: the SpendShield shield mark (public/logo-icon.png) plus a
// two-tone wordmark that mirrors the logo — "Spend" in the deep brand green,
// "Shield" in the lighter green gradient.
//
// Props:
//   tabs      - array of { id, label, icon } in the order they should render
//   activeTab - id of the currently selected tab
//   onSelect  - (id) => void

function Sidebar({ tabs, activeTab, onSelect }) {
  return (
    <aside className="w-64 bg-white/70 backdrop-blur-xl border-r border-cardborder flex flex-col h-screen shrink-0 sticky top-0">
      <div className="px-5 py-6 flex items-center gap-3">
        <img
          src="/logo-icon.png"
          alt="SpendShield logo"
          className="w-11 h-11 object-contain shrink-0 drop-shadow-sm"
        />
        <span className="text-[22px] font-display font-extrabold tracking-tight leading-none">
          <span className="text-navy">Spend</span>
          <span className="bg-gradient-to-r from-[#1D604C] to-[#3FA873] bg-clip-text text-transparent">
            Shield
          </span>
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
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                isActive
                  ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-navy font-semibold shadow-sm ring-1 ring-emerald-600/15"
                  : "text-slate-500 hover:bg-emerald-500/10 hover:text-navy"
              }`}
            >
              <Icon size={17} className={isActive ? "text-accent" : "text-slate-400"} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="px-6 py-5 border-t border-cardborder">
        <p className="text-xs font-semibold text-navy/80">Simulate the consequences.</p>
        <p className="text-xs font-semibold text-accent">Then decide.</p>
        <p className="text-[11px] text-slate-400 leading-relaxed mt-2">Persona A · 40% Prototype</p>
      </div>
    </aside>
  );
}

export default Sidebar;
