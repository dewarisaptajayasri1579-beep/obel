"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: "top" | "bottom" | "left" | "right";
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, placement = "top" }) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => setMounted(true), []);

  const updateCoords = () => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const positions = {
      top: { top: rect.top - 8, left: rect.left + rect.width / 2 },
      bottom: { top: rect.bottom + 8, left: rect.left + rect.width / 2 },
      left: { top: rect.top + rect.height / 2, left: rect.left - 8 },
      right: { top: rect.top + rect.height / 2, left: rect.right + 8 },
    };
    setCoords(positions[placement]);
  };

  const show = () => {
    updateCoords();
    setOpen(true);
  };

  const translate: Record<NonNullable<TooltipProps["placement"]>, string> = {
    top: "translate(-50%, -100%)",
    bottom: "translate(-50%, 0)",
    left: "translate(-100%, -50%)",
    right: "translate(0, -50%)",
  };

  return (
    <span ref={wrapperRef} onMouseEnter={show} onMouseLeave={() => setOpen(false)} onFocus={show} onBlur={() => setOpen(false)} className="inline-flex">
      {children}
      {open &&
        mounted &&
        coords &&
        createPortal(
          <div
            role="tooltip"
            style={{ top: coords.top, left: coords.left, transform: translate[placement] }}
            className="fixed z-[80] px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-surface-hover text-white text-[11px] font-semibold whitespace-nowrap pointer-events-none shadow-lg"
          >
            {content}
          </div>,
          document.body
        )}
    </span>
  );
};
