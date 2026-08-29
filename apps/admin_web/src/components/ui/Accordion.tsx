"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface AccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
  defaultOpenIds?: string[];
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({ items, allowMultiple = false, defaultOpenIds = [], className = "" }) => {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(defaultOpenIds));

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(allowMultiple ? prev : []);
      if (prev.has(id)) {
        if (allowMultiple) next.delete(id);
        // kalau bukan allowMultiple dan diklik ulang, biarkan tertutup semua (next sudah kosong)
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      {items.map((item) => {
        const isOpen = openIds.has(item.id);
        return (
          <div key={item.id} className="rounded-2xl border border-slate-200/80 dark:border-line bg-white/70 dark:bg-surface backdrop-blur-md overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(item.id)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left font-bold text-sm text-slate-800 dark:text-fg hover:bg-slate-50/70 dark:hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <span>{item.title}</span>
              <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-fg-muted flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 text-sm text-slate-600 dark:text-fg-muted font-medium leading-relaxed border-t border-slate-100 dark:border-line">
                <div className="pt-3">{item.content}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
