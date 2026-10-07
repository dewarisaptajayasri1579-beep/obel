"use client"

import { useCallback, useEffect, useState } from "react"
import type { NotificationItem } from "@/lib/api-client"

/// Kunci "sudah dibaca". Notifikasi diturunkan dari kondisi saat ini (tidak ada status baca di server),
/// jadi kuncinya ikut berubah saat kejadiannya berubah dan item muncul lagi sebagai belum dibaca:
/// item stok (`lowstock…`) berubah kalau daftar produknya berubah (bukan setiap penjualan), item lain
/// kalau ada kejadian yang lebih baru.
export const kunciBaca = (n: NotificationItem) =>
  n.id.startsWith("lowstock") ? `${n.id}|${n.message}` : `${n.id}|${n.createdAt}`

/// Status dibaca per akun, disimpan di localStorage `storageKey` (bel Admin, layar Notifikasi Barista).
export function useStatusDibaca(storageKey: string) {
  const [dibaca, setDibaca] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      setDibaca(new Set(JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as string[]))
    } catch {
      setDibaca(new Set())
    }
  }, [storageKey])

  /// Tandai `baru` dibaca. Hanya kunci item yang masih ada (`daftar`) yang disimpan, supaya
  /// penyimpanan tidak terus membesar.
  const tandai = useCallback(
    (baru: NotificationItem[], daftar: NotificationItem[]) => {
      setDibaca((lama) => {
        const masihAda = new Set(daftar.map(kunciBaca))
        const rapi = new Set([...lama, ...baru.map(kunciBaca)].filter((k) => masihAda.has(k)))
        try {
          window.localStorage.setItem(storageKey, JSON.stringify([...rapi]))
        } catch {
          // Penyimpanan diblokir: status baca hanya bertahan selama halaman terbuka.
        }
        return rapi
      })
    },
    [storageKey],
  )

  const sudahDibaca = useCallback((n: NotificationItem) => dibaca.has(kunciBaca(n)), [dibaca])

  return { sudahDibaca, tandai }
}
