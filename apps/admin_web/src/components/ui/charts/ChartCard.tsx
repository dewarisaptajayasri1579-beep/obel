import React from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "../Card";

export interface ChartCardProps {
  title?: string;
  description?: string;
  height?: number;
  children: React.ReactNode;
  className?: string;
}

export const ChartCard: React.FC<ChartCardProps> = ({ title, description, height = 300, children, className = "" }) => {
  return (
    <Card variant="panel" padding="lg" className={className}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <div style={{ width: "100%", height }}>{children}</div>
    </Card>
  );
};
