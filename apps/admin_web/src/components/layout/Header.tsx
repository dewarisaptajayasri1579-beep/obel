"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "../ui/Avatar";
import { Calendar, ChevronDown, Info, LogOut, Search, UserRound, Sun, Moon, PanelLeft, PanelLeftClose, Rows3 } from "lucide-react";
import { APP_CONFIG } from "@/lib/app-config";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { NotificationBell } from "./NotificationBell";
import { useAuth } from "@/lib/auth-context";

export interface HeaderProps {
  userName: string;
  userRole?: string;
  className?: string;
  isSidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  direktur: "Direktur",
  admin: "Admin",
};

export const Header: React.FC<HeaderProps> = ({
  userName,
  userRole = "admin",
  className = "",
  isSidebarCollapsed,
  onToggleSidebarCollapse,
}) => {
  const router = useRouter();
  const { logout } = useAuth();
  const { theme, toggleTheme, navLayout, setNavLayout } = usePreferences();
  const [currentDateTime, setCurrentDateTime] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember",
      ];
      const dayName = days[now.getDay()];
      const dateNum = now.getDate();
      const monthName = months[now.getMonth()];
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      setCurrentDateTime(`${dayName}, ${dateNum} ${monthName} ${year} | ${hours}:${minutes} WIB`);
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000 * 30);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const iconButtonClass =
    "flex items-center justify-center w-9 h-9 rounded-2xl dark:rounded-xl bg-white/70 hover:bg-white backdrop-blur-md border border-slate-200/80 shadow-xs text-slate-500 transition-colors cursor-pointer focus:outline-none dark:bg-transparent dark:border-transparent dark:shadow-none dark:hover:bg-surface-hover dark:text-fg-muted dark:hover:text-fg dark:focus-visible:bg-surface-hover dark:focus-visible:ring-2 dark:focus-visible:ring-[rgba(59,130,246,0.35)]";

  return (
    <header className={`h-20 glass-header sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between gap-4 transition-all duration-300 ${className}`}>
      {/* LEFT: collapse toggle + search */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        {onToggleSidebarCollapse && (
          <button
            onClick={onToggleSidebarCollapse}
            className={`${iconButtonClass} hidden lg:flex`}
            aria-label={isSidebarCollapsed ? "Buka Sidebar" : "Tutup Sidebar"}
            title={isSidebarCollapsed ? "Buka Sidebar" : "Tutup Sidebar"}
          >
            {isSidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}

        <div className="lg:hidden flex flex-col">
          <span className="font-extrabold text-base text-slate-800 dark:text-fg">{APP_CONFIG.name}</span>
          <span className="text-[10px] text-slate-500 dark:text-fg-muted font-semibold">{APP_CONFIG.tagline}</span>
        </div>

        <button
          onClick={() => window.dispatchEvent(new Event("toggle-command-palette"))}
          className="hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-2xl dark:rounded-xl bg-white/70 hover:bg-white backdrop-blur-md border border-slate-200/80 shadow-xs text-xs sm:text-sm font-semibold text-slate-500 transition-colors cursor-pointer w-full max-w-xs focus:outline-none dark:bg-[var(--field-bg)] dark:hover:bg-surface-hover dark:border-line dark:text-fg-muted dark:focus-visible:ring-2 dark:focus-visible:ring-[rgba(59,130,246,0.35)]"
          aria-label="Buka pencarian"
        >
          <Search className="w-4 h-4 text-slate-400 dark:text-fg-muted flex-shrink-0" />
          <span className="hidden md:inline">Cari...</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-400 ml-auto dark:bg-white/5 dark:border-line dark:text-fg-muted">
            ⌘K
          </kbd>
        </button>
        <button
          onClick={() => window.dispatchEvent(new Event("toggle-command-palette"))}
          className={`${iconButtonClass} sm:hidden`}
          aria-label="Buka pencarian"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* RIGHT: theme toggle, layout toggle, info, date/time pill, user */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <button
          onClick={() => setNavLayout(navLayout === "sidebar" ? "horizontal" : "sidebar")}
          className={`${iconButtonClass} hidden lg:flex`}
          aria-label={navLayout === "sidebar" ? "Pakai menu horizontal" : "Pakai sidebar"}
          title={navLayout === "sidebar" ? "Pakai menu horizontal" : "Pakai sidebar"}
        >
          {navLayout === "sidebar" ? <Rows3 className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
        </button>

        <button
          onClick={toggleTheme}
          className={iconButtonClass}
          aria-label={theme === "dark" ? "Pakai mode terang" : "Pakai mode gelap"}
          title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <Link
          href="/dokumentasi"
          className={iconButtonClass}
          aria-label="Dokumentasi"
          title="Dokumentasi"
        >
          <Info className="w-4 h-4" />
        </Link>

        <NotificationBell iconButtonClass={iconButtonClass} />

        <div className="hidden lg:flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/70 backdrop-blur-md border border-slate-200/80 shadow-xs text-xs font-bold text-slate-700 dark:bg-transparent dark:border-line dark:text-fg-secondary">
          <Calendar className="w-3.5 h-3.5 text-blue-700 dark:text-[var(--accent-highlight)]" />
          <span>{currentDateTime}</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-white/80 hover:bg-white border border-slate-200/90 shadow-sm transition-all cursor-pointer dark:bg-transparent dark:hover:bg-surface-hover dark:border-transparent"
          >
            <Avatar name={userName} size="sm" status="online" />
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-800 dark:text-fg leading-tight">{userName}</span>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-fg-muted">{ROLE_LABEL[userRole] ?? userRole}</span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-500 dark:text-fg-muted" />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 glass-dropdown p-2 rounded-2xl shadow-xl z-50">
              <div className="px-3 py-2 border-b border-slate-200/60 dark:border-line mb-1">
                <p className="text-xs font-bold text-slate-800 dark:text-fg">{userName}</p>
                <p className="text-[11px] text-slate-500 dark:text-fg-muted font-medium">{ROLE_LABEL[userRole] ?? userRole}</p>
              </div>
              <Link
                href="/profil"
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-fg-secondary hover:bg-slate-100 dark:hover:bg-surface-hover rounded-xl transition-colors"
              >
                <UserRound className="w-4 h-4 text-slate-500 dark:text-fg-muted" />
                <span>Profil</span>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors text-left cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                <span>Keluar (Logout)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
