// src/lib/nav-config.ts
import type { LucideIcon } from "lucide-react";
import type { MenuKey } from "./api-client";
import {
  LayoutGrid,
  ShoppingCart,
  Truck,
  PackagePlus,
  PackageX,
  MapPinned,
  PackageCheck,
  Receipt,
  Database,
  Package,
  Settings,
  Palette,
  Store,
  Clock,
  Users,
  BookOpen,
  Building2,
  UserRound,
  Radar,
  Fingerprint,
  AlertTriangle,
  ClipboardList,
  Undo2,
  ShieldCheck,
} from "lucide-react";

export interface NavItem {
  label: string;
  href?: string;
  icon?: LucideIcon;
  bottomBar?: boolean;
  children?: NavItem[];
  /// Menu hak akses (BR-044) — item tampil kalau user punya minimal Lihat.
  /// Tanpa `menu` & tanpa `ownerOnly` = selalu tampil (Tampilan, Dokumentasi).
  menu?: MenuKey;
  /// Hanya untuk Owner (mis. Peran & Hak Akses).
  ownerOnly?: boolean;
}

export interface NavGroup {
  group?: string;
  items: NavItem[];
}

/** Dua mode sidebar — sama seperti pola jsBerkah:
 *  - "utama"      : alur kerja harian (Transaksi, Data).
 *  - "pengaturan" : master data & konfigurasi sistem, dibuka lewat tombol Pengaturan. */
export type NavMode = "utama" | "pengaturan";

/* ─── MENU UTAMA — alur kerja harian ──────────────────────────────────── */

export const MAIN_NAV: NavGroup[] = [
  {
    group: "MONITORING",
    items: [
      {
        label: "Booth Aktif",
        href: "/monitoring/booth-aktif",
        menu: "BOOTH_AKTIF",
        icon: Radar,
        bottomBar: true,
      },
      {
        // Dashboard & Laporan digabung jadi satu halaman ber-tab (lihat
        // app/dashboard/page.tsx) — dulu dua entri menu terpisah yang saling
        // tumpang tindih (sama-sama "ringkasan operasional").
        label: "Dashboard",
        href: "/dashboard",
        menu: "DASHBOARD",
        icon: LayoutGrid,
        bottomBar: true,
      },
    ],
  },
  {
    group: "TRANSAKSI",
    items: [
      {
        label: "Transaksi",
        icon: ShoppingCart,
        children: [
          {
            label: "Tambah Stok Gudang",
            href: "/stok/penerimaan",
            menu: "TAMBAH_STOK_GUDANG",
            icon: PackagePlus,
            bottomBar: true,
          },
          {
            label: "Pemusnahan Stok",
            href: "/stok/pemusnahan",
            menu: "PEMUSNAHAN_STOK",
            icon: PackageX,
          },
          {
            label: "Serah Terima Stok",
            href: "/serah-terima-stok",
            menu: "SERAH_TERIMA_STOK",
            icon: Truck,
            bottomBar: true,
          },
        ],
      },
      {
        label: "Transaksi Booth",
        icon: Store,
        children: [
          {
            label: "Check In-Check Out",
            href: "/transaksi-checkin-checkout",
            menu: "CHECKIN_CHECKOUT",
            icon: Fingerprint,
            bottomBar: false,
          },
          {
            label: "Terima Stok",
            href: "/transaksi-terima-stok",
            menu: "TERIMA_STOK",
            icon: PackageCheck,
            bottomBar: false,
          },
          {
            label: "Kasir",
            href: "/transaksi-kasir",
            menu: "KASIR",
            icon: Receipt,
            bottomBar: true,
          },
          {
            label: "Setor & Pengembalian Stok",
            href: "/transaksi-laporan-kembali",
            menu: "SETOR_PENGEMBALIAN",
            icon: ClipboardList,
            bottomBar: false,
          },
          {
            label: "Rekap Stok Selisih",
            href: "/laporan/stok-selisih",
            menu: "REKAP_STOK_SELISIH",
            icon: AlertTriangle,
            bottomBar: false,
          },
          {
            label: "Rekap Pengembalian Stok",
            href: "/laporan/pengembalian-stok",
            menu: "REKAP_PENGEMBALIAN",
            icon: Undo2,
            bottomBar: false,
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
            menu: "PRODUK",
            icon: Package,
            bottomBar: false,
          },
          {
            label: "Booth",
            href: "/master/booth",
            menu: "BOOTH",
            icon: Store,
            bottomBar: false,
          },
          {
            label: "Barista",
            href: "/master/petugas",
            menu: "BARISTA",
            icon: UserRound,
            bottomBar: false,
          },
        ],
      },
    ],
  },
];

/* ─── MENU PENGATURAN — master data & konfigurasi ─────────────────────── */

export const SETTINGS_NAV: NavGroup[] = [
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
        menu: "PROFIL_PERUSAHAAN",
        icon: Building2,
        bottomBar: false,
      },
      {
        label: "Absensi",
        href: "/pengaturan/absensi",
        menu: "ABSENSI",
        icon: MapPinned,
        bottomBar: false,
      },
      {
        label: "Master Data",
        icon: Settings,
        children: [
          // Produk & Booth dipindah ke grup DATA → Data Operasional: keduanya
          // pintu masuk ke riwayat & rekap (stok, mutasi, penjualan), jadi lebih
          // sering dibuka dari sana. Sengaja TIDAK diduplikasi di sini supaya
          // tidak ada dua tautan ke halaman yang sama. Akun Petugas Booth juga
          // pindah ke sana (/master/petugas) — "User" di sini kini isinya
          // cuma akun Admin/Owner.
          //
          // Threshold Stok Booth: tautannya dilepas dari menu (bukan halamannya
          // — masih bisa dibuka lewat /master/threshold langsung), sama pola
          // dengan submenu lama lain di atas.
          { label: "Shift", href: "/master/shift", icon: Clock, menu: "SHIFT" },
          { label: "User", href: "/master/user", icon: Users, menu: "USER" },
          { label: "Peran & Hak Akses", href: "/master/peran", icon: ShieldCheck, ownerOnly: true },
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

/** Prefix URL yang otomatis membuka sidebar mode Pengaturan saat halaman
 *  di-refresh — tanpa ini, refresh di halaman master melempar sidebar balik
 *  ke Menu Utama persis ketika user sedang berada di dalamnya. */
export const SETTINGS_PREFIXES = ["/pengaturan", "/master", "/dokumentasi"];

/** Gabungan kedua mode — dipakai search bar / apa pun yang butuh daftar lengkap. */
export const NAV_GROUPS: NavGroup[] = [...MAIN_NAV, ...SETTINGS_NAV];

/** Semua href di dalam satu item, termasuk anak submenu. */
function allHrefs(item: NavItem): string[] {
  const own = item.href ? [item.href] : [];
  const nested = item.children ? item.children.flatMap(allHrefs) : [];
  return [...own, ...nested];
}

/** Semua href yang benar-benar tercantum di MENU UTAMA, termasuk anak submenu. */
const HREF_MENU_UTAMA = MAIN_NAV.flatMap((g) => g.items).flatMap(allHrefs);

/** Mode sidebar yang cocok untuk sebuah URL.
 *
 *  Halaman yang memang ADA di menu utama selalu menang atas awalan path —
 *  perlu karena "/master/produk" (Menu Utama) dan "/master/shift" (Pengaturan)
 *  berbagi prefix "/master" yang sama. */
export function detectNavMode(pathname: string): NavMode {
  if (HREF_MENU_UTAMA.some((href) => pathname === href || pathname.startsWith(`${href}/`))) return "utama";
  return SETTINGS_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ? "pengaturan" : "utama";
}

/** Href PALING SPESIFIK (terpanjang) yang cocok dengan pathname saat ini,
 *  di antara semua menu yang lagi ditampilkan — supaya cuma SATU menu yang
 *  nyala per halaman. */
export function getActiveHref(navGroups: NavGroup[], pathname: string): string | undefined {
  let best: string | undefined;
  for (const group of navGroups) {
    for (const item of group.items) {
      for (const href of allHrefs(item)) {
        const isMatch = pathname === href || pathname.startsWith(href + "/") || (pathname === "/" && href === "/dashboard");
        if (isMatch && (!best || href.length > best.length)) best = href;
      }
    }
  }
  return best;
}

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

export function flatNavItems(groups: NavGroup[]) {
  return flattenNavItems(groups.flatMap((g) => g.items));
}

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

export function bottomNavItems(groups: NavGroup[]) {
  return extractBottomNavItems(groups.flatMap((g) => g.items));
}

/** Buang item yang tidak boleh dilihat (BR-044); induk tanpa anak & grup kosong ikut hilang. */
export function filterNav(groups: NavGroup[], boleh: (item: NavItem) => boolean): NavGroup[] {
  const saring = (items: NavItem[]): NavItem[] =>
    items.flatMap((item) => {
      if (item.children) {
        const children = saring(item.children);
        return children.length > 0 ? [{ ...item, children }] : [];
      }
      return boleh(item) ? [item] : [];
    });
  return groups.map((g) => ({ ...g, items: saring(g.items) })).filter((g) => g.items.length > 0);
}

/** Halaman yang tidak ada di menu (yatim / deep link) ikut menu terdekatnya. */
const MENU_HALAMAN_LAIN: Record<string, MenuKey> = {
  "/stok/adjustment": "TAMBAH_STOK_GUDANG",
  "/stok/gudang": "TAMBAH_STOK_GUDANG",
  "/stok/opname": "TAMBAH_STOK_GUDANG",
  "/stok/booth": "BOOTH",
  "/master/threshold": "BOOTH",
  "/koreksi": "DASHBOARD",
  "/return": "SETOR_PENGEMBALIAN",
  "/penjualan": "KASIR",
};

/** Syarat akses sebuah halaman admin: menu tertentu, khusus Owner, atau bebas. */
export function accessForPath(
  pathname: string
): { kind: "menu"; menu: MenuKey } | { kind: "owner" } | { kind: "free" } {
  const cocok = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  let terbaik: NavItem | undefined;
  const telusuri = (items: NavItem[]) => {
    for (const item of items) {
      if (item.href && cocok(item.href) && (!terbaik || item.href.length > (terbaik.href ?? "").length)) terbaik = item;
      if (item.children) telusuri(item.children);
    }
  };
  telusuri(NAV_GROUPS.flatMap((g) => g.items));
  if (terbaik?.ownerOnly) return { kind: "owner" };
  if (terbaik?.menu) return { kind: "menu", menu: terbaik.menu };
  const lain = Object.entries(MENU_HALAMAN_LAIN).find(([href]) => cocok(href));
  return lain ? { kind: "menu", menu: lain[1] } : { kind: "free" };
}