"use client";

import React, { useState, useEffect } from "react";
import { Pipette } from "lucide-react";

export interface ColorPickerProps {
  label?: string;
  value?: string;
  onChange?: (color: string) => void;
  helperText?: string;
  error?: string;
  sizeVariant?: "sm" | "md" | "lg";
  className?: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  label,
  value = "#3b82f6",
  onChange,
  helperText,
  error,
  sizeVariant = "lg",
  className = "",
}) => {
  const [color, setColor] = useState(value);

  useEffect(() => {
    setColor(value);
  }, [value]);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setColor(val);
    if (onChange) onChange(val);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setColor(val);
    if (onChange && /^#[0-9A-F]{6}$/i.test(val)) {
      onChange(val);
    }
  };

  const sizeClasses = {
    sm: "h-10 text-xs rounded-xl px-2 gap-2",
    md: "h-12 text-sm rounded-xl px-3 gap-3",
    lg: "h-14 text-base rounded-2xl px-3 gap-3",
  };

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-fg-secondary select-none">
          {label}
        </span>
      )}
      <div
        className={`flex items-center w-full bg-white/60 hover:bg-white/80 dark:bg-[var(--field-bg)] dark:hover:bg-[var(--field-bg)] border border-slate-200/80 dark:border-[rgba(148,163,184,0.14)] transition-all duration-200 focus-within:bg-white/95 dark:focus-within:bg-[var(--field-bg)] focus-within:border-blue-600 dark:focus-within:border-[#3B82F6] focus-within:ring-4 focus-within:ring-blue-500/10 dark:focus-within:ring-0 dark:focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.12),0_0_16px_rgba(59,130,246,0.08)] backdrop-blur-md dark:backdrop-blur-none shadow-[0_2px_6px_rgba(0,0,0,0.02)] dark:shadow-none ${
          error ? "border-red-500 focus-within:ring-red-500/10 focus-within:border-red-500" : ""
        } ${sizeClasses[sizeVariant]}`}
      >
        {/* Color Preview Block and Picker */}
        <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-slate-200 dark:border-line flex items-center justify-center cursor-pointer shadow-xs">
          <input
            type="color"
            value={color}
            onChange={handleColorChange}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
          <div
            className="w-full h-full"
            style={{ backgroundColor: color }}
          />
        </div>

        {/* Text Input */}
        <input
          type="text"
          value={color.toUpperCase()}
          onChange={handleTextChange}
          className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-fg font-mono font-semibold"
          placeholder="#FFFFFF"
        />

        <Pipette className="w-4 h-4 text-slate-400 dark:text-fg-muted mr-1 flex-shrink-0" />
      </div>
      {error ? (
        <span className="text-xs font-semibold text-red-500 dark:text-red-400">{error}</span>
      ) : helperText ? (
        <span className="text-xs font-medium text-slate-500 dark:text-fg-muted">{helperText}</span>
      ) : null}
    </div>
  );
};
