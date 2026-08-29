"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react";

export type ToastVariant = "info" | "success" | "warning" | "error";

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  show: (variant: ToastVariant, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_CONFIG: Record<ToastVariant, { bg: string; icon: React.FC<{ className?: string }> }> = {
  info: { bg: "bg-sky-50/95 dark:bg-elevated border-sky-200/90 dark:border-sky-500/30 text-sky-900 dark:text-sky-200", icon: Info },
  success: { bg: "bg-emerald-50/95 dark:bg-elevated border-emerald-200/90 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200", icon: CheckCircle2 },
  warning: { bg: "bg-amber-50/95 dark:bg-elevated border-amber-200/90 dark:border-amber-500/30 text-amber-900 dark:text-amber-200", icon: AlertTriangle },
  error: { bg: "bg-rose-50/95 dark:bg-elevated border-rose-200/90 dark:border-rose-500/30 text-rose-900 dark:text-rose-200", icon: AlertCircle },
};

const ICON_COLOR: Record<ToastVariant, string> = {
  info: "text-sky-600 dark:text-sky-400",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  error: "text-rose-600 dark:text-rose-400",
};

const DEFAULT_DURATION_MS = 4000;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, variant, message }]);
      setTimeout(() => dismiss(id), DEFAULT_DURATION_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none">
            {toasts.map((t) => {
              const config = VARIANT_CONFIG[t.variant];
              const Icon = config.icon;
              return (
                <div
                  key={t.id}
                  className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-md shadow-xl ${config.bg}`}
                  role="status"
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${ICON_COLOR[t.variant]}`} />
                  <p className="flex-1 text-xs sm:text-sm font-semibold leading-relaxed">{t.message}</p>
                  <button
                    onClick={() => dismiss(t.id)}
                    className="text-slate-400 dark:text-fg-muted hover:text-slate-600 dark:hover:text-fg p-1 rounded-lg transition-colors cursor-pointer"
                    aria-label="Tutup notifikasi"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast harus dipakai di dalam <ToastProvider>");

  return {
    info: (message: string) => ctx.show("info", message),
    success: (message: string) => ctx.show("success", message),
    warning: (message: string) => ctx.show("warning", message),
    error: (message: string) => ctx.show("error", message),
  };
}
