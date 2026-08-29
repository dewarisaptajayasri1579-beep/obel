"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, SearchX, X } from "lucide-react";
import type { SelectOption } from "./Select";

export interface MultiSelectProps {
  label?: string;
  options: SelectOption[];
  value?: string[];
  onChange?: (values: string[]) => void;
  error?: string;
  helperText?: string;
  sizeVariant?: "sm" | "md" | "lg";
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Batas maksimal chip yang ditampilkan sebelum diringkas jadi "+N lainnya". */
  maxVisibleChips?: number;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  label,
  options,
  value = [],
  onChange,
  error,
  helperText,
  sizeVariant = "lg",
  placeholder = "Pilih beberapa",
  disabled,
  id,
  className = "",
  searchable = true,
  searchPlaceholder = "Cari...",
  emptyText = "Tidak ada hasil ditemukan",
  maxVisibleChips = 3,
}) => {
  const generatedId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  const listboxId = useId();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  // Portal ke document.body — sama alasannya dengan Select.tsx: ancestor pakai backdrop-filter
  // yang bikin stacking context, jadi panel lokal bisa kepotong/ketiban tanpa portal.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  const filteredOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const needle = query.trim().toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(needle));
  }, [options, query, searchable]);

  const selectedOptions = options.filter((opt) => value.includes(opt.value));

  const updateCoords = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.bottom + 8, left: rect.left, width: rect.width });
  };

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideWrapper = wrapperRef.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      if (!insideWrapper && !insidePanel) setOpen(false);
    };
    const handleReposition = () => updateCoords();
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open]);

  const openDropdown = () => {
    if (disabled) return;
    setQuery("");
    updateCoords();
    setOpen(true);
    if (searchable) requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const toggleValue = (opt: SelectOption) => {
    if (opt.disabled) return;
    const next = value.includes(opt.value) ? value.filter((v) => v !== opt.value) : [...value, opt.value];
    onChange?.(next);
  };

  const removeValue = (v: string) => {
    onChange?.(value.filter((x) => x !== v));
  };

  const sizeClasses = {
    sm: "min-h-10 text-xs px-2.5 py-1.5 rounded-xl",
    md: "min-h-12 text-sm px-3 py-2 rounded-xl",
    lg: "min-h-14 text-base px-3.5 py-2.5 rounded-2xl",
  };

  const visibleChips = selectedOptions.slice(0, maxVisibleChips);
  const hiddenCount = selectedOptions.length - visibleChips.length;

  return (
    <div className="w-full flex flex-col gap-1.5" ref={wrapperRef}>
      {label && (
        <label htmlFor={generatedId} className="text-xs sm:text-sm font-bold text-slate-700 dark:text-fg-secondary select-none">
          {label}
        </label>
      )}
      <div className="relative w-full">
        <button
          type="button"
          id={generatedId}
          ref={triggerRef}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          onClick={() => (open ? setOpen(false) : openDropdown())}
          className={`w-full flex items-center flex-wrap gap-1.5 ${sizeClasses[sizeVariant]} pr-10 bg-white/60 hover:bg-white/80 dark:bg-[var(--field-bg)] dark:hover:bg-[var(--field-bg)] border border-slate-200/80 dark:border-[rgba(148,163,184,0.14)] text-left transition-all duration-200 focus:outline-none focus:bg-white/95 dark:focus:bg-[var(--field-bg)] focus:border-blue-600 dark:focus:border-[#3B82F6] focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-0 dark:focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12),0_0_16px_rgba(59,130,246,0.08)] backdrop-blur-md dark:backdrop-blur-none shadow-[0_2px_6px_rgba(0,0,0,0.02)] dark:shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            open ? "bg-white/95 dark:bg-[var(--field-bg)] border-blue-600 ring-4 ring-blue-500/10" : ""
          } ${error ? "border-red-500 focus:ring-red-500/10 focus:border-red-500" : ""} ${className}`}
        >
          {selectedOptions.length === 0 ? (
            <span className="font-medium text-slate-400 dark:text-fg-muted">{placeholder}</span>
          ) : (
            <>
              {visibleChips.map((opt) => (
                <span
                  key={opt.value}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg bg-blue-500/15 text-blue-700 dark:text-[var(--accent-primary)] text-xs font-bold"
                >
                  {opt.label}
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeValue(opt.value);
                    }}
                    className="p-0.5 rounded hover:bg-blue-500/20 cursor-pointer"
                    aria-label={`Hapus ${opt.label}`}
                  >
                    <X className="w-3 h-3" />
                  </span>
                </span>
              ))}
              {hiddenCount > 0 && (
                <span className="inline-flex items-center px-2 py-1 rounded-lg bg-slate-500/15 text-slate-600 dark:text-fg-secondary text-xs font-bold">
                  +{hiddenCount} lainnya
                </span>
              )}
            </>
          )}
        </button>
        <div
          className={`absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-fg-muted flex items-center justify-center pointer-events-none transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          <ChevronDown className="w-5 h-5 stroke-[2.2]" />
        </div>
      </div>
      {error ? (
        <span className="text-xs font-semibold text-red-500 dark:text-red-400">{error}</span>
      ) : helperText ? (
        <span className="text-xs font-medium text-slate-500 dark:text-fg-muted">{helperText}</span>
      ) : null}

      {open &&
        coords &&
        mounted &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width }}
            className="z-50 rounded-2xl bg-white/95 dark:bg-[var(--field-bg)] backdrop-blur-xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.14)] shadow-2xl shadow-slate-900/10 overflow-hidden"
          >
            {searchable && (
              <div className="p-2 border-b border-slate-100 dark:border-[rgba(148,163,184,0.14)]">
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-slate-400 dark:text-fg-muted absolute left-3 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-[var(--field-bg)] border border-slate-200/80 dark:border-[rgba(148,163,184,0.14)] text-sm text-slate-800 dark:text-fg placeholder:text-slate-400 dark:placeholder:text-fg-muted font-medium focus:outline-none focus:bg-white dark:focus:bg-[var(--field-bg)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                  />
                </div>
              </div>
            )}
            <ul id={listboxId} role="listbox" aria-multiselectable="true" className="max-h-56 overflow-y-auto py-1.5 px-1.5 space-y-0.5">
              {filteredOptions.length === 0 ? (
                <li className="flex flex-col items-center justify-center gap-1.5 py-6 text-slate-400 dark:text-fg-muted">
                  <SearchX className="w-5 h-5" />
                  <span className="text-xs font-semibold">{emptyText}</span>
                </li>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = value.includes(opt.value);
                  return (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled}
                      onClick={() => toggleValue(opt)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${
                        opt.disabled
                          ? "opacity-40 cursor-not-allowed"
                          : isSelected
                          ? "bg-blue-50 dark:bg-blue-500/15 text-[#0544cc] dark:text-[var(--accent-primary)]"
                          : "text-slate-700 dark:text-fg-secondary hover:bg-slate-50 dark:hover:bg-surface-hover"
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 ${
                          isSelected ? "bg-[#0544cc] border-[#0544cc]" : "border-slate-300 dark:border-[rgba(148,163,184,0.14)]"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </span>
                      {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                      <span className="flex-1 min-w-0 truncate">{opt.label}</span>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
};

MultiSelect.displayName = "MultiSelect";
