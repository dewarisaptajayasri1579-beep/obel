"use client";

import React from "react";
import {
  ComposedChart,
  Line,
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

export interface MixedChartCardProps extends Omit<ChartCardProps, "children"> {
  data: Record<string, unknown>[];
  xKey: string;
  barSeries: ChartSeries[];
  lineSeries: ChartSeries[];
}

export const MixedChartCard: React.FC<MixedChartCardProps> = ({
  data,
  xKey,
  barSeries,
  lineSeries,
  ...cardProps
}) => {
  const { gridStroke, axisTickStyle, tooltipContentStyle, tooltipLabelStyle } = useChartColors();
  
  return (
    <ChartCard {...cardProps}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={gridStroke} vertical={false} />
          <XAxis dataKey={xKey} tick={axisTickStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} />
          <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
          
          {barSeries.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={seriesColor(s, i)}
              radius={[4, 4, 0, 0]}
              maxBarSize={30}
            />
          ))}
          
          {lineSeries.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={seriesColor(s, i + barSeries.length)}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};
