"use client";

import React from "react";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, helperText, error, className = "", disabled, id, ...props }, ref) => {
    const generatedId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        <label
          htmlFor={generatedId}
          className={`inline-flex items-center gap-3 select-none ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span className="relative inline-flex items-center flex-shrink-0 w-11 h-6">
            <input
              id={generatedId}
              ref={ref}
              type="checkbox"
              role="switch"
              disabled={disabled}
              className={`peer appearance-none w-11 h-6 rounded-full bg-slate-300 dark:bg-surface-hover transition-all duration-200 checked:bg-[#0544cc] focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed ${
                error ? "ring-2 ring-red-500/40" : ""
              } ${className}`}
              {...props}
            />
            <span className="pointer-events-none absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-5" />
          </span>
          {label && <span className="text-sm font-semibold text-slate-700 dark:text-fg-secondary">{label}</span>}
        </label>
        {error ? (
          <span className="text-xs font-semibold text-red-500 dark:text-red-400">{error}</span>
        ) : helperText ? (
          <span className="text-xs font-medium text-slate-500 dark:text-fg-muted">{helperText}</span>
        ) : null}
      </div>
    );
  }
);

Switch.displayName = "Switch";
