"use client";

import React from "react";
import { Calendar, ArrowRight } from "lucide-react";

export interface DateRangePickerProps {
  label?: string;
  startDateProps?: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;
  endDateProps?: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;
  helperText?: string;
  error?: string;
  sizeVariant?: "sm" | "md" | "lg";
  className?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  label,
  startDateProps,
  endDateProps,
  helperText,
  error,
  sizeVariant = "lg",
  className = "",
}) => {
  const sizeClasses = {
    sm: "h-10 text-xs pl-9 pr-3 rounded-xl",
    md: "h-12 text-sm pl-11 pr-4 rounded-xl",
    lg: "h-14 text-base pl-12 pr-4 rounded-2xl",
  };

  const sharedInputClass = `w-full dark:[color-scheme:dark] bg-white/60 hover:bg-white/80 dark:bg-[var(--field-bg)] dark:hover:bg-[var(--field-bg)] border border-slate-200/80 dark:border-[rgba(148,163,184,0.14)] text-slate-800 dark:text-fg font-medium transition-all duration-200 focus:outline-none focus:bg-white/95 dark:focus:bg-[var(--field-bg)] focus:border-blue-600 dark:focus:border-[#3B82F6] focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-0 dark:focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12),0_0_16px_rgba(59,130,246,0.08)] backdrop-blur-md dark:backdrop-blur-none shadow-[0_2px_6px_rgba(0,0,0,0.02)] dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed ${
    error ? "border-red-500 focus:ring-red-500/10 focus:border-red-500" : ""
  }`;

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-fg-secondary select-none">
          {label}
        </span>
      )}
      <div className="flex items-center gap-2 sm:gap-3 w-full">
        {/* Start Date */}
        <div className="relative flex items-center flex-1">
          <div className="absolute left-4 pointer-events-none text-slate-600 dark:text-fg-muted flex items-center justify-center z-10">
            <Calendar className="w-4 h-4" />
          </div>
          <input
            type="date"
            className={`${sharedInputClass} ${sizeClasses[sizeVariant]}`}
            {...startDateProps}
          />
        </div>

        {/* Separator */}
        <ArrowRight className="w-4 h-4 text-slate-400 dark:text-fg-muted flex-shrink-0" />

        {/* End Date */}
        <div className="relative flex items-center flex-1">
          <div className="absolute left-4 pointer-events-none text-slate-600 dark:text-fg-muted flex items-center justify-center z-10">
            <Calendar className="w-4 h-4" />
          </div>
          <input
            type="date"
            className={`${sharedInputClass} ${sizeClasses[sizeVariant]}`}
            {...endDateProps}
          />
        </div>
      </div>
      {error ? (
        <span className="text-xs font-semibold text-red-500 dark:text-red-400">{error}</span>
      ) : helperText ? (
        <span className="text-xs font-medium text-slate-500 dark:text-fg-muted">{helperText}</span>
      ) : null}
    </div>
  );
};
