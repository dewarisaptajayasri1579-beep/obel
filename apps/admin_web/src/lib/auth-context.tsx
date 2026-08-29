"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { api, type LoginResponse } from "./api-client"

const STORAGE_KEY = "obbel-admin-session"

interface Session {
  token: string
  profile: LoginResponse["profile"]
}

interface AuthContextValue {
  session: Session | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        setSession(JSON.parse(raw))
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setLoading(false)
  }, [])

  async function login(username: string, password: string) {
    const result = await api.login(username, password)
    const next: Session = { token: result.accessToken, profile: result.profile }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setSession(next)
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    setSession(null)
  }

  return <AuthContext.Provider value={{ session, loading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
