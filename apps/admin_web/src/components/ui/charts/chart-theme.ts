import type { CSSProperties } from "react"
import { usePreferences } from "@/components/providers/PreferencesProvider"

/** Palet default untuk chart, diambil dari token warna di globals.css supaya konsisten
 *  dengan komponen lain (brand blue + status colors). Warna seri sendiri (biru/hijau/dst)
 *  cukup legible di kedua tema karena cukup jenuh — cuma grid/axis/tooltip yang perlu
 *  varian gelap eksplisit, makanya lewat useChartColors() (bukan CSS var) karena Recharts
 *  butuh nilai warna langsung, bukan class Tailwind. */
export const CHART_COLORS = ["#0544cc", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#0284c7"] as const

export interface ChartSeries {
  key: string
  label: string
  color?: string
}

export const seriesColor = (series: ChartSeries, index: number): string => series.color ?? CHART_COLORS[index % CHART_COLORS.length]

export const CHART_GRID_STROKE = "#e2e8f0"
export const CHART_AXIS_TICK_STYLE = { fontSize: 12, fontWeight: 600, fill: "#64748b" }
export const CHART_TOOLTIP_CONTENT_STYLE: CSSProperties = {
  background: "rgba(255,255,255,0.95)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(226,232,240,0.9)",
  borderRadius: "16px",
  boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
  fontSize: "12px",
  fontWeight: 600,
  padding: "10px 12px",
}
export const CHART_TOOLTIP_LABEL_STYLE: CSSProperties = { color: "#1e293b", fontWeight: 700, marginBottom: 4 }

const DARK_GRID_STROKE = "#334155"
const DARK_AXIS_TICK_STYLE = { fontSize: 12, fontWeight: 600, fill: "#94a3b8" }
const DARK_TOOLTIP_CONTENT_STYLE: CSSProperties = {
  background: "rgba(30,41,59,0.95)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(71,85,105,0.6)",
  borderRadius: "16px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  fontSize: "12px",
  fontWeight: 600,
  padding: "10px 12px",
}
const DARK_TOOLTIP_LABEL_STYLE: CSSProperties = { color: "#f1f5f9", fontWeight: 700, marginBottom: 4 }

export function useChartColors() {
  const { theme } = usePreferences()
  const isDark = theme === "dark"
  return {
    gridStroke: isDark ? DARK_GRID_STROKE : CHART_GRID_STROKE,
    axisTickStyle: isDark ? DARK_AXIS_TICK_STYLE : CHART_AXIS_TICK_STYLE,
    tooltipContentStyle: isDark ? DARK_TOOLTIP_CONTENT_STYLE : CHART_TOOLTIP_CONTENT_STYLE,
    tooltipLabelStyle: isDark ? DARK_TOOLTIP_LABEL_STYLE : CHART_TOOLTIP_LABEL_STYLE,
  }
}
