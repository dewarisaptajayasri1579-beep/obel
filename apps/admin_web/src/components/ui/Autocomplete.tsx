"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";

export interface AutocompleteProps {
  label?: string;
  value?: string;
  onChange?: (val: string) => void;
  suggestions?: string[];
  placeholder?: string;
  helperText?: string;
  error?: string;
  sizeVariant?: "sm" | "md" | "lg";
  className?: string;
}

export const Autocomplete: React.FC<AutocompleteProps> = ({
  label,
  value = "",
  onChange,
  suggestions = [],
  placeholder = "Cari...",
  helperText,
  error,
  sizeVariant = "lg",
  className = "",
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [filtered, setFiltered] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (onChange) onChange(val);

    if (val.trim()) {
      const filteredSuggestions = suggestions.filter((s) =>
        s.toLowerCase().includes(val.toLowerCase())
      );
      setFiltered(filteredSuggestions);
      setIsOpen(true);
    } else {
      setFiltered([]);
      setIsOpen(false);
    }
  };

  const handleSelect = (item: string) => {
    setInputValue(item);
    if (onChange) onChange(item);
    setIsOpen(false);
  };

  const sizeClasses = {
    sm: "h-10 text-xs pl-9 pr-3 rounded-xl",
    md: "h-12 text-sm pl-11 pr-4 rounded-xl",
    lg: "h-14 text-base pl-12 pr-4 rounded-2xl",
  };

  return (
    <div ref={containerRef} className={`w-full flex flex-col gap-1.5 relative ${className}`}>
      {label && (
        <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-fg-secondary select-none">
          {label}
        </span>
      )}
      <div className="relative flex items-center w-full">
        <div className="absolute left-4 pointer-events-none text-slate-600 dark:text-fg-muted flex items-center justify-center z-10">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          onFocus={() => {
            if (inputValue.trim()) setIsOpen(true);
          }}
          className={`w-full ${sizeClasses[sizeVariant]} bg-white/60 hover:bg-white/80 dark:bg-[var(--field-bg)] dark:hover:bg-[var(--field-bg)] border border-slate-200/80 dark:border-[rgba(148,163,184,0.14)] text-slate-800 dark:text-fg font-medium transition-all duration-200 focus:outline-none focus:bg-white/95 dark:focus:bg-[var(--field-bg)] focus:border-blue-600 dark:focus:border-[#3B82F6] focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-0 dark:focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12),0_0_16px_rgba(59,130,246,0.08)] backdrop-blur-md dark:backdrop-blur-none shadow-[0_2px_6px_rgba(0,0,0,0.02)] dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed ${
            error ? "border-red-500 focus:ring-red-500/10 focus:border-red-500" : ""
          }`}
        />
      </div>

      {/* Suggestion Dropdown */}
      {isOpen && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 glass-dropdown border border-slate-200/80 dark:border-line rounded-2xl shadow-xl z-50 max-h-56 overflow-y-auto p-1.5">
          {filtered.map((item, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(item)}
              className="w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-fg-secondary hover:bg-slate-100 dark:hover:bg-surface-hover transition-colors cursor-pointer"
            >
              {item}
            </button>
          ))}
        </div>
      )}
      
      {error ? (
        <span className="text-xs font-semibold text-red-500 dark:text-red-400">{error}</span>
      ) : helperText ? (
        <span className="text-xs font-medium text-slate-500 dark:text-fg-muted">{helperText}</span>
      ) : null}
    </div>
  );
};
