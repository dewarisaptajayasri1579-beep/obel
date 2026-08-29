"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";

export interface DropdownItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
  className?: string;
}

/** Menu aksi generik (dipakai mis. untuk "Edit / Hapus" di baris tabel). Panel di-portal ke
 *  document.body seperti Select.tsx supaya tidak ketiban stacking context backdrop-filter. */
export const Dropdown: React.FC<DropdownProps> = ({ trigger, items, align = "right", className = "" }) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const updateCoords = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.bottom + 6, left: align === "right" ? rect.right : rect.left });
  };

  useEffect(() => {
    if (!open) return;
    updateCoords();
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleReposition = () => updateCoords();
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={triggerRef} className={`inline-flex ${className}`}>
      <div onClick={() => setOpen((v) => !v)} className="cursor-pointer">
        {trigger}
      </div>

      {open &&
        mounted &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: coords.top, left: coords.left, transform: align === "right" ? "translateX(-100%)" : undefined }}
            className="fixed z-[70] min-w-[180px] py-1.5 rounded-2xl glass-dropdown shadow-xl border border-white/80 dark:border-line"
          >
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    item.danger
                      ? "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                      : "text-slate-700 dark:text-fg-secondary hover:bg-slate-100 dark:hover:bg-surface-hover"
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
};
