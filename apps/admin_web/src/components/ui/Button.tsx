import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "glass" | "danger" | "success" | "warning" | "info";
  size?: "sm" | "md" | "lg" | "xl";
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "relative inline-flex items-center justify-center font-bold tracking-wide transition-all duration-200 focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]";

    const variants = {
      primary:
        "bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white shadow-lg shadow-blue-700/25 hover:shadow-blue-700/40 hover:from-blue-600 hover:to-indigo-800 focus:ring-blue-500/30 border border-blue-600/30 dark:border-transparent dark:from-[#2563EB] dark:via-[#2563EB] dark:to-[#3B82F6] dark:hover:from-[#2563EB] dark:hover:via-[#3B82F6] dark:hover:to-[#60A5FA] dark:shadow-[0_4px_14px_rgba(37,99,235,0.25),0_0_20px_rgba(59,130,246,0.15)] dark:hover:shadow-[0_4px_18px_rgba(37,99,235,0.32),0_0_26px_rgba(59,130,246,0.22)]",
      secondary:
        "bg-slate-100 dark:bg-surface text-slate-800 dark:text-fg-secondary hover:bg-slate-200 dark:hover:bg-surface-hover focus:ring-slate-400/20 border border-slate-200/80 dark:border-line",
      outline:
        "bg-transparent border-2 dark:border border-blue-700 dark:border-[var(--accent-primary)] text-blue-700 dark:text-[var(--accent-primary)] hover:bg-blue-50 dark:hover:bg-[rgba(59,130,246,0.08)] focus:ring-blue-500/20",
      ghost:
        "bg-transparent text-slate-700 dark:text-fg-secondary hover:bg-slate-100 dark:hover:bg-surface-hover focus:ring-slate-300/20",
      glass:
        "bg-white/80 dark:bg-surface backdrop-blur-md dark:backdrop-blur-none border border-white/90 dark:border-line text-blue-900 dark:text-[var(--accent-highlight)] shadow-md dark:shadow-none hover:bg-white dark:hover:bg-surface-hover focus:ring-white/50",
      danger:
        "bg-gradient-to-r from-rose-600 to-red-700 text-white shadow-lg shadow-rose-600/25 hover:shadow-rose-600/40 hover:from-rose-500 hover:to-red-600 focus:ring-rose-500/30 border border-rose-600/30 dark:border-transparent dark:shadow-[0_4px_14px_rgba(225,29,72,0.25),0_0_20px_rgba(244,63,94,0.15)] dark:hover:shadow-[0_4px_18px_rgba(225,29,72,0.32),0_0_26px_rgba(244,63,94,0.22)]",
      success:
        "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:bg-emerald-500 focus:ring-emerald-500/30 border border-emerald-600/30 dark:border-transparent dark:shadow-[0_4px_14px_rgba(5,150,105,0.25),0_0_20px_rgba(16,185,129,0.15)] dark:hover:shadow-[0_4px_18px_rgba(5,150,105,0.32),0_0_26px_rgba(16,185,129,0.22)]",
      warning:
        "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 focus:ring-amber-500/30 border border-amber-500/30 dark:border-transparent dark:shadow-[0_4px_14px_rgba(245,158,11,0.25),0_0_20px_rgba(245,158,11,0.15)] dark:hover:shadow-[0_4px_18px_rgba(245,158,11,0.32),0_0_26px_rgba(245,158,11,0.22)]",
      info:
        "bg-sky-600 text-white shadow-lg shadow-sky-600/25 hover:shadow-sky-600/40 hover:bg-sky-500 focus:ring-sky-500/30 border border-sky-600/30 dark:border-transparent dark:shadow-[0_4px_14px_rgba(3,105,161,0.25),0_0_20px_rgba(56,189,248,0.15)] dark:hover:shadow-[0_4px_18px_rgba(3,105,161,0.32),0_0_26px_rgba(56,189,248,0.22)]",
    };

    const sizes = {
      sm: "min-h-[38px] px-3.5 text-xs rounded-xl gap-1.5",
      md: "min-h-[44px] px-5 text-sm rounded-2xl dark:rounded-xl gap-2",
      lg: "min-h-[52px] px-6 text-base rounded-2xl dark:rounded-xl gap-2.5",
      xl: "min-h-[60px] px-8 text-lg rounded-2xl dark:rounded-xl gap-3",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${
          fullWidth ? "w-full" : "w-auto"
        } ${className}`}
        {...props}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <svg
              className="animate-spin h-5 w-5 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>{loadingText || "Memproses..."}</span>
          </div>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
            {children && <span>{children}</span>}
            {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
