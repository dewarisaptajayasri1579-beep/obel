import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "glass" | "feature" | "panel" | "modal" | "solid" | "outline";
  hoverable?: boolean;
  padding?: "none" | "sm" | "md" | "lg" | "xl";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = "glass",
      hoverable = false,
      padding = "lg",
      className = "",
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      glass: "glass-card rounded-[28px]",
      feature: "glass-feature-card rounded-2xl",
      panel: "glass-panel rounded-3xl dark:rounded-2xl",
      modal: "glass-modal rounded-[32px]",
      solid: "bg-white dark:bg-surface border border-slate-200/90 dark:border-line shadow-lg dark:shadow-[0_1px_2px_rgba(0,0,0,0.35),0_10px_30px_rgba(0,0,0,0.16)] rounded-2xl",
      outline: "bg-white/40 dark:bg-surface backdrop-blur-md dark:backdrop-blur-none border-2 dark:border border-slate-200/80 dark:border-line rounded-2xl",
    };

    const paddingClasses = {
      none: "p-0",
      sm: "p-3 sm:p-4",
      md: "p-5 sm:p-6 dark:p-4 dark:sm:p-5",
      lg: "p-6 sm:p-8 dark:p-5 dark:sm:p-6",
      xl: "p-8 sm:p-10 dark:p-6 dark:sm:p-8",
    };

    const hoverClass = hoverable
      ? "transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer"
      : "";

    return (
      <div
        ref={ref}
        className={`${variantClasses[variant]} ${paddingClasses[padding]} ${hoverClass} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div className={`flex flex-col gap-1 mb-4 dark:mb-3.5 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <h3
    className={`font-bold text-slate-800 dark:text-fg text-lg sm:text-xl tracking-tight ${className}`}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <p className={`text-xs sm:text-sm text-slate-600 dark:text-fg-muted font-medium ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div className={`w-full ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div className={`mt-6 pt-4 border-t border-slate-200/60 dark:border-line flex items-center justify-between gap-4 ${className}`} {...props}>
    {children}
  </div>
);
