// src/lib/nav-config.ts
import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  BarChart3,
  ShoppingCart,
  TrendingUp,
  Truck,
  PackageSearch,
  Undo2,
  Receipt,
  Database,
  Package,
  Warehouse,
  ClipboardCheck,
  Settings,
  Sliders,
  Store,
  Clock,
  SlidersHorizontal,
  Users,
  BookOpen,
} from "lucide-react";

export interface NavItem {
  label: string;
  href?: string;
  icon?: LucideIcon;
  bottomBar?: boolean;
  children?: NavItem[];
}

export interface NavGroup {
  group?: string;
  items: NavItem[];
}

/** 
 * Konfigurasi Menu Navigasi Obbel Admin
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    // Group Tanpa Label (Top-Level)
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutGrid,
        bottomBar: true,
      },
      {
        label: "Laporan",
        href: "/laporan",
        icon: BarChart3,
        bottomBar: true,
      },
    ],
  },
  {
    group: "TRANSAKSI",
    items: [
      {
        label: "Pembelian & Stok",
        icon: ShoppingCart,
        children: [
          {
            label: "Distribusi Stok",
            href: "/distribusi",
            icon: Truck,
            bottomBar: true,
          },
          {
            label: "Restock Booth",
            href: "/restock",
            icon: PackageSearch,
            bottomBar: true,
          },
          {
            label: "Return Stok",
            href: "/return",
            icon: Undo2,
            bottomBar: false,
          },
        ],
      },
      {
        label: "Aktivitas Sales",
        icon: TrendingUp,
        children: [
          {
            label: "Penjualan",
            href: "/penjualan",
            icon: Receipt,
            bottomBar: true,
          },
        ],
      },
    ],
  },
  {
    group: "DATA",
    items: [
      {
        label: "Data Operasional",
        icon: Database,
        children: [
          {
            label: "Monitor Stok Booth",
            href: "/stok/booth",
            icon: Package,
            bottomBar: false,
          },
          {
            label: "Stok Gudang",
            href: "/stok/gudang",
            icon: Warehouse,
            bottomBar: false,
          },
          {
            label: "Stok Opname",
            href: "/stok/opname",
            icon: ClipboardCheck,
            bottomBar: false,
          },
          {
            label: "Adjustment / Koreksi Stok",
            href: "/stok/adjustment",
            icon: Sliders,
            bottomBar: false,
          },
        ],
      },
    ],
  },
  {
    group: "PENGATURAN",
    items: [
      {
        label: "Master Data",
        icon: Settings,
        children: [
          { label: "Produk", href: "/master/produk", icon: Package },
          { label: "Booth", href: "/master/booth", icon: Store },
          { label: "Shift", href: "/master/shift", icon: Clock },
          { label: "Threshold Stok Booth", href: "/master/threshold", icon: SlidersHorizontal },
          { label: "User", href: "/master/user", icon: Users },
        ],
      },
      {
        label: "Dokumentasi Sistem",
        href: "/dokumentasi",
        icon: BookOpen,
        bottomBar: false,
      },
    ],
  },
];

// Helper untuk perataan hierarki (pencarian/search bar)
function flattenNavItems(
  items: NavItem[],
  parentLabel?: string
): { label: string; href: string }[] {
  return items.flatMap((item) => {
    const label = parentLabel ? `${parentLabel} / ${item.label}` : item.label;
    const own = item.href ? [{ label, href: item.href }] : [];
    const nested = item.children
      ? flattenNavItems(item.children, item.label)
      : [];
    return [...own, ...nested];
  });
}

export const FLAT_NAV_ITEMS = flattenNavItems(
  NAV_GROUPS.flatMap((g) => g.items)
);

// Helper untuk menu Bottom Bar Mobile
function extractBottomNavItems(
  items: NavItem[]
): (NavItem & { href: string; icon: LucideIcon })[] {
  return items.flatMap((item) => {
    const own =
      item.bottomBar && item.href && item.icon
        ? [item as NavItem & { href: string; icon: LucideIcon }]
        : [];
    const nested = item.children ? extractBottomNavItems(item.children) : [];
    return [...own, ...nested];
  });
}

export const BOTTOM_NAV_ITEMS = extractBottomNavItems(
  NAV_GROUPS.flatMap((g) => g.items)
);