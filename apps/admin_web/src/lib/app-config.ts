import type { LucideIcon } from "lucide-react"
import { PackageSearch, Truck, LayoutDashboard } from "lucide-react"

/** Satu sumber kebenaran identitas aplikasi — dipakai AppLogo, Sidebar, Header, AuthLayout. */
export const APP_CONFIG = {
  name: "Obbel Admin Pusat",
  tagline: "Obbel Coffee & Milk",
  subTagline: "Stock, Sales & Booth Monitoring",
  authDescription: "Kontrol stok Gudang, distribusi ke Booth, dan pantau operasional dalam satu tempat.",
  authFeatures: [
    { icon: LayoutDashboard as LucideIcon, title: "Dashboard Real-time", desc: "Omzet, stok, dan alert" },
    { icon: Truck as LucideIcon, title: "Distribusi Stok", desc: "Gudang ke Booth terlacak" },
    { icon: PackageSearch as LucideIcon, title: "Audit Stok", desc: "Ledger tiap pergerakan" },
  ],
} as const
