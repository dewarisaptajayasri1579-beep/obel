"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { NAV_GROUPS, type NavItem } from "@/lib/nav-config";

function isItemActive(pathname: string, href?: string): boolean {
  if (!href) return false;
  return pathname === href || pathname.startsWith(href + "/") || (pathname === "/" && href === "/dashboard");
}

function containsActiveChild(pathname: string, item: NavItem): boolean {
  return item.children?.some((child) => isItemActive(pathname, child.href)) ?? false;
}

const HorizontalMenuItem: React.FC<{ item: NavItem; pathname: string }> = ({ item, pathname }) => {
  const hasChildren = !!item.children?.length;
  const isActive = isItemActive(pathname, item.href) || (hasChildren && containsActiveChild(pathname, item));
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const Icon = item.icon;

  useEffect(() => setMounted(true), []);

  const updateCoords = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.bottom + 6, left: rect.left });
  };

  useEffect(() => {
    if (!open) return;
    updateCoords();
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
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

  if (hasChildren) {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
            isActive
              ? "bg-[#0544cc] text-white shadow-md shadow-blue-600/25 dark:shadow-[0_0_18px_-2px_rgba(37,99,235,0.65)]"
              : "text-slate-600 dark:text-fg-secondary hover:bg-slate-100 dark:hover:bg-surface-hover"
          }`}
        >
          {Icon && <Icon className="w-4 h-4" />}
          <span>{item.label}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>

        {open &&
          mounted &&
          coords &&
          createPortal(
            <div
              ref={panelRef}
              style={{ top: coords.top, left: coords.left }}
              className="fixed z-[70] min-w-[190px] py-1.5 rounded-2xl glass-dropdown shadow-xl border border-white/80 dark:border-line"
            >
              {item.children!.map((child) => (
                <Link
                  key={child.href}
                  href={child.href!}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-2.5 text-sm font-semibold transition-colors ${
                    isItemActive(pathname, child.href)
                      ? "text-[#0544cc] dark:text-[var(--accent-primary)] bg-blue-50/80 dark:bg-blue-500/10"
                      : "text-slate-700 dark:text-fg-secondary hover:bg-slate-100 dark:hover:bg-surface-hover"
                  }`}
                >
                  {child.label}
                </Link>
              ))}
            </div>,
            document.body
          )}
      </>
    );
  }

  return (
    <Link
      href={item.href!}
      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
        isActive
              ? "bg-[#0544cc] text-white shadow-md shadow-blue-600/25 dark:shadow-[0_0_18px_-2px_rgba(37,99,235,0.65)]"
              : "text-slate-600 dark:text-fg-secondary hover:bg-slate-100 dark:hover:bg-surface-hover"
      }`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      <span>{item.label}</span>
    </Link>
  );
};

export const HorizontalMenu: React.FC = () => {
  const pathname = usePathname() || "/dashboard";

  return (
    <nav className="hidden lg:block glass-header sticky top-20 z-20 px-4 sm:px-6 py-2.5 border-t border-white/40 dark:border-line">
      <div className="flex items-center gap-1.5 overflow-x-auto max-w-7xl mx-auto">
        {NAV_GROUPS.flatMap((g) => g.items).map((item) => (
          <HorizontalMenuItem key={item.label} item={item} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
};
