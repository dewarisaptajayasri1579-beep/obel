"use client";

import React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  sizeVariant?: "sm" | "md" | "lg";
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { label, helperText, error, sizeVariant = "lg", className = "", disabled, id, rows = 4, ...props },
    ref
  ) => {
    const generatedId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    const sizeClasses = {
      sm: "min-h-[80px] text-xs px-3 py-2 rounded-xl",
      md: "min-h-[100px] text-sm px-4 py-2.5 rounded-xl",
      lg: "min-h-[120px] text-base px-4 py-3 rounded-2xl",
    };

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={generatedId} className="text-xs sm:text-sm font-bold text-slate-700 dark:text-fg-secondary select-none">
            {label}
          </label>
        )}
        <textarea
          id={generatedId}
          ref={ref}
          rows={rows}
          disabled={disabled}
          className={`w-full ${sizeClasses[sizeVariant]} bg-white/60 hover:bg-white/80 dark:bg-[var(--field-bg)] dark:hover:bg-[var(--field-bg)] border border-slate-200/80 dark:border-[rgba(148,163,184,0.14)] text-slate-800 dark:text-fg placeholder:text-slate-400 dark:placeholder:text-fg-muted font-medium transition-all duration-200 focus:outline-none focus:bg-white/95 dark:focus:bg-[var(--field-bg)] focus:border-blue-600 dark:focus:border-[#3B82F6] focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-0 dark:focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12),0_0_16px_rgba(59,130,246,0.08)] backdrop-blur-md dark:backdrop-blur-none shadow-[0_2px_6px_rgba(0,0,0,0.02)] dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed resize-y ${
            error ? "border-red-500 focus:ring-red-500/10 focus:border-red-500" : ""
          } ${className}`}
          {...props}
        />
        {error ? (
          <span className="text-xs font-semibold text-red-500 dark:text-red-400">{error}</span>
        ) : helperText ? (
          <span className="text-xs font-medium text-slate-500 dark:text-fg-muted">{helperText}</span>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
