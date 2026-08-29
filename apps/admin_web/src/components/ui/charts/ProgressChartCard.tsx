"use client";

import React from "react";
import { ChartCard, type ChartCardProps } from "./ChartCard";

export interface ProgressItem {
  label: string;
  value: number; // 0 to 100
  colorClass?: string;
  valueLabel?: string;
}

export interface ProgressChartCardProps extends Omit<ChartCardProps, "children"> {
  data: ProgressItem[];
}

export const ProgressChartCard: React.FC<ProgressChartCardProps> = ({ data, ...cardProps }) => {
  return (
    <ChartCard {...cardProps}>
      <div className="space-y-4 pt-1 h-full overflow-y-auto">
        {data.map((item, index) => {
          const color = item.colorClass ?? "bg-blue-600 dark:bg-[#3B82F6]";
          return (
            <div key={index} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-fg-secondary">
                <span>{item.label}</span>
                <span className="text-slate-500 dark:text-fg-muted">
                  {item.valueLabel ?? `${item.value}%`}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-black/10 overflow-hidden border border-slate-200/40 dark:border-line/20">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${color}`}
                  style={{ width: `${item.value}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
};
