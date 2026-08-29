"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./Card";

interface CollapsibleCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

export const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  title,
  description,
  children,
  defaultExpanded = true,
  className = "",
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card variant="panel" padding="none" className={`overflow-hidden transition-all duration-200 ${className}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 dark:hover:bg-surface-hover/50 transition-colors focus:outline-none cursor-pointer"
      >
        <div className="flex-1 min-w-0 pr-4">
          <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-fg truncate">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-slate-500 dark:text-fg-muted truncate mt-0.5">
              {description}
            </p>
          )}
        </div>
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-fg-muted hover:text-slate-600 dark:hover:text-fg border border-slate-200/80 dark:border-line transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        >
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>
      <div
        className={`transition-all duration-200 ease-in-out ${
          expanded ? "max-h-[1000px] border-t border-slate-100 dark:border-line opacity-100" : "max-h-0 opacity-0 overflow-hidden"
        }`}
      >
        <CardContent className="p-5">{children}</CardContent>
      </div>
    </Card>
  );
};
