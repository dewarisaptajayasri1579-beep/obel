"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Search } from "lucide-react";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  label?: string;
  value?: string;
  onChange?: (val: string) => void;
  options?: SearchableSelectOption[];
  placeholder?: string;
  helperText?: string;
  error?: string;
  sizeVariant?: "sm" | "md" | "lg";
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  value = "",
  onChange,
  options = [],
  placeholder = "Pilih opsi...",
  helperText,
  error,
  sizeVariant = "lg",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (val: string) => {
    if (onChange) onChange(val);
    setIsOpen(false);
    setSearchTerm("");
  };

  const sizeClasses = {
    sm: "h-10 text-xs px-3 rounded-xl",
    md: "h-12 text-sm px-4 rounded-xl",
    lg: "h-14 text-base px-4 rounded-2xl",
  };

  return (
    <div ref={containerRef} className={`w-full flex flex-col gap-1.5 relative ${className}`}>
      {label && (
        <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-fg-secondary select-none">
          {label}
        </span>
      )}
      
      {/* Select Box Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between text-left ${sizeClasses[sizeVariant]} bg-white/60 hover:bg-white/80 dark:bg-[var(--field-bg)] dark:hover:bg-[var(--field-bg)] border border-slate-200/80 dark:border-[rgba(148,163,184,0.14)] text-slate-800 dark:text-fg font-medium transition-all duration-200 focus:outline-none focus:bg-white/95 dark:focus:bg-[var(--field-bg)] focus:border-blue-600 dark:focus:border-[#3B82F6] focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-0 dark:focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12),0_0_16px_rgba(59,130,246,0.08)] backdrop-blur-md dark:backdrop-blur-none shadow-[0_2px_6px_rgba(0,0,0,0.02)] dark:shadow-none cursor-pointer ${
          error ? "border-red-500 focus:ring-red-500/10" : ""
        }`}
      >
        <span className={selectedOption ? "" : "text-slate-400 dark:text-fg-muted font-normal"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-fg-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Container */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 glass-dropdown border border-slate-200/80 dark:border-line rounded-2xl shadow-xl z-50 p-2 flex flex-col gap-2">
          {/* Search Input inside Dropdown */}
          <div className="relative flex items-center w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-fg-muted absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari..."
              className="w-full h-9 pl-9 pr-3 text-xs font-semibold rounded-xl bg-slate-100/50 dark:bg-black/20 border border-slate-200/80 dark:border-line text-slate-800 dark:text-fg placeholder:text-slate-400 dark:placeholder:text-fg-muted focus:outline-none focus:border-blue-500 dark:focus:border-[#3B82F6]"
            />
          </div>

          {/* List Options */}
          <div className="max-h-48 overflow-y-auto flex flex-col p-0.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                    opt.value === value
                      ? "bg-blue-500/10 text-blue-700 dark:bg-[rgba(59,130,246,0.10)] dark:text-[#60A5FA]"
                      : "text-slate-700 dark:text-fg-secondary hover:bg-slate-100 dark:hover:bg-surface-hover"
                  }`}
                >
                  {opt.label}
                </button>
              ))
            ) : (
              <span className="text-center py-4 text-xs font-medium text-slate-400 dark:text-fg-disabled">
                Tidak ada opsi ditemukan
              </span>
            )}
          </div>
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
