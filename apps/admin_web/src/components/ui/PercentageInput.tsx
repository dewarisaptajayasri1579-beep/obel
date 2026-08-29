"use client";

import React from "react";
import { Percent } from "lucide-react";

export interface PercentageInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: string;
  value?: number | string;
  onChangeValue?: (val: number) => void;
  helperText?: string;
  error?: string;
  sizeVariant?: "sm" | "md" | "lg";
}

export const PercentageInput = React.forwardRef<HTMLInputElement, PercentageInputProps>(
  ({ label, value = "", onChangeValue, helperText, error, sizeVariant = "lg", className = "", ...props }, ref) => {
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      if (onChangeValue) {
        onChangeValue(isNaN(val) ? 0 : val);
      }
    };

    const sizeClasses = {
      sm: "h-10 text-xs pl-3 pr-9 rounded-xl",
      md: "h-12 text-sm pl-4 pr-11 rounded-xl",
      lg: "h-14 text-base pl-4 pr-12 rounded-2xl",
    };

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-fg-secondary select-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          <input
            ref={ref}
            type="number"
            value={value}
            onChange={handleInputChange}
            min="0"
            max="100"
            step="any"
            className={`w-full ${sizeClasses[sizeVariant]} bg-white/60 hover:bg-white/80 dark:bg-[var(--field-bg)] dark:hover:bg-[var(--field-bg)] border border-slate-200/80 dark:border-[rgba(148,163,184,0.14)] text-slate-800 dark:text-fg placeholder:text-slate-400 dark:placeholder:text-fg-muted font-medium transition-all duration-200 focus:outline-none focus:bg-white/95 dark:focus:bg-[var(--field-bg)] focus:border-blue-600 dark:focus:border-[#3B82F6] focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-0 dark:focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12),0_0_16px_rgba(59,130,246,0.08)] backdrop-blur-md dark:backdrop-blur-none shadow-[0_2px_6px_rgba(0,0,0,0.02)] dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed ${
              error ? "border-red-500 focus:ring-red-500/10 focus:border-red-500" : ""
            } ${className}`}
            {...props}
          />
          <div className="absolute right-4 text-slate-600 dark:text-fg-muted pointer-events-none flex items-center justify-center z-10">
            <Percent className="w-4 h-4" />
          </div>
        </div>
        {error ? (
          <span className="text-xs font-semibold text-red-500 dark:text-red-400">{error}</span>
        ) : helperText ? (
          <span className="text-xs font-medium text-slate-500 dark:text-fg-muted">{helperText}</span>
        ) : null}
      </div>
    );
  }
);

PercentageInput.displayName = "PercentageInput";
