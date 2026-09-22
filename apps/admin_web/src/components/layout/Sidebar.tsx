"use client";

import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    if (activeChild) {
      setIsOpen(true);
    }
  }, [pathname, activeChild]);

  if (hasChildren) {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          title={isCollapsed ? item.label : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 cursor-pointer ${
            activeChild
              ? "text-white bg-white/10"
              : "text-slate-300 hover:bg-white/5 hover:text-white"
          } ${isCollapsed ? "justify-center px-0" : ""}`}
        >
          {Icon && (
            <span className={`flex-shrink-0 ${activeChild ? "text-white" : "text-slate-400"}`}>
              <Icon className="w-4 h-4" />
            </span>
          )}
          {!isCollapsed && (
            <>
              <span className="truncate flex-1 text-left text-sm font-semibold">{item.label}</span>
              <ChevronDown className={`w-4 h-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </>
          )}
        </button>

        {!isCollapsed && isOpen && (
          <div className="ml-4 pl-3 border-l border-white/15 space-y-0.5 my-1">
            {item.children!.map((child) => {
              const childActive = isItemActive(pathname, child.href);
              return (
                <Link
                  key={child.label}
                  href={child.href!}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    // Teks putih + panel translucent — BUKAN warna aksen — supaya
                    // baris aktif tetap terbaca tegas tanpa menyala di atas gradien
                    // gelap. Aksen (brand-*) dipakai di elemen datar yang diam,
                    // bukan di teks kecil yang harus dibaca cepat.
                    childActive
                      ? "text-white font-semibold bg-white/10"
                      : "text-slate-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className="truncate">{child.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      title={isCollapsed ? item.label : undefined}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 ${
        // bg-brand-600 (bukan Tailwind brand-600 bawaan): skala brand
        // sengaja diredupkan supaya pil menu aktif tidak menyala di atas
        // gradien gelap, dan ikut berganti warna saat accent diganti.
        isActive
          ? "bg-brand-600 text-white shadow-md shadow-black/30"
          : "text-slate-300 hover:bg-white/5 hover:text-white"
      } ${isCollapsed ? "justify-center px-0" : ""}`}
    >
      {Icon && (
        <span className={`flex-shrink-0 ${isActive ? "text-white" : "text-slate-400"}`}>
          <Icon className="w-4 h-4" />
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
      // Gradien berakhir di HITAM (bukan brand-900 lagi) — inilah yang paling
      // menentukan "gelap tidaknya" sidebar. brand-900 saja masih tampak
      // sebagai hijau redup; ditutup hitam di ujung bawah membuat sidebar
      // terasa gelap tanpa membuat brand-700 di puncaknya ikut digelapkan
      // (yang akan mengubah IDENTITAS warnanya, bukan cuma kesan gelapnya).
      className={`hidden lg:flex fixed top-0 left-0 bottom-0 z-40 flex-col justify-between transition-all duration-300 select-none bg-gradient-to-b from-brand-800 via-brand-900 to-black text-white shadow-2xl border-r border-black/30 dark:bg-none dark:bg-[var(--sidebar-bg)] dark:border-r dark:border-[var(--line)] dark:shadow-none ${
        isCollapsed ? "w-20" : "w-64"
      } ${className}`}
    >
      <div className="p-4 flex items-center justify-between border-b border-black/20 dark:border-line h-20">
        {!isCollapsed ? (
          <div className="flex items-center gap-3 overflow-hidden">
            <AppLogo size="sm" iconOnly={true} />
            <div className="flex flex-col">
              <span className="font-black text-xl tracking-wide text-white leading-none">{APP_CONFIG.name}</span>
              <span className="text-[10px] text-white/65 font-semibold tracking-tight mt-0.5">
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
              <p className="px-3.5 text-[11px] font-bold uppercase tracking-wide text-white/45">{group.group}</p>
            )}
            {group.items.map((item) => (
              <SidebarNavItem key={item.label} item={item} isCollapsed={isCollapsed} pathname={pathname} />
            ))}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-black/20 dark:border-line bg-black/15">
        {!isCollapsed ? (
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-xs text-white/80 leading-relaxed mb-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-white/70 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Template Sistem</p>
                <p className="text-[11px] text-white/60 mt-0.5">Template dasar siap pakai.</p>
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