"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";
export type NavLayout = "sidebar" | "horizontal";

interface Preferences {
  theme: Theme;
  navLayout: NavLayout;
}

interface PreferencesContextValue extends Preferences {
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setNavLayout: (layout: NavLayout) => void;
}

const STORAGE_KEY = "os-template-preferences";

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function readStoredPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        theme: parsed.theme === "dark" ? "dark" : "light",
        navLayout: parsed.navLayout === "horizontal" ? "horizontal" : "sidebar",
      };
    }
  } catch {
    // localStorage tidak tersedia / corrupt — pakai default
  }
  const prefersDark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return { theme: prefersDark ? "dark" : "light", navLayout: "sidebar" };
}

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<Preferences>({ theme: "light", navLayout: "sidebar" });

  useEffect(() => {
    const stored = readStoredPreferences();
    setPreferences(stored);
    applyTheme(stored.theme);
  }, []);

  const persist = (next: Preferences) => {
    setPreferences(next);
    applyTheme(next.theme);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // abaikan kalau localStorage penuh/diblokir
    }
  };

  const setTheme = (theme: Theme) => persist({ ...preferences, theme });
  const toggleTheme = () => persist({ ...preferences, theme: preferences.theme === "dark" ? "light" : "dark" });
  const setNavLayout = (navLayout: NavLayout) => persist({ ...preferences, navLayout });

  return (
    <PreferencesContext.Provider value={{ ...preferences, setTheme, toggleTheme, setNavLayout }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences harus dipakai di dalam <PreferencesProvider>");
  return ctx;
}
