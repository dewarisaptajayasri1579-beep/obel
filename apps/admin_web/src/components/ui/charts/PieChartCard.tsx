"use client";

import React from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartCard, type ChartCardProps } from "./ChartCard";
import { CHART_COLORS, useChartColors } from "./chart-theme";

export interface PieChartCardDatum {
  label: string;
  value: number;
  color?: string;
}

export interface PieChartCardProps extends Omit<ChartCardProps, "children"> {
  data: PieChartCardDatum[];
  donut?: boolean;
}

export const PieChartCard: React.FC<PieChartCardProps> = ({ data, donut = false, ...cardProps }) => {
  const { tooltipContentStyle, tooltipLabelStyle } = useChartColors();
  return (
    <ChartCard {...cardProps}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={donut ? "55%" : 0}
            outerRadius="80%"
            paddingAngle={data.length > 1 ? 2 : 0}
          >
            {data.map((d, i) => (
              <Cell key={d.label} fill={d.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} />
          <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};
