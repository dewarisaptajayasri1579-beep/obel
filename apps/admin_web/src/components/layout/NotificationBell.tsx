"use client"

import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { api } from "@/lib/api-client"

interface NotificationItem {
  id: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error"
  readAt: string | null
  createdAt: string
}

const TYPE_DOT: Record<NotificationItem["type"], string> = {
  info: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
}

export function NotificationBell({ iconButtonClass }: { iconButtonClass: string }) {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  const unreadCount = items.filter((n) => !dismissedIds.has(n.id)).length

  async function load() {
    try {
      const data = await api.getNotifications()
      setItems(data)
    } catch {
      // Backend belum bisa dihubungi — bell tetap tampil kosong, tidak error keras.
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function markRead(id: string) {
    setDismissedIds((prev) => new Set(prev).add(id))
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className={`${iconButtonClass} relative`} aria-label="Notifikasi" title="Notifikasi">
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 glass-dropdown p-2 rounded-2xl shadow-xl z-50 max-h-96 overflow-y-auto">
          <div className="px-3 py-2 border-b border-slate-200/60 dark:border-line mb-1">
            <p className="text-xs font-bold text-slate-800 dark:text-fg">Notifikasi</p>
          </div>
          {items.length === 0 && <p className="px-3 py-4 text-xs text-slate-500 dark:text-fg-muted text-center">Belum ada notifikasi.</p>}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-surface-hover ${
                dismissedIds.has(n.id) ? "opacity-60" : ""
              }`}
            >
              <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${TYPE_DOT[n.type]}`} />
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-bold text-slate-800 dark:text-fg">{n.title}</span>
                <span className="block text-[11px] text-slate-500 dark:text-fg-muted mt-0.5">{n.message}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
