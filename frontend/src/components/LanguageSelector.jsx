// src/components/LanguageSelector.jsx — Minimalist Globe dropdown for English, Hindi, and Marathi
import React, { useState, useRef, useEffect } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { useSettings } from "../context/SettingsContext";

export const LANGUAGES = [
  { code: "en", label: "English", native: "English", flag: "🇬🇧" },
  { code: "hi", label: "Hindi", native: "हिन्दी", flag: "🇮🇳" },
  { code: "mr", label: "Marathi", native: "मराठी", flag: "🇮🇳" },
];

export default function LanguageSelector({ className = "" }) {
  const { currentLanguage, setLanguage } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedLang = LANGUAGES.find((l) => l.code === currentLanguage) || LANGUAGES[0];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button: Glassmorphism pill */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Select Language"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 dark:bg-black/20 backdrop-blur-md border border-white/25 dark:border-white/10 hover:border-emerald-500/50 shadow-sm text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all cursor-pointer select-none group"
      >
        <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:rotate-12 transition-transform" />
        <span className="uppercase tracking-wider font-mono text-[11px]">
          {selectedLang.code}
        </span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-44 rounded-2xl bg-white/95 dark:bg-[#072418]/95 backdrop-blur-xl border border-slate-200/80 dark:border-emerald-800/60 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-zinc-400 border-b border-gray-100 dark:border-white/5">
            Select Language / भाषा
          </div>

          {LANGUAGES.map((lang) => {
            const isSelected = lang.code === currentLanguage;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  setLanguage(lang.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-left cursor-pointer ${
                  isSelected
                    ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 font-bold"
                    : "text-slate-700 dark:text-zinc-300 hover:bg-slate-100/70 dark:hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{lang.flag}</span>
                  <div>
                    <div className="leading-tight">{lang.native}</div>
                    <div className="text-[10px] text-zinc-400">{lang.label}</div>
                  </div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
