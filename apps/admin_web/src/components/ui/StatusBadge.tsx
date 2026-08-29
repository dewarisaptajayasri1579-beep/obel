import React from "react";

export type StatusBadgeType =
  | "safe"
  | "expiring_next_month"
  | "expiring_this_month"
  | "expired"
  | "unpaid"
  | "partial"
  | "paid"
  | "claimed_paid"
  | "inactive"
  | "draft"
  | "posted"
  | "voided";

export interface StatusBadgeProps {
  type: StatusBadgeType;
  label?: string;
  count?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  type,
  label,
  count,
  size = "md",
  className = "",
}) => {
  const config = {
    safe: {
      defaultLabel: "Aman",
      bgColor: "bg-emerald-500/15 dark:bg-[rgba(16,185,129,0.10)]",
      textColor: "text-emerald-700 dark:text-[#34D399]",
      borderColor: "border-emerald-500/30 dark:border-[rgba(16,185,129,0.22)]",
      dotColor: "bg-emerald-500",
      badgeColor: "bg-emerald-600 text-white",
    },
    expiring_next_month: {
      defaultLabel: "Bulan Depan",
      bgColor: "bg-sky-500/15 dark:bg-[rgba(56,189,248,0.10)]",
      textColor: "text-sky-700 dark:text-[#38BDF8]",
      borderColor: "border-sky-500/30 dark:border-[rgba(56,189,248,0.22)]",
      dotColor: "bg-sky-500",
      badgeColor: "bg-sky-600 text-white",
    },
    expiring_this_month: {
      defaultLabel: "Bulan Ini",
      bgColor: "bg-amber-500/15 dark:bg-[rgba(245,158,11,0.10)]",
      textColor: "text-amber-700 dark:text-[#FBBF24]",
      borderColor: "border-amber-500/30 dark:border-[rgba(245,158,11,0.22)]",
      dotColor: "bg-amber-500",
      badgeColor: "bg-amber-600 text-white",
    },
    expired: {
      defaultLabel: "Sudah Lewat",
      bgColor: "bg-rose-500/15 dark:bg-[rgba(239,68,68,0.10)]",
      textColor: "text-rose-700 dark:text-[#F87171]",
      borderColor: "border-rose-500/30 dark:border-[rgba(239,68,68,0.22)]",
      dotColor: "bg-rose-500",
      badgeColor: "bg-rose-600 text-white",
    },
    unpaid: {
      defaultLabel: "Belum Dibayar",
      bgColor: "bg-rose-500/15 dark:bg-[rgba(239,68,68,0.10)]",
      textColor: "text-rose-700 dark:text-[#F87171]",
      borderColor: "border-rose-500/30 dark:border-[rgba(239,68,68,0.22)]",
      dotColor: "bg-rose-500",
      badgeColor: "bg-rose-600 text-white",
    },
    partial: {
      defaultLabel: "Dicicil",
      bgColor: "bg-amber-500/15 dark:bg-[rgba(245,158,11,0.10)]",
      textColor: "text-amber-700 dark:text-[#FBBF24]",
      borderColor: "border-amber-500/30 dark:border-[rgba(245,158,11,0.22)]",
      dotColor: "bg-amber-500",
      badgeColor: "bg-amber-600 text-white",
    },
    paid: {
      defaultLabel: "Lunas",
      bgColor: "bg-emerald-500/15 dark:bg-[rgba(16,185,129,0.10)]",
      textColor: "text-emerald-700 dark:text-[#34D399]",
      borderColor: "border-emerald-500/30 dark:border-[rgba(16,185,129,0.22)]",
      dotColor: "bg-emerald-500",
      badgeColor: "bg-emerald-600 text-white",
    },
    claimed_paid: {
      defaultLabel: "Diklaim Lunas (belum diverifikasi)",
      bgColor: "bg-purple-500/15 dark:bg-[rgba(168,85,247,0.10)]",
      textColor: "text-purple-700 dark:text-[#C084FC]",
      borderColor: "border-purple-500/30 dark:border-[rgba(168,85,247,0.22)]",
      dotColor: "bg-purple-500",
      badgeColor: "bg-purple-600 text-white",
    },
    inactive: {
      defaultLabel: "Nonaktif",
      bgColor: "bg-slate-500/15 dark:bg-[rgba(148,163,184,0.10)]",
      textColor: "text-slate-700 dark:text-fg-secondary",
      borderColor: "border-slate-500/30 dark:border-[rgba(148,163,184,0.22)]",
      dotColor: "bg-slate-500",
      badgeColor: "bg-slate-600 text-white",
    },
    draft: {
      defaultLabel: "Draft",
      bgColor: "bg-slate-500/15 dark:bg-[rgba(148,163,184,0.10)]",
      textColor: "text-slate-600 dark:text-fg-muted",
      borderColor: "border-slate-500/30 dark:border-[rgba(148,163,184,0.22)]",
      dotColor: "bg-slate-400",
      badgeColor: "bg-slate-500 text-white",
    },
    posted: {
      defaultLabel: "Posted",
      bgColor: "bg-emerald-500/15 dark:bg-[rgba(16,185,129,0.10)]",
      textColor: "text-emerald-700 dark:text-[#34D399]",
      borderColor: "border-emerald-500/30 dark:border-[rgba(16,185,129,0.22)]",
      dotColor: "bg-emerald-500",
      badgeColor: "bg-emerald-600 text-white",
    },
    voided: {
      defaultLabel: "Dibatalkan",
      bgColor: "bg-rose-500/10 dark:bg-[rgba(239,68,68,0.08)]",
      textColor: "text-rose-600 dark:text-[#F87171]",
      borderColor: "border-rose-500/30 dark:border-[rgba(239,68,68,0.22)]",
      dotColor: "bg-rose-400",
      badgeColor: "bg-rose-500 text-white",
    },
  };

  const style = config[type] || config.safe;
  const displayLabel = label || style.defaultLabel;

  const sizeClasses = {
    sm: "px-2.5 py-1 dark:py-0.5 text-xs gap-1.5 rounded-lg",
    md: "px-3.5 py-1.5 dark:py-1 text-sm gap-2 rounded-xl",
    lg: "px-4 py-2 dark:py-1.5 text-base gap-2.5 rounded-2xl",
  };

  return (
    <div
      className={`inline-flex items-center font-bold dark:font-semibold border backdrop-blur-md dark:backdrop-blur-none shadow-xs dark:shadow-none ${style.bgColor} ${style.textColor} ${style.borderColor} ${sizeClasses[size]} ${className}`}
    >
      <span className={`w-2.5 h-2.5 dark:w-2 dark:h-2 rounded-full ${style.dotColor} animate-pulse`} />
      <span>{displayLabel}</span>
      {count !== undefined && (
        <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black ${style.badgeColor}`}>
          {count}
        </span>
      )}
    </div>
  );
};
