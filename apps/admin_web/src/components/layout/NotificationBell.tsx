"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, BellOff, PackageX, RefreshCw, ShieldAlert, Truck, Wallet, type LucideIcon } from "lucide-react"
import { api, type NotificationItem } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { formatWaktuRelatif } from "@/lib/datetime"
import { useStatusDibaca } from "@/lib/notifikasi"

/// Jenis notifikasi Admin dikenali dari awalan `id` (lihat NotificationsService.getAll): label, ikon,
/// dan halaman yang dibuka saat diklik.
const JENIS: { awalan: string; label: string; ikon: LucideIcon; href: string }[] = [
  { awalan: "lowstock:", label: "Stok Booth", ikon: PackageX, href: "/monitoring/booth-aktif" },
  { awalan: "pending:distributions", label: "Serah Terima", ikon: Truck, href: "/serah-terima-stok" },
  { awalan: "pending:restock", label: "Restock", ikon: RefreshCw, href: "/serah-terima-stok" },
  { awalan: "pending:approve", label: "Setor & Pengembalian", ikon: Wallet, href: "/transaksi-laporan-kembali" },
  { awalan: "reconciliation:", label: "Rekonsiliasi", ikon: ShieldAlert, href: "/koreksi" },
]
const jenisDari = (n: NotificationItem) => JENIS.find((j) => n.id.startsWith(j.awalan)) ?? { label: "Info", ikon: Bell, href: null }

const WARNA: Record<NotificationItem["type"], string> = {
  info: "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400",
  success: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  warning: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  error: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
}

const INTERVAL_MS = 30_000

export function NotificationBell({ iconButtonClass }: { iconButtonClass: string }) {
  const router = useRouter()
  const { session } = useAuth()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)
  const [sekarang, setSekarang] = useState(() => new Date())
  const memuat = useRef(false)
  const wadah = useRef<HTMLDivElement>(null)
  // Status baca per akun (dua Admin bisa memakai browser yang sama).
  const { sudahDibaca, tandai } = useStatusDibaca(`obbel-admin-notif-dibaca:${session?.profile.id ?? "-"}`)

  const load = useCallback(async () => {
    if (memuat.current) return
    memuat.current = true
    try {
      setItems(await api.getNotifications())
      setSekarang(new Date())
    } catch {
      // Backend belum bisa dihubungi — bell tetap tampil, tidak error keras.
    } finally {
      memuat.current = false
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load()
    }, INTERVAL_MS)
    const saatTerlihat = () => {
      if (document.visibilityState === "visible") load()
    }
    document.addEventListener("visibilitychange", saatTerlihat)
    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", saatTerlihat)
    }
  }, [load])

  useEffect(() => {
    if (!open) return
    const tutup = (e: MouseEvent) => {
      if (wadah.current && !wadah.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", tutup)
    return () => document.removeEventListener("mousedown", tutup)
  }, [open])

  const belumDibaca = items.filter((n) => !sudahDibaca(n)).length

  function buka(n: NotificationItem) {
    tandai([n], items)
    setOpen(false)
    const { href } = jenisDari(n)
    if (href) router.push(href)
  }

  return (
    <div className="relative" ref={wadah}>
      <button onClick={() => setOpen((v) => !v)} className={`${iconButtonClass} relative`} aria-label="Notifikasi" title="Notifikasi">
        <Bell className="w-4 h-4" />
        {belumDibaca > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-bold">
            {belumDibaca > 9 ? "9+" : belumDibaca}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 glass-dropdown p-2 rounded-2xl shadow-xl z-50">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200/60 dark:border-line mb-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-slate-800 dark:text-fg">Notifikasi</p>
              {belumDibaca > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400 text-[11px] font-bold">
                  {belumDibaca} baru
                </span>
              )}
            </div>
            {belumDibaca > 0 && (
              <button
                type="button"
                onClick={() => tandai(items, items)}
                className="text-xs font-semibold text-brand-700 dark:text-brand-400 hover:underline cursor-pointer"
              >
                Tandai dibaca
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="w-10 h-10 rounded-full bg-slate-100 dark:bg-surface-hover flex items-center justify-center">
                <BellOff className="w-4 h-4 text-slate-400 dark:text-fg-muted" />
              </span>
              <p className="text-xs text-slate-500 dark:text-fg-muted">Belum ada notifikasi.</p>
            </div>
          ) : (
            <div className="max-h-112 overflow-y-auto space-y-0.5">
              {items.map((n) => {
                const jenis = jenisDari(n)
                const Ikon = jenis.ikon
                const baru = !sudahDibaca(n)
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => buka(n)}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 text-left rounded-xl transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-surface-hover ${
                      baru ? "bg-brand-50/60 dark:bg-brand-500/5" : ""
                    }`}
                  >
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${WARNA[n.type]}`}>
                      <Ikon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className={`text-xs truncate ${baru ? "font-bold text-slate-900 dark:text-fg" : "font-semibold text-slate-700 dark:text-fg-secondary"}`}>
                          {n.title}
                        </span>
                        {baru && <span className="w-1.5 h-1.5 rounded-full bg-brand-600 shrink-0" />}
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-fg-muted mt-0.5">{n.message}</span>
                      <span className="block text-[10px] text-slate-400 dark:text-fg-muted mt-1">
                        {jenis.label} • {formatWaktuRelatif(n.createdAt, sekarang)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
