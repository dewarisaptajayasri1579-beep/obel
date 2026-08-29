import React from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardDescription } from "./Card";

export interface StatTileProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  color?: "blue" | "emerald" | "amber" | "rose" | "purple" | "slate";
  trend?: { value: string; direction: "up" | "down" };
  sparkline?: number[];
  className?: string;
}

const VALUE_COLOR_CLASSES: Record<NonNullable<StatTileProps["color"]>, string> = {
  blue: "text-blue-600 dark:text-[var(--accent-primary)]",
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
  purple: "text-violet-600 dark:text-violet-400",
  slate: "text-slate-900 dark:text-fg",
};

const ICON_WRAP_CLASSES: Record<NonNullable<StatTileProps["color"]>, string> = {
  blue: "bg-blue-500/15 dark:bg-[rgba(59,130,246,0.14)] text-blue-700 dark:text-[#60A5FA]",
  emerald: "bg-emerald-500/15 dark:bg-[rgba(16,185,129,0.14)] text-emerald-700 dark:text-[#34D399]",
  amber: "bg-amber-500/15 dark:bg-[rgba(245,158,11,0.14)] text-amber-700 dark:text-[#FBBF24]",
  rose: "bg-rose-500/15 dark:bg-[rgba(239,68,68,0.14)] text-rose-700 dark:text-[#F87171]",
  purple: "bg-purple-500/15 dark:bg-[rgba(139,92,246,0.14)] text-purple-700 dark:text-[#C084FC]",
  slate: "bg-slate-500/15 dark:bg-[rgba(148,163,184,0.14)] text-slate-700 dark:text-fg-secondary",
};

const CARD_COLOR_CLASSES: Record<NonNullable<StatTileProps["color"]>, string> = {
  blue: "dark:border-blue-500/30 dark:shadow-[0_0_20px_rgba(59,130,246,0.12)]",
  emerald: "dark:border-emerald-500/30 dark:shadow-[0_0_20px_rgba(16,185,129,0.12)]",
  amber: "dark:border-amber-500/30 dark:shadow-[0_0_20px_rgba(245,158,11,0.12)]",
  rose: "dark:border-rose-500/30 dark:shadow-[0_0_20px_rgba(244,63,94,0.12)]",
  purple: "dark:border-purple-500/30 dark:shadow-[0_0_20px_rgba(139,92,246,0.12)]",
  slate: "dark:border-[var(--line)]",
};

const SPARKLINE_COLORS: Record<NonNullable<StatTileProps["color"]>, string> = {
  blue: "#3b82f6",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  purple: "#a855f7",
  slate: "#94a3b8",
};

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  icon: Icon,
  color = "slate",
  trend,
  sparkline,
  className = "",
}) => {
  let sparklinePath = "";
  let sparklineArea = "";

  if (sparkline && sparkline.length > 1) {
    const min = Math.min(...sparkline);
    const max = Math.max(...sparkline);
    const range = max - min === 0 ? 1 : max - min;
    const points = sparkline.map((val, index) => {
      const x = (index / (sparkline.length - 1)) * 60;
      const y = 20 - ((val - min) / range) * 14 - 3; // 3px padding top/bottom
      return `${x},${y}`;
    });
    sparklinePath = `M ${points.join(" L ")}`;
    sparklineArea = `${sparklinePath} L 60,20 L 0,20 Z`;
  }

  const strokeColor = SPARKLINE_COLORS[color];

  return (
    <Card variant="feature" padding="md" className={`${CARD_COLOR_CLASSES[color]} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CardDescription>{label}</CardDescription>
          <div className="flex items-baseline gap-3 flex-wrap">
            <p className={`text-2xl font-black mt-1 truncate ${VALUE_COLOR_CLASSES[color]}`}>{value}</p>
            
            {sparkline && sparkline.length > 1 && (
              <div className="w-16 h-8 overflow-visible self-end mb-1 ml-auto sm:ml-0">
                <svg className="w-full h-full" viewBox="0 0 60 20" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={strokeColor} stopOpacity="0.4" />
                      <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={sparklineArea}
                    fill={`url(#grad-${color})`}
                  />
                  <path
                    d={sparklinePath}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>

          {trend && (
            <div
              className={`flex items-center gap-1 mt-1.5 text-xs font-bold ${
                trend.direction === "up" ? "text-emerald-600 dark:text-[#34D399]" : "text-rose-600 dark:text-[#F87171]"
              }`}
            >
              {trend.direction === "up" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
              <span>{trend.value}</span>
              <span className="text-[10px] text-slate-400 dark:text-fg-disabled font-normal">dari bulan lalu</span>
            </div>
          )}
        </div>
        {Icon && (
          <span className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center ${ICON_WRAP_CLASSES[color]}`}>
            <Icon className="w-5 h-5" />
          </span>
        )}
      </div>
    </Card>
  );
};
