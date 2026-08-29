"use client";

import React from "react";

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: string;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ label, className = "", disabled, id, ...props }, ref) => {
    const generatedId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <label
        htmlFor={generatedId}
        className={`inline-flex items-center gap-2.5 select-none ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className="relative inline-flex items-center justify-center w-5 h-5 flex-shrink-0">
          <input
            id={generatedId}
            ref={ref}
            type="radio"
            disabled={disabled}
            className={`peer appearance-none w-5 h-5 rounded-full border border-slate-300 dark:border-[rgba(148,163,184,0.14)] bg-white/70 dark:bg-[var(--field-bg)] transition-all duration-200 checked:border-[#0544cc] checked:border-[5px] focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed ${className}`}
            {...props}
          />
        </span>
        {label && <span className="text-sm font-semibold text-slate-700 dark:text-fg-secondary">{label}</span>}
      </label>
    );
  }
);

Radio.displayName = "Radio";

export interface RadioOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  helperText?: string;
  error?: string;
  direction?: "row" | "column";
  className?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  options,
  value,
  onChange,
  label,
  helperText,
  error,
  direction = "column",
  className = "",
}) => {
  return (
    <div className={`w-full flex flex-col gap-2 ${className}`}>
      {label && <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-fg-secondary select-none">{label}</span>}
      <div className={`flex gap-x-5 gap-y-2.5 ${direction === "row" ? "flex-row flex-wrap" : "flex-col"}`}>
        {options.map((option) => (
          <Radio
            key={option.value}
            name={name}
            label={option.label}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onChange?.(option.value)}
          />
        ))}
      </div>
      {error ? (
        <span className="text-xs font-semibold text-red-500 dark:text-red-400">{error}</span>
      ) : helperText ? (
        <span className="text-xs font-medium text-slate-500 dark:text-fg-muted">{helperText}</span>
      ) : null}
    </div>
  );
};
