"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNav } from "@/lib/use-nav";

export const BottomBar: React.FC = () => {
  const pathname = usePathname() || "/dashboard";
  const { bottomItems } = useNav();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-1">
      <div className="glass-header flex items-center justify-around rounded-2xl border border-white/70 dark:border-line shadow-xl px-2 py-2">
        {bottomItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/") || (pathname === "/" && item.href === "/dashboard");
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 px-3 py-1.5 min-w-16">
              <span
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? "bg-linear-to-r from-(--brand-700) to-(--brand-600) text-white shadow-lg shadow-black/30 dark:shadow-[0_0_18px_-2px_rgba(31, 115, 80, 0.35)]"
                    : "text-slate-500 dark:text-fg-muted"
                }`}
              >
                <Icon className="w-5 h-5" />
              </span>
              <span className={`text-[11px] font-bold ${isActive ? "text-(--brand-700) dark:text-(--accent-primary)" : "text-slate-500 dark:text-fg-muted"}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
