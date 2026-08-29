import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "secondary" | "success" | "warning" | "danger" | "info" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "primary",
  size = "md",
  icon,
  dot = false,
  className = "",
  ...props
}) => {
  const variantClasses = {
    primary: "bg-blue-500/15 dark:bg-[rgba(59,130,246,0.10)] text-blue-700 dark:text-[#60A5FA] border-blue-500/30 dark:border-[rgba(59,130,246,0.22)]",
    secondary: "bg-slate-500/15 dark:bg-[rgba(148,163,184,0.10)] text-slate-700 dark:text-fg-secondary border-slate-500/30 dark:border-[rgba(148,163,184,0.22)]",
    success: "bg-emerald-500/15 dark:bg-[rgba(16,185,129,0.10)] text-emerald-700 dark:text-[#34D399] border-emerald-500/30 dark:border-[rgba(16,185,129,0.22)]",
    warning: "bg-amber-500/15 dark:bg-[rgba(245,158,11,0.10)] text-amber-700 dark:text-[#FBBF24] border-amber-500/30 dark:border-[rgba(245,158,11,0.22)]",
    danger: "bg-rose-500/15 dark:bg-[rgba(239,68,68,0.10)] text-rose-700 dark:text-[#F87171] border-rose-500/30 dark:border-[rgba(239,68,68,0.22)]",
    info: "bg-sky-500/15 dark:bg-[rgba(56,189,248,0.10)] text-sky-700 dark:text-[#38BDF8] border-sky-500/30 dark:border-[rgba(56,189,248,0.22)]",
    outline: "bg-transparent text-slate-700 dark:text-fg-secondary border-slate-300 dark:border-line-strong",
    ghost: "bg-white/60 dark:bg-surface backdrop-blur-md dark:backdrop-blur-none text-slate-700 dark:text-fg-secondary border-white/80 dark:border-line shadow-sm dark:shadow-none",
  };

  const dotClasses = {
    primary: "bg-blue-500",
    secondary: "bg-slate-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500",
    info: "bg-sky-500",
    outline: "bg-slate-400",
    ghost: "bg-blue-600",
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px] gap-1 rounded-md",
    md: "px-2.5 py-1 dark:py-0.5 text-xs gap-1.5 rounded-lg",
    lg: "px-3.5 py-1.5 text-sm gap-2 rounded-xl",
  };

  return (
    <span
      className={`inline-flex items-center font-bold dark:font-semibold border ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {dot && <span className={`w-2 h-2 dark:w-1.5 dark:h-1.5 rounded-full ${dotClasses[variant]} animate-pulse`} />}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
};
