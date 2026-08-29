"use client";

import React from "react";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartCard, type ChartCardProps } from "./ChartCard";
import { seriesColor, useChartColors, type ChartSeries } from "./chart-theme";

export interface AreaChartCardProps extends Omit<ChartCardProps, "children"> {
  data: Record<string, unknown>[];
  xKey: string;
  series: ChartSeries[];
}

export const AreaChartCard: React.FC<AreaChartCardProps> = ({ data, xKey, series, ...cardProps }) => {
  const { gridStroke, axisTickStyle, tooltipContentStyle, tooltipLabelStyle } = useChartColors();
  return (
    <ChartCard {...cardProps}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <defs>
            {series.map((s, i) => {
              const color = seriesColor(s, i);
              return (
                <linearGradient key={s.key} id={`area-fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid stroke={gridStroke} vertical={false} />
          <XAxis dataKey={xKey} tick={axisTickStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />}
          {series.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={seriesColor(s, i)}
              strokeWidth={2.5}
              fill={`url(#area-fill-${s.key})`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};
