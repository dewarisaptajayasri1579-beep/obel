import React from "react";

export interface SkeletonProps {
  variant?: "text" | "circle" | "rect";
  width?: string | number;
  height?: string | number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ variant = "text", width, height, className = "" }) => {
  const shapeClasses = {
    text: "h-4 rounded-md w-full",
    circle: "rounded-full aspect-square",
    rect: "rounded-2xl w-full",
  };

  return (
    <div
      className={`bg-slate-200/70 dark:bg-surface-hover animate-pulse-subtle ${shapeClasses[variant]} ${className}`}
      style={{ width, height: height ?? (variant === "circle" ? width : undefined) }}
      aria-hidden="true"
    />
  );
};
