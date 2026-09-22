"use client";

import { Check, Moon, PanelLeft, Rows3, Sun } from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Card } from "@/components/ui/Card";
import { ACCENT_OPTIONS, usePreferences } from "@/components/providers/PreferencesProvider";

/// Pratinjau mini: pil menu aktif + tombol, dirender dengan token brand yang
/// SAMA seperti sidebar/tombol sungguhan — supaya swatch tidak cuma menebak
/// warnanya, tapi menunjukkan wujud aslinya di layar sebelum dipilih.
function PratinjauAksen() {
  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface p-4 space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-fg-muted">
        Pratinjau
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold shadow-md shadow-black/20">
          Menu aktif
        </span>
        <span className="inline-flex items-center px-4 py-2 rounded-xl bg-brand-700 text-white text-sm font-semibold shadow-sm">
          Tombol utama
        </span>
        <span className="inline-flex items-center px-3 py-2 rounded-xl border-2 border-brand-700 text-brand-700 dark:border-[var(--accent-primary)] dark:text-[var(--accent-primary)] text-sm font-semibold">
          Tombol garis
        </span>
        <a className="text-sm font-semibold text-brand-700 dark:text-[var(--accent-primary)] hover:underline cursor-pointer">
          Tautan
        </a>
      </div>
    </div>
  );
}

function PengaturanTampilanContent() {
  const { theme, toggleTheme, navLayout, setNavLayout, accent, setAccent } = usePreferences();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Pengaturan" },
          { label: "Tampilan" },
        ]}
      />

      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Tampilan</h1>
        <p className="text-sm text-slate-500 dark:text-fg-muted">
          Warna aksen, tema, dan tata letak menu. Tersimpan di perangkat ini saja.
        </p>
      </div>

      {/* ── Warna Aksen ─────────────────────────────────────────────── */}
      <Card variant="solid" padding="lg" className="!rounded-xl !shadow-2xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-fg">Warna Aksen</h2>
          <p className="text-xs text-slate-500 dark:text-fg-muted mt-0.5">
            Mengubah warna sidebar, tombol, dan tautan di seluruh aplikasi. Status seperti{" "}
            <span className="font-semibold">Aktif</span>/<span className="font-semibold">Lunas</span>{" "}
            tetap hijau apa pun aksen yang dipilih, supaya artinya tidak pernah ambigu.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {ACCENT_OPTIONS.map((opt) => {
            const dipilih = accent === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAccent(opt.value)}
                aria-pressed={dipilih}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                  dipilih
                    ? "border-brand-700 dark:border-[var(--accent-primary)] bg-brand-50 dark:bg-brand-500/10 ring-2 ring-brand-700/20 dark:ring-[var(--accent-primary)]/25"
                    : "border-slate-200/90 dark:border-line hover:border-slate-300 dark:hover:border-line-strong bg-white dark:bg-surface"
                }`}
              >
                <span
                  className="w-8 h-8 rounded-lg flex-shrink-0 border border-black/10 shadow-inner flex items-center justify-center"
                  style={{ backgroundColor: opt.swatch }}
                >
                  {dipilih && <Check className="w-4 h-4 text-white" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-slate-800 dark:text-fg truncate">
                    {opt.label}
                  </span>
                  <span className="block text-[10px] font-mono text-slate-400 dark:text-fg-muted">
                    {opt.swatch}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <PratinjauAksen />
      </Card>

      {/* ── Tema ────────────────────────────────────────────────────── */}
      <Card variant="solid" padding="lg" className="!rounded-xl !shadow-2xs space-y-3">
        <h2 className="text-sm font-bold text-slate-800 dark:text-fg">Tema</h2>
        <div className="flex items-center gap-2.5">
          {(
            [
              { value: "light" as const, label: "Terang", icon: Sun },
              { value: "dark" as const, label: "Gelap", icon: Moon },
            ]
          ).map(({ value, label, icon: Icon }) => {
            const dipilih = theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  if (theme !== value) toggleTheme();
                }}
                aria-pressed={dipilih}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                  dipilih
                    ? "bg-brand-700 text-white border-brand-700 shadow-sm"
                    : "border-slate-200/90 dark:border-line text-slate-700 dark:text-fg-secondary hover:bg-slate-50 dark:hover:bg-surface-hover"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── Tata Letak Menu ─────────────────────────────────────────── */}
      <Card variant="solid" padding="lg" className="!rounded-xl !shadow-2xs space-y-3">
        <h2 className="text-sm font-bold text-slate-800 dark:text-fg">Tata Letak Menu</h2>
        <div className="flex items-center gap-2.5">
          {(
            [
              { value: "sidebar" as const, label: "Sidebar", icon: PanelLeft },
              { value: "horizontal" as const, label: "Menu Atas", icon: Rows3 },
            ]
          ).map(({ value, label, icon: Icon }) => {
            const dipilih = navLayout === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setNavLayout(value)}
                aria-pressed={dipilih}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                  dipilih
                    ? "bg-brand-700 text-white border-brand-700 shadow-sm"
                    : "border-slate-200/90 dark:border-line text-slate-700 dark:text-fg-secondary hover:bg-slate-50 dark:hover:bg-surface-hover"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

export default function PengaturanTampilanPage() {
  return (
    <RequireAuth>
      <PengaturanTampilanContent />
    </RequireAuth>
  );
}
