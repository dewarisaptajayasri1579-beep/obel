// src/lib/nav-config.ts
import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  ShoppingCart,
  TrendingUp,
  Truck,
  PackagePlus,
  PackageSearch,
  Undo2,
  Receipt,
  Database,
  Package,
  Settings,
  Palette,
  Store,
  Clock,
  SlidersHorizontal,
  Users,
  BookOpen,
  Building2,
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
        // Dashboard & Laporan digabung jadi satu halaman ber-tab (lihat
        // app/dashboard/page.tsx) — dulu dua entri menu terpisah yang saling
        // tumpang tindih (sama-sama "ringkasan operasional").
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutGrid,
        bottomBar: true,
      },
    ],
  },
  {
    group: "TRANSAKSI",
    items: [
      {
        label: "Transaksi Kantor",
        icon: ShoppingCart,
        children: [
          {
            label: "Tambah Stok Gudang",
            href: "/stok/penerimaan",
            icon: PackagePlus,
            bottomBar: true,
          },
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
        label: "Transaksi Booth",
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
    // Submenu lama (Monitor Stok Booth, Stok Gudang, Stok Opname, Adjustment)
    // sedang disusun ulang mengikuti docsV2/06-data-operasional.md. Halamannya
    // TIDAK dihapus dan masih bisa dibuka lewat URL langsung — yang dilepas
    // hanya tautannya, sampai penggantinya siap.
    group: "DATA",
    items: [
      {
        label: "Data Operasional",
        icon: Database,
        children: [
          {
            label: "Produk",
            href: "/master/produk",
            icon: Package,
            bottomBar: false,
          },
          {
            label: "Booth",
            href: "/master/booth",
            icon: Store,
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
        label: "Tampilan",
        href: "/pengaturan/tampilan",
        icon: Palette,
        bottomBar: false,
      },
      {
        label: "Profil Perusahaan",
        href: "/pengaturan/profil-perusahaan",
        icon: Building2,
        bottomBar: false,
      },
      {
        label: "Master Data",
        icon: Settings,
        children: [
          // Produk & Booth dipindah ke grup DATA → Data Operasional: keduanya
          // pintu masuk ke riwayat & rekap (stok, mutasi, penjualan), jadi lebih
          // sering dibuka dari sana. Sengaja TIDAK diduplikasi di sini supaya
          // tidak ada dua tautan ke halaman yang sama.
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