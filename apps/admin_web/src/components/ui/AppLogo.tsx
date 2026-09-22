import React from "react";
import { APP_CONFIG } from "@/lib/app-config";

interface AppLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  layout?: "horizontal" | "vertical";
  showTagline?: boolean;
  iconOnly?: boolean;
  textColor?: string;
  className?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  size = "md",
  layout = "horizontal",
  showTagline = true,
  iconOnly = false,
  textColor = "text-[#1B7A4B] dark:text-white",
  className = "",
}) => {
  const iconSizes = {
    sm: "w-9 h-9",
    md: "w-16 h-16",
    lg: "w-22 h-22 lg:w-24 lg:h-24",
    xl: "w-28 h-28 sm:w-32 sm:h-32",
  };

  const titleSizes = {
    sm: "text-lg",
    md: "text-3xl",
    lg: "text-4xl xl:text-5xl",
    xl: "text-4xl sm:text-5xl",
  };

  const subtitleSizes = {
    sm: "text-[10px]",
    md: "text-sm",
    lg: "text-base xl:text-lg",
    xl: "text-sm sm:text-base",
  };

  return (
    <div
      className={`flex ${
        layout === "vertical" ? "flex-col items-center text-center" : "flex-row items-center gap-3"
      } ${className}`}
    >
      <div className={`relative flex-shrink-0 rounded-full overflow-hidden shadow-md ${iconSizes[size]}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Obbel" className="w-full h-full object-cover select-none" />
      </div>

      {!iconOnly && (
        <div className={layout === "vertical" ? "mt-3" : ""}>
          <h1 className={`font-black tracking-tight leading-none ${textColor} ${titleSizes[size]}`}>
            {APP_CONFIG.name}
          </h1>
          {showTagline && (
            <div className={`mt-1.5 font-bold leading-tight ${subtitleSizes[size]}`}>
              <div className="text-brand-600 dark:text-[var(--accent-primary)]">{APP_CONFIG.tagline}</div>
              <div className="text-slate-600 dark:text-fg-muted font-semibold">{APP_CONFIG.subTagline}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
