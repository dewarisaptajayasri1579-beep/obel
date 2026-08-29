"use client";

import React from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartCard, type ChartCardProps } from "./ChartCard";
import { seriesColor, useChartColors, type ChartSeries } from "./chart-theme";

export interface BarChartCardProps extends Omit<ChartCardProps, "children"> {
  data: Record<string, unknown>[];
  xKey: string;
  series: ChartSeries[];
}

export const BarChartCard: React.FC<BarChartCardProps> = ({ data, xKey, series, ...cardProps }) => {
  const { gridStroke, axisTickStyle, tooltipContentStyle, tooltipLabelStyle } = useChartColors();
  return (
    <ChartCard {...cardProps}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={gridStroke} vertical={false} />
          <XAxis dataKey={xKey} tick={axisTickStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: "rgba(148,163,184,0.12)" }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={seriesColor(s, i)} radius={[8, 8, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};
