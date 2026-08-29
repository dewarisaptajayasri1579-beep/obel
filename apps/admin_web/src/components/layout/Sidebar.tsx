"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppLogo } from "../ui/AppLogo";
import { ChevronLeft, ChevronRight, ChevronDown, Info } from "lucide-react";
import { APP_CONFIG } from "@/lib/app-config";
import { NAV_GROUPS, type NavItem } from "@/lib/nav-config";

export interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
}

function isItemActive(pathname: string, href?: string): boolean {
  if (!href) return false;
  return pathname === href || pathname.startsWith(href + "/") || (pathname === "/" && href === "/dashboard");
}

function containsActiveChild(pathname: string, item: NavItem): boolean {
  return item.children?.some((child) => isItemActive(pathname, child.href)) ?? false;
}

const SidebarNavItem: React.FC<{ item: NavItem; isCollapsed: boolean; pathname: string }> = ({ item, isCollapsed, pathname }) => {
  const hasChildren = !!item.children?.length;
  const activeChild = hasChildren && containsActiveChild(pathname, item);
  const [isOpen, setIsOpen] = useState(activeChild);
  const isActive = isItemActive(pathname, item.href);
  const Icon = item.icon;

  if (hasChildren) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          title={isCollapsed ? item.label : undefined}
          className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl font-bold text-sm transition-all duration-200 cursor-pointer ${
            activeChild
              ? "text-white bg-white/10 dark:bg-[rgba(59,130,246,0.10)] dark:text-[#60A5FA] dark:shadow-[0_0_18px_rgba(59,130,246,0.12)]"
              : "text-slate-300 hover:bg-white/10 hover:text-white dark:hover:bg-[rgba(59,130,246,0.06)]"
          } ${isCollapsed ? "justify-center px-0" : ""}`}
        >
          {Icon && (
            <span className={`flex-shrink-0 ${activeChild ? "text-white dark:text-[#60A5FA]" : "text-slate-300"}`}>
              <Icon className="w-5 h-5" />
            </span>
          )}
          {!isCollapsed && (
            <>
              <span className="truncate flex-1 text-left">{item.label}</span>
              <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </>
          )}
        </button>
        {!isCollapsed && isOpen && (
          <div className="mt-1 ml-4 pl-4 border-l border-white/10 space-y-1">
            {item.children!.map((child) => (
              <Link
                key={child.href}
                href={child.href!}
                className={`block px-3 py-2 rounded-xl text-sm font-semibold transition-colors dark:border-l-2 dark:border-l-transparent ${
                  isItemActive(pathname, child.href)
                    ? "text-white bg-white/10 dark:bg-[rgba(59,130,246,0.10)] dark:text-[#60A5FA] dark:border-l-[#3B82F6] dark:shadow-[0_0_18px_rgba(59,130,246,0.12)]"
                    : "text-slate-400 hover:text-white hover:bg-white/5 dark:hover:bg-[rgba(59,130,246,0.06)]"
                }`}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      title={isCollapsed ? item.label : undefined}
      className={`flex items-center gap-3.5 px-3.5 py-3 rounded-2xl font-bold text-sm transition-all duration-200 ${
        isActive
          ? "bg-gradient-to-r from-[#0544cc] to-[#2563eb] text-white shadow-[0_0_22px_-2px_rgba(37,99,235,0.65)] border border-blue-400/50 translate-x-1 dark:shadow-[0_0_18px_rgba(59,130,246,0.3)] dark:border-blue-500/50"
          : "text-slate-300 hover:bg-white/10 hover:text-white dark:hover:bg-[rgba(59,130,246,0.06)]"
      } ${isCollapsed ? "justify-center px-0" : ""}`}
    >
      {Icon && (
        <span className={`flex-shrink-0 ${isActive ? "text-white dark:text-[#60A5FA]" : "text-slate-300"}`}>
          <Icon className="w-5 h-5" />
        </span>
      )}
      {!isCollapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggleCollapse, className = "" }) => {
  const pathname = usePathname() || "/dashboard";

  return (
    <aside
      className={`hidden lg:flex fixed top-0 left-0 bottom-0 z-40 flex-col justify-between transition-all duration-300 select-none bg-gradient-to-b from-[#0a2540] via-[#09356b] to-[#041c38] text-white shadow-2xl border-r border-blue-900/40 dark:bg-none dark:bg-[var(--sidebar-bg)] dark:border-r dark:border-[var(--line)] dark:shadow-none ${
        isCollapsed ? "w-20" : "w-64"
      } ${className}`}
    >
      <div className="p-4 flex items-center justify-between border-b border-blue-800/40 dark:border-line h-20">
        {!isCollapsed ? (
          <div className="flex items-center gap-3 overflow-hidden">
            <AppLogo size="sm" iconOnly={true} />
            <div className="flex flex-col">
              <span className="font-black text-xl tracking-wide text-white leading-none">{APP_CONFIG.name}</span>
              <span className="text-[10px] text-blue-200 font-semibold tracking-tight mt-0.5">
                {APP_CONFIG.tagline}
              </span>
            </div>
          </div>
        ) : (
          <div className="mx-auto">
            <AppLogo size="sm" iconOnly={true} />
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-6 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.group ?? groupIndex} className="space-y-2">
            {group.group && !isCollapsed && (
              <p className="px-3.5 text-[11px] font-bold uppercase tracking-wide text-blue-300/60">{group.group}</p>
            )}
            {group.items.map((item) => (
              <SidebarNavItem key={item.label} item={item} isCollapsed={isCollapsed} pathname={pathname} />
            ))}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-blue-800/40 dark:border-line bg-black/15">
        {!isCollapsed ? (
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-xs text-blue-200/90 leading-relaxed mb-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Template Sistem</p>
                <p className="text-[11px] text-blue-200/70 mt-0.5">Template dasar siap pakai.</p>
              </div>
            </div>
          </div>
        ) : null}

        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          aria-label={isCollapsed ? "Buka Sidebar" : "Tutup Sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <div className="flex items-center gap-2 text-xs font-semibold">
              <ChevronLeft className="w-4 h-4" />
              <span>Sembunyikan Menu</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};
