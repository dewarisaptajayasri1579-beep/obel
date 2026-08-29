import React from "react";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react";

export interface AlertProps {
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = "info",
  title,
  children,
  onClose,
  className = "",
}) => {
  const configs = {
    info: {
      bg: "bg-sky-50/90 dark:bg-sky-500/10 border-sky-200/90 dark:border-sky-500/30 text-sky-900 dark:text-sky-200",
      icon: <Info className="w-5 h-5 text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" />,
    },
    success: {
      bg: "bg-emerald-50/90 dark:bg-emerald-500/10 border-emerald-200/90 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200",
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />,
    },
    warning: {
      bg: "bg-amber-50/90 dark:bg-amber-500/10 border-amber-200/90 dark:border-amber-500/30 text-amber-900 dark:text-amber-200",
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />,
    },
    error: {
      bg: "bg-rose-50/90 dark:bg-rose-500/10 border-rose-200/90 dark:border-rose-500/30 text-rose-900 dark:text-rose-200",
      icon: <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />,
    },
  };

  const config = configs[variant];

  return (
    <div
      className={`p-4 rounded-2xl border backdrop-blur-md flex items-start gap-3 shadow-xs ${config.bg} ${className}`}
    >
      {config.icon}
      <div className="flex-1">
        {title && <h4 className="font-bold text-sm mb-1">{title}</h4>}
        <div className="text-xs sm:text-sm font-medium leading-relaxed">{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-slate-400 dark:text-fg-muted hover:text-slate-600 dark:hover:text-fg p-1 rounded-lg transition-colors cursor-pointer"
          aria-label="Tutup alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
