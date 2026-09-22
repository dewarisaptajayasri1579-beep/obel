/** Helper format angka/tanggal yang dipakai berulang di seluruh halaman "Stock & Keuangan
 *  Multi-Bisnis" — REUSE fungsi ini daripada menulis ulang Intl.NumberFormat/DateTimeFormat
 *  di tiap komponen (lihat pola serupa yang sudah ada di DemoTransaksiTable.tsx). */

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    Math.round(amount)
  )
}

export function formatDate(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(
    date
  )
}

export function formatDateLong(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(
    date
  )
}

export function formatDateTime(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value)
}
