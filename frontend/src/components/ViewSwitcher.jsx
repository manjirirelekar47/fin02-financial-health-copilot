// src/components/ViewSwitcher.jsx — Multi-horizon view switcher with calibration grade chips
import React from "react";
import { Calendar, Clock, BarChart2, CalendarRange } from "lucide-react";

export const HORIZON_VIEWS = [
  {
    id: "weekly",
    label: "Weekly",
    detail: "8 periods",
    grade: "Decision-grade",
    gradeColor: "bg-emerald-500/10 text-emerald-800 border-emerald-300",
    icon: Clock,
  },
  {
    id: "monthly",
    label: "Monthly",
    detail: "6 periods",
    grade: "Planning-grade",
    gradeColor: "bg-blue-500/10 text-blue-800 border-blue-300",
    icon: Calendar,
  },
  {
    id: "sixmonth",
    label: "6-Month Summary",
    detail: "26 weeks",
    grade: "Planning-grade",
    gradeColor: "bg-blue-500/10 text-blue-800 border-blue-300",
    icon: BarChart2,
  },
  {
    id: "yearly",
    label: "Yearly",
    detail: "12 months",
    grade: "Indicative",
    gradeColor: "bg-purple-500/10 text-purple-800 border-purple-300",
    icon: CalendarRange,
  },
];

export default function ViewSwitcher({ currentView = "weekly", onViewChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200">
      {HORIZON_VIEWS.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onViewChange?.(item.id)}
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
              isActive
                ? "bg-white text-navy font-semibold shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:text-navy hover:bg-white/60"
            }`}
          >
            <Icon size={14} className={isActive ? "text-accent" : "text-slate-400"} />
            <div className="flex items-center gap-1.5">
              <span>{item.label}</span>
              <span className="text-[10px] text-slate-400 font-normal">({item.detail})</span>
            </div>
            <span
              className={`px-1.5 py-0.5 text-[10px] rounded-md border font-semibold tracking-wide ${item.gradeColor}`}
            >
              {item.grade}
            </span>
          </button>
        );
      })}
    </div>
  );
}
