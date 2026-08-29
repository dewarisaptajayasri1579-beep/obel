import type { LucideIcon } from "lucide-react"
import {
  LayoutGrid,
  Truck,
  PackageSearch,
  Warehouse,
  Undo2,
  Receipt,
  BarChart3,
  Settings,
  ClipboardCheck,
  History,
} from "lucide-react"

export interface NavItem {
  label: string
  href?: string
  icon?: LucideIcon
  bottomBar?: boolean
  children?: NavItem[]
}

export interface NavGroup {
  group?: string
  items: NavItem[]
}

/** Menu Admin Pusat sesuai docs/obbel-coffee-ai-docs/05-feature-specification.md §B
 *  dan 21-screen-route-map.md §B. Rute di bawah "Segera" belum tersambung ke
 *  Backend API — menyusul setelah endpoint terkait dibuat. */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutGrid, bottomBar: true }],
  },
  {
    group: "Stok",
    items: [
      { label: "Distribusi Stok", href: "/distribusi", icon: Truck, bottomBar: true },
      { label: "Restock Booth", href: "/restock", icon: PackageSearch, bottomBar: true },
      { label: "Monitor Stok Booth", href: "/stok/booth", icon: PackageSearch, bottomBar: false },
      { label: "Stok Gudang", href: "/stok/gudang", icon: Warehouse, bottomBar: false },
      { label: "Stok Opname", href: "/stok/opname", icon: ClipboardCheck, bottomBar: false },
      { label: "Adjustment / Koreksi Stok", href: "/stok/adjustment", icon: Undo2, bottomBar: false },
      { label: "Return Stok", href: "/return", icon: Undo2, bottomBar: false },
    ],
  },
  {
    group: "Penjualan & Laporan",
    items: [
      { label: "Penjualan", href: "/penjualan", icon: Receipt, bottomBar: true },
      { label: "Laporan", href: "/laporan", icon: BarChart3, bottomBar: false },
      { label: "Riwayat & Koreksi Data", href: "/koreksi", icon: History, bottomBar: false },
    ],
  },
  {
    group: "Master Data",
    items: [
      {
        label: "Master Data",
        icon: Settings,
        children: [
          { label: "Produk", href: "/master/produk" },
          { label: "Booth", href: "/master/booth" },
          { label: "Shift", href: "/master/shift" },
          { label: "Threshold Stok Booth", href: "/master/threshold" },
          { label: "User", href: "/master/user" },
        ],
      },
    ],
  },
]

function flattenNavItems(items: NavItem[], parentLabel?: string): { label: string; href: string }[] {
  return items.flatMap((item) => {
    const label = parentLabel ? `${parentLabel} / ${item.label}` : item.label
    const own = item.href ? [{ label, href: item.href }] : []
    const nested = item.children ? flattenNavItems(item.children, item.label) : []
    return [...own, ...nested]
  })
}

export const FLAT_NAV_ITEMS = flattenNavItems(NAV_GROUPS.flatMap((g) => g.items))

export const BOTTOM_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items).filter(
  (i): i is NavItem & { href: string; icon: LucideIcon } => Boolean(i.bottomBar && i.href && i.icon)
)
