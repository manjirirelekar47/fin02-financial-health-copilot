// src/context/SettingsContext.jsx — Global Settings Context for Language and Voice Command
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { translations, translateText } from "../utils/translations";

const SettingsContext = createContext(null);

export const TRANSLATIONS = translations;

export function SettingsProvider({ children }) {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("spendshield_lang") || "en";
    }
    return "en";
  });

  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("spendshield_lang", currentLanguage);
      document.documentElement.lang = currentLanguage;
    }
  }, [currentLanguage]);

  const showToast = (message, duration = 4000) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, duration);
  };

  /**
   * t(key) helper function that takes an English string or key
   * and returns the translated string based on currentLanguage state.
   */
  const t = useCallback(
    (key) => {
      return translateText(key, currentLanguage);
    },
    [currentLanguage]
  );

  return (
    <SettingsContext.Provider
      value={{
        currentLanguage,
        setLanguage: setCurrentLanguage,
        isVoiceActive,
        setIsVoiceActive,
        toastMessage,
        showToast,
        t,
        translations,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    return {
      currentLanguage: "en",
      setLanguage: () => {},
      isVoiceActive: false,
      setIsVoiceActive: () => {},
      toastMessage: null,
      showToast: () => {},
      t: (key) => translateText(key, "en"),
      translations,
    };
  }
  return context;
}
