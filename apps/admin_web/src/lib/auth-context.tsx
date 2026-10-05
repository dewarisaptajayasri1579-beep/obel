"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { api, type AccessLevel, type LoginResponse, type MenuKey, type UserAccess } from "./api-client"

const ADMIN_STORAGE_KEY = "obbel-admin-session"
const PETUGAS_STORAGE_KEY = "obbel-petugas-session"

/// Admin (/login, /dashboard, dst) dan Web Petugas Booth (/petugas/*) SENGAJA
/// disimpan di key localStorage yang beda — supaya dua sesi (mis. Admin di
/// satu tab, Petugas di tab lain) bisa aktif BERSAMAAN di browser yang sama
/// tanpa saling menimpa. Lihat juga getToken()/forceReauth() di
/// api-client.ts yang harus ikut logika area yang sama.
function areaKeyFor(pathname: string): string {
  return pathname.startsWith("/petugas") ? PETUGAS_STORAGE_KEY : ADMIN_STORAGE_KEY
}

interface Session {
  token: string
  profile: LoginResponse["profile"]
  /// Hak akses menu admin web (BR-044). Bisa kosong di sesi lama (sebelum RBAC) —
  /// diisi ulang dari GET /users/me setiap aplikasi dimuat.
  access?: UserAccess
}

interface AuthContextValue {
  session: Session | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  /// Backend me-reissue token (mis. setelah Check-In, supaya JWT membawa
  /// boothId terbaru — lihat ShiftsService.reissueToken di backend) — dipakai
  /// utk menyimpan token baru itu tanpa login ulang.
  updateToken: (token: string) => void
  /// true setelah hak akses terbaru diambil dari server (admin area).
  accessReady: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/"
  const storageKey = areaKeyFor(pathname)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessReady, setAccessReady] = useState(false)

  // Dep `storageKey` (bukan cuma `[]`) — begitu pathname pindah area
  // (Admin <-> Petugas) lewat navigasi client-side, sesi yang dibaca ikut
  // pindah ke slot localStorage area itu, bukan tetap membawa sesi area lama.
  useEffect(() => {
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      try {
        setSession(JSON.parse(raw))
      } catch {
        localStorage.removeItem(storageKey)
        setSession(null)
      }
    } else {
      setSession(null)
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // Peran bisa diubah Owner kapan saja dan berlaku langsung di backend — ambil hak akses
  // terbaru setiap aplikasi dimuat supaya menu ikut, tanpa perlu login ulang.
  const sessionUserId = session?.profile.id
  const sessionRole = session?.profile.role
  useEffect(() => {
    if (!sessionUserId || sessionRole === "BOOTH_STAFF" || storageKey !== ADMIN_STORAGE_KEY) return
    let batal = false
    setAccessReady(false)
    api
      .getMyProfile()
      .then((me) => {
        if (batal) return
        setSession((prev) => {
          if (!prev || prev.profile.id !== me.id) return prev
          const next = { ...prev, profile: { ...prev.profile, fullName: me.fullName }, access: me.access }
          localStorage.setItem(storageKey, JSON.stringify(next))
          return next
        })
        setAccessReady(true)
      })
      .catch(() => {
        // 401 sudah ditangani request() (paksa login ulang); error lain: pakai akses tersimpan.
        if (!batal) setAccessReady(true)
      })
    return () => {
      batal = true
    }
  }, [sessionUserId, sessionRole, storageKey])

  async function login(username: string, password: string) {
    const result = await api.login(username, password)
    const next: Session = { token: result.accessToken, profile: result.profile, access: result.access }
    localStorage.setItem(storageKey, JSON.stringify(next))
    setSession(next)
  }

  function logout() {
    localStorage.removeItem(storageKey)
    setSession(null)
  }

  function updateToken(token: string) {
    setSession((prev) => {
      if (!prev) return prev
      const next = { ...prev, token }
      localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }

  return (
    <AuthContext.Provider value={{ session, loading, login, logout, updateToken, accessReady }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

/// Hak akses menu admin web untuk UI (BR-044). Backend tetap penentu — ini hanya
/// menyembunyikan menu/tombol yang pasti ditolak.
export function useAccess() {
  const { session } = useAuth()
  const levels = session?.access?.levels ?? {}
  const isOwner = session?.profile.role === "OWNER"
  const punya = (menu: MenuKey, level: AccessLevel) =>
    levels[menu] === "MANAGE" || (level === "VIEW" && levels[menu] === "VIEW")
  return {
    isOwner,
    roleName: session?.access?.roleName ?? null,
    canView: (menu: MenuKey) => punya(menu, "VIEW"),
    canManage: (menu: MenuKey) => punya(menu, "MANAGE"),
  }
}
