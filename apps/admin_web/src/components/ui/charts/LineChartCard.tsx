"use client";

import React from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartCard, type ChartCardProps } from "./ChartCard";
import { seriesColor, useChartColors, type ChartSeries } from "./chart-theme";

export interface LineChartCardProps extends Omit<ChartCardProps, "children"> {
  data: Record<string, unknown>[];
  xKey: string;
  series: ChartSeries[];
}

export const LineChartCard: React.FC<LineChartCardProps> = ({ data, xKey, series, ...cardProps }) => {
  const { gridStroke, axisTickStyle, tooltipContentStyle, tooltipLabelStyle } = useChartColors();
  return (
    <ChartCard {...cardProps}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={gridStroke} vertical={false} />
          <XAxis dataKey={xKey} tick={axisTickStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={seriesColor(s, i)}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};
