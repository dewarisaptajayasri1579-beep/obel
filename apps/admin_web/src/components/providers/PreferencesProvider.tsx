"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";
export type NavLayout = "sidebar" | "horizontal";

/// Palet warna aksen. "hijau" adalah bawaan — SENGAJA tidak punya selector
/// CSS sendiri (lihat globals.css `:root`); memilihnya berarti melepas
/// atribut `data-accent`, bukan menyetelnya ke suatu nilai. Palet lain
/// masing-masing punya `:root[data-accent="..."]` yang mendefinisikan ulang
/// skala --brand-50..900.
export type Accent = "hijau" | "teal" | "blue" | "violet" | "coffee" | "maroon";

export const ACCENT_OPTIONS: { value: Accent; label: string; swatch: string }[] = [
  { value: "hijau", label: "Hijau Obbel", swatch: "#0B5D34" },
  { value: "teal", label: "Teal", swatch: "#135952" },
  { value: "blue", label: "Biru Klasik", swatch: "#0544CC" },
  { value: "violet", label: "Ungu", swatch: "#443167" },
  { value: "coffee", label: "Cokelat Kopi", swatch: "#50381D" },
  { value: "maroon", label: "Marun", swatch: "#56262B" },
];

interface Preferences {
  theme: Theme;
  navLayout: NavLayout;
  accent: Accent;
}

interface PreferencesContextValue extends Preferences {
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setNavLayout: (layout: NavLayout) => void;
  setAccent: (accent: Accent) => void;
}

const STORAGE_KEY = "os-template-preferences";
const ACCENT_VALUES: Accent[] = ACCENT_OPTIONS.map((o) => o.value);

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function applyAccent(accent: Accent) {
  // "hijau" = tidak ada atribut sama sekali, bukan data-accent="hijau" —
  // konsisten dengan THEME_INIT_SCRIPT di layout.tsx yang membaca localStorage
  // SEBELUM React jalan, supaya tidak ada kedipan warna saat memuat ulang.
  if (accent === "hijau") document.documentElement.removeAttribute("data-accent");
  else document.documentElement.setAttribute("data-accent", accent);
}

function readStoredPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        theme: parsed.theme === "dark" ? "dark" : "light",
        navLayout: parsed.navLayout === "horizontal" ? "horizontal" : "sidebar",
        accent: ACCENT_VALUES.includes(parsed.accent) ? parsed.accent : "hijau",
      };
    }
  } catch {
    // localStorage tidak tersedia / corrupt — pakai default
  }
  const prefersDark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return { theme: prefersDark ? "dark" : "light", navLayout: "sidebar", accent: "hijau" };
}

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<Preferences>({
    theme: "light",
    navLayout: "sidebar",
    accent: "hijau",
  });

  useEffect(() => {
    const stored = readStoredPreferences();
    setPreferences(stored);
    applyTheme(stored.theme);
    applyAccent(stored.accent);
  }, []);

  const persist = (next: Preferences) => {
    setPreferences(next);
    applyTheme(next.theme);
    applyAccent(next.accent);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // abaikan kalau localStorage penuh/diblokir
    }
  };

  const setTheme = (theme: Theme) => persist({ ...preferences, theme });
  const toggleTheme = () => persist({ ...preferences, theme: preferences.theme === "dark" ? "light" : "dark" });
  const setNavLayout = (navLayout: NavLayout) => persist({ ...preferences, navLayout });
  const setAccent = (accent: Accent) => persist({ ...preferences, accent });

  return (
    <PreferencesContext.Provider value={{ ...preferences, setTheme, toggleTheme, setNavLayout, setAccent }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences harus dipakai di dalam <PreferencesProvider>");
  return ctx;
}
