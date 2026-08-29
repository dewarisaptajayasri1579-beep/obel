"use client";

import React, { useState, useEffect } from "react";

export interface InputMaskProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "size"> {
  label?: string;
  mask: string; // e.g. "9999-9999-9999-9999" or "999-999-999"
  value?: string;
  onChange?: (val: string) => void;
  helperText?: string;
  error?: string;
  sizeVariant?: "sm" | "md" | "lg";
}

export const InputMask = React.forwardRef<HTMLInputElement, InputMaskProps>(
  ({ label, mask, value = "", onChange, helperText, error, sizeVariant = "lg", className = "", ...props }, ref) => {
    const [inputValue, setInputValue] = useState("");

    const formatValue = (val: string, maskPattern: string): string => {
      // Remove all formatting first
      const cleanVal = val.replace(/\D/g, "");
      let formatted = "";
      let valIndex = 0;

      for (let i = 0; i < maskPattern.length; i++) {
        if (valIndex >= cleanVal.length) break;
        const char = maskPattern[i];

        if (char === "9") {
          formatted += cleanVal[valIndex];
          valIndex++;
        } else {
          formatted += char;
        }
      }
      return formatted;
    };

    useEffect(() => {
      setInputValue(formatValue(value, mask));
    }, [value, mask]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const formatted = formatValue(val, mask);
      setInputValue(formatted);
      if (onChange) {
        onChange(formatted.replace(/\D/g, "")); // Return unmasked/raw value
      }
    };

    const sizeClasses = {
      sm: "h-10 text-xs px-3 rounded-xl",
      md: "h-12 text-sm px-4 rounded-xl",
      lg: "h-14 text-base px-4 rounded-2xl",
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
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            className={`w-full ${sizeClasses[sizeVariant]} bg-white/60 hover:bg-white/80 dark:bg-[var(--field-bg)] dark:hover:bg-[var(--field-bg)] border border-slate-200/80 dark:border-[rgba(148,163,184,0.14)] text-slate-800 dark:text-fg placeholder:text-slate-400 dark:placeholder:text-fg-muted font-medium transition-all duration-200 focus:outline-none focus:bg-white/95 dark:focus:bg-[var(--field-bg)] focus:border-blue-600 dark:focus:border-[#3B82F6] focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-0 dark:focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12),0_0_16px_rgba(59,130,246,0.08)] backdrop-blur-md dark:backdrop-blur-none shadow-[0_2px_6px_rgba(0,0,0,0.02)] dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed ${
              error ? "border-red-500 focus:ring-red-500/10 focus:border-red-500" : ""
            } ${className}`}
            {...props}
          />
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

InputMask.displayName = "InputMask";
