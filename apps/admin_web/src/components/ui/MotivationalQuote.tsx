"use client";

import React, { useEffect, useState } from "react";
import { getRandomMotivationalQuote } from "@/lib/motivational-quotes";

export const MotivationalQuote: React.FC<{ className?: string; role?: string }> = ({ className = "", role }) => {
  // Dipilih setelah mount (bukan saat SSR) supaya tidak mismatch hydration —
  // kalimatnya boleh beda tiap reload/refresh, itu memang tujuannya ("ganti-ganti").
  const [quote, setQuote] = useState<string | null>(null);

  useEffect(() => {
    setQuote(getRandomMotivationalQuote(role));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  if (!quote) return null;

  return <p className={`italic text-slate-500 dark:text-fg-muted ${className}`}>&ldquo;{quote}&rdquo;</p>;
};
