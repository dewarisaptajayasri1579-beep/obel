import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = "" }) => {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center flex-wrap gap-1.5 text-xs sm:text-sm font-semibold ${className}`}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-fg-muted" />}
            {item.href && !isLast ? (
              <Link href={item.href} className="text-slate-500 dark:text-fg-muted hover:text-blue-700 dark:hover:text-[var(--accent-highlight)] transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-slate-800 dark:text-fg" : "text-slate-500 dark:text-fg-muted"}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
};
