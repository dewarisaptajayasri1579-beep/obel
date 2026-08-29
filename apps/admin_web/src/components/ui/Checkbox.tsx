"use client";

import React from "react";
import { Check } from "lucide-react";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, helperText, error, className = "", disabled, id, ...props }, ref) => {
    const generatedId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        <label
          htmlFor={generatedId}
          className={`inline-flex items-center gap-2.5 select-none ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span className="relative inline-flex items-center justify-center w-5 h-5 flex-shrink-0">
            <input
              id={generatedId}
              ref={ref}
              type="checkbox"
              disabled={disabled}
              className={`peer appearance-none w-5 h-5 rounded-lg border border-slate-300 dark:border-[rgba(148,163,184,0.14)] bg-white/70 dark:bg-[var(--field-bg)] transition-all duration-200 checked:bg-[#0544cc] checked:border-[#0544cc] focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed ${
                error ? "border-red-500" : ""
              } ${className}`}
              {...props}
            />
            <Check className="pointer-events-none absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
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

Checkbox.displayName = "Checkbox";
