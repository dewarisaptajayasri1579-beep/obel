/** Rentang tanggal untuk halaman dashboard/laporan — parse dari searchParams (?from=&to=)
 *  dengan default bulan berjalan, dipakai bareng oleh dashboard & semua halaman /laporan. */
export interface ReportPeriod {
  from: Date
  to: Date
  fromStr: string
  toStr: string
}

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function resolveReportPeriod(searchParams: { from?: string; to?: string }): ReportPeriod {
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const from = searchParams.from ? new Date(`${searchParams.from}T00:00:00`) : defaultFrom
  const to = searchParams.to ? new Date(`${searchParams.to}T23:59:59.999`) : new Date(defaultTo.setHours(23, 59, 59, 999))

  return { from, to, fromStr: toDateInputValue(from), toStr: toDateInputValue(to) }
}

export function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfToday() {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}
