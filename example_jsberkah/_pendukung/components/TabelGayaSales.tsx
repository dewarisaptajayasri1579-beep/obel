"use client"

import { Fragment, useMemo, useRef, useState, useEffect } from "react"
import { Search, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, Filter, Check, FileText, FileSpreadsheet, Calendar } from "lucide-react"
import { ColumnVisibilityMenu } from "@/components/ui"
import type { ColumnDef } from "@/lib/use-column-visibility"
import { formatDateLong } from "@/lib/format"
import { getPageWindow } from "@/lib/pagination"

export interface KolomGayaSales<T> {
  key: string
  header: string
  align?: "left" | "right" | "center"
  /** Diberikan → kolom ini bisa di-klik untuk sort. Dihilangkan → header polos, tidak bisa di-sort. */
  sortValue?: (row: T) => string | number
  /** Diberikan → nilainya ikut dicocokkan kotak pencarian. Kalau tidak ada satu pun kolom dengan
   *  ini, kotak pencarian disembunyikan (tabelnya dianggap tidak perlu dicari). */
  filterValue?: (row: T) => string
  /** `index` = posisi baris ini di seluruh data terurut/tersaring (0-based, lintas halaman) —
   *  dipakai kolom "No." atau lencana rank yang perlu ikut menyesuaikan saat user sort ulang. */
  cell: (row: T, index: number) => React.ReactNode
}

export interface GrupFilterGayaSales<T> {
  key: string
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  /** Baris lolos filter ini kalau `predicate` true, ATAU kalau `value` kosong (berarti "semua"). */
  predicate: (row: T, value: string) => boolean
}

export interface MenuKolomGayaSales {
  columns: ColumnDef[]
  isVisible: (key: string) => boolean
  toggle: (key: string) => void
}

export interface TombolPdfGayaSales {
  title?: string
  onClick: () => void
}

export type OpsiPeriodeGayaSales = "all" | "today" | "this_month" | "this_year" | "custom"

export interface FilterPeriodeGayaSales<T> {
  value: OpsiPeriodeGayaSales
  onChange: (v: OpsiPeriodeGayaSales) => void
  customFrom: string
  customTo: string
  onCustomFromChange: (v: string) => void
  onCustomToChange: (v: string) => void
  /** Tanggal baris ini (ISO atau format apa pun yang bisa di-`new Date()`-kan), dipakai untuk
   *  menyaring berdasar `value`. */
  dateValue: (row: T) => string
}

/** Tabel data bergaya `master/sales/SalesPanel.tsx` (permintaan Owner 2026-09-15 — `FilterableTable`
 *  tidak boleh dipakai lagi, lihat `.agents/AGENTS.md` §8.3): header biru, kolom bisa di-sort lewat
 *  tombol, toolbar search+jumlah jadi satu baris, footer pagination "Tampilkan N dari X data" +
 *  tombol nomor halaman.
 *
 *  Expand/collapse per baris OPSIONAL lewat `renderExpanded` (ditambahkan 2026-09-16, dipakai
 *  pertama kali oleh `pembelian/serah-terima-barang/SerahTerimaBarangPanel.tsx`) — kondisional
 *  sesuai §4 aturan-tampilan.md: cuma pasang kalau barisnya memang punya rincian (mis. baris item
 *  dokumen Transaksi dengan Detail, §7.0). Tabel yang butuh kebab-menu aksi per baris juga (bukan
 *  cuma expand) tetap menulis markupnya sendiri (lihat `PurchaseOrderPanel.tsx`) — expand-row di
 *  sini sengaja tetap sesederhana mungkin, bukan pengganti tabel manual yang lebih kompleks. */
export function TabelGayaSales<T>({
  rows,
  kolom,
  rowKey,
  searchPlaceholder,
  emptyMessage,
  pageSize: pageSizeAwal = 10,
  filterGroups,
  columnMenu,
  pdfButton,
  excelHref,
  resultLabel,
  onSearchChange,
  renderExpanded,
  periodFilter,
}: {
  rows: T[]
  kolom: KolomGayaSales<T>[]
  rowKey: (row: T) => string
  searchPlaceholder?: string
  emptyMessage: string
  pageSize?: number
  /** Dropdown "Filter" — satu grup per dimensi (mis. Jenis: Kas/Bank). Opsional. */
  filterGroups?: GrupFilterGayaSales<T>[]
  /** Tombol "Kolom" (toggle tampil/sembunyi kolom) — biasanya dari `useColumnVisibility`. Opsional. */
  columnMenu?: MenuKolomGayaSales
  /** Tombol "PDF" — biasanya membuka modal pratinjau. Opsional. */
  pdfButton?: TombolPdfGayaSales
  /** Link unduh "Excel" — `<a href>` langsung. Opsional. */
  excelHref?: string
  /** Label jumlah data di sisi toolbar, mis. "Semua Akun". Default: cuma angka "N data". */
  resultLabel?: string
  /** Diberikan kalau pemanggil perlu tahu kata kunci pencarian saat ini (mis. tabel pohon berjenjang
   *  yang perlu bypass status buka/tutup & menyembunyikan indentasi selama pencarian aktif). Tidak
   *  mengubah perilaku pencarian sendiri — search tetap disaring/disimpan di komponen ini. */
  onSearchChange?: (search: string) => void
  /** Diberikan → kolom tombol expand (chevron) muncul di kiri, baris ini bisa dibuka/tutup untuk
   *  menampilkan rincian (mis. baris item dokumen). Kembalikan `null` untuk baris yang tidak punya
   *  apa-apa untuk dibuka (chevron tetap muncul tapi disabled) — biasanya semua baris punya rincian
   *  jadi ini jarang perlu. Tidak diberikan → tabel biasa tanpa expand. */
  renderExpanded?: (row: T) => React.ReactNode
  /** Tombol "Filter periode" (Hari Ini/Bulan Ini/Tahun Ini/Custom) — dipisah dari `filterGroups`
   *  karena bentuknya beda (kalender, bukan daftar opsi). Extract dari `PurchaseOrderPanel.tsx`
   *  2026-09-16 — dipakai SEMUA panel Transaksi yang barisnya bertanggal (§7.0 aturan-tampilan.md).
   *  Opsional; tidak diberikan → tanpa filter periode. */
  periodFilter?: FilterPeriodeGayaSales<T>
}) {
  const [search, setSearchState] = useState("")
  const setSearch = (value: string) => {
    setSearchState(value)
    onSearchChange?.(value)
  }
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const toggleExpanded = (key: string) =>
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(pageSizeAwal)
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)
  const filterMenuRef = useRef<HTMLDivElement>(null)
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false)
  const dateMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!filterGroups || filterGroups.length === 0) return
    const handleClick = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setIsFilterMenuOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [filterGroups])

  useEffect(() => {
    if (!periodFilter) return
    const handleClick = (e: MouseEvent) => {
      if (dateMenuRef.current && !dateMenuRef.current.contains(e.target as Node)) setIsDateMenuOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [periodFilter])

  const kolomBisaDicari = useMemo(() => kolom.filter((k) => k.filterValue), [kolom])
  const adaToolbar = kolomBisaDicari.length > 0 || !!filterGroups?.length || !!columnMenu || !!pdfButton || !!excelHref || !!periodFilter
  const jumlahFilterAktif = filterGroups?.filter((g) => g.value).length ?? 0

  const filteredByPeriode = useMemo(() => {
    if (!periodFilter || periodFilter.value === "all") return rows
    const now = new Date()
    return rows.filter((r) => {
      const rowDate = new Date(periodFilter.dateValue(r))
      if (periodFilter.value === "today") {
        return rowDate.getDate() === now.getDate() && rowDate.getMonth() === now.getMonth() && rowDate.getFullYear() === now.getFullYear()
      }
      if (periodFilter.value === "this_month") {
        return rowDate.getMonth() === now.getMonth() && rowDate.getFullYear() === now.getFullYear()
      }
      if (periodFilter.value === "this_year") {
        return rowDate.getFullYear() === now.getFullYear()
      }
      // custom
      const rowDay = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, "0")}-${String(rowDate.getDate()).padStart(2, "0")}`
      if (periodFilter.customFrom && rowDay < periodFilter.customFrom) return false
      if (periodFilter.customTo && rowDay > periodFilter.customTo) return false
      return true
    })
  }, [rows, periodFilter])

  // Teks "Periode Bulan Ini (1 Sep 2026 s.d. 16 Sep 2026 (hari ini))" dst — dihitung otomatis
  // dari `periodFilter`, dipakai sebagai `resultLabel` bawaan kalau pemanggil tidak mengirim
  // `resultLabel` sendiri. Extract dari `PurchaseOrderPanel.periodeLabel` (2026-09-16) supaya
  // tiap Panel Transaksi tidak perlu menghitung ulang teks yang sama persis.
  const periodeLabelOtomatis = useMemo(() => {
    if (!periodFilter) return null
    const fmt = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    const now = new Date()
    const today = fmt(now)
    const withToday = (s: string) => (s === today ? `${s} (hari ini)` : s)
    if (periodFilter.value === "all") return "Menampilkan semua periode"
    if (periodFilter.value === "today") return `Periode ${today} (hari ini)`
    if (periodFilter.value === "this_month") return `Periode ${fmt(new Date(now.getFullYear(), now.getMonth(), 1))} s.d. ${today} (hari ini)`
    if (periodFilter.value === "this_year") return `Periode ${fmt(new Date(now.getFullYear(), 0, 1))} s.d. ${today} (hari ini)`
    if (!periodFilter.customFrom && !periodFilter.customTo) return "Periode custom — belum diisi tanggalnya"
    const from = periodFilter.customFrom ? fmt(new Date(`${periodFilter.customFrom}T00:00:00`)) : "awal"
    const to = periodFilter.customTo ? withToday(fmt(new Date(`${periodFilter.customTo}T00:00:00`))) : `${today} (hari ini)`
    return `Periode ${from} s.d. ${to}`
  }, [periodFilter])
  const labelHasil = resultLabel ?? periodeLabelOtomatis ?? undefined

  const filteredByGroups = useMemo(() => {
    if (!filterGroups || filterGroups.length === 0) return filteredByPeriode
    return filteredByPeriode.filter((r) => filterGroups.every((g) => !g.value || g.predicate(r, g.value)))
  }, [filteredByPeriode, filterGroups])

  const filtered = useMemo(() => {
    const kata = search.trim().toLowerCase()
    if (!kata || kolomBisaDicari.length === 0) return filteredByGroups
    return filteredByGroups.filter((r) => kolomBisaDicari.some((k) => k.filterValue!(r).toLowerCase().includes(kata)))
  }, [filteredByGroups, search, kolomBisaDicari])

  const sorted = useMemo(() => {
    if (!sortColumn) return filtered
    const kolomAktif = kolom.find((k) => k.key === sortColumn)
    if (!kolomAktif?.sortValue) return filtered
    const list = [...filtered]
    list.sort((a, b) => {
      let valA: string | number = kolomAktif.sortValue!(a)
      let valB: string | number = kolomAktif.sortValue!(b)
      if (typeof valA === "string") valA = valA.toLowerCase()
      if (typeof valB === "string") valB = valB.toLowerCase()
      if (valA < valB) return sortDirection === "asc" ? -1 : 1
      if (valA > valB) return sortDirection === "asc" ? 1 : -1
      return 0
    })
    return list
  }, [filtered, sortColumn, sortDirection, kolom])

  const totalItems = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const halamanAktif = Math.min(currentPage, totalPages)
  const startIndex = (halamanAktif - 1) * pageSize
  const paginatedRows = sorted.slice(startIndex, startIndex + pageSize)

  const nomorHalaman = useMemo(() => getPageWindow(halamanAktif, totalPages), [halamanAktif, totalPages])

  const handleSort = (key: string) => {
    if (sortColumn === key) setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortColumn(key)
      setSortDirection("asc")
    }
  }

  const kelasAlign = (align?: "left" | "right" | "center") => (align === "right" ? "text-right" : align === "center" ? "text-center" : "")

  return (
    <div>
      {adaToolbar && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3.5">
          {kolomBisaDicari.length > 0 ? (
            <div className="relative flex items-center w-full sm:max-w-[180px] lg:max-w-[270px] sm:shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-fg-muted absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full h-9 pl-9 pr-3.5 text-xs sm:text-sm font-medium rounded-xl bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-slate-800 dark:text-fg placeholder:text-slate-400 dark:placeholder:text-fg-muted focus:outline-none focus:border-[#0544cc] focus:ring-2 focus:ring-[#0544cc]/10 transition-colors shadow-2xs"
              />
            </div>
          ) : (
            <div />
          )}

          <div className="flex flex-1 flex-wrap items-center gap-2 md:justify-end">
            <p className="text-xs font-semibold text-slate-600 dark:text-fg-muted md:text-right">
              {labelHasil ?? `${totalItems} data`}
              {labelHasil && <span className="font-normal text-slate-400 dark:text-fg-muted"> · {totalItems} data</span>}
            </p>

            {periodFilter && (
              <div className="relative" ref={dateMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsDateMenuOpen((o) => !o)}
                  className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {periodFilter.value === "custom"
                      ? periodFilter.customFrom || periodFilter.customTo
                        ? `${periodFilter.customFrom ? formatDateLong(periodFilter.customFrom) : "Awal"} – ${periodFilter.customTo ? formatDateLong(periodFilter.customTo) : "Sekarang"}`
                        : "Periode Custom"
                      : { all: "Semua Tanggal", today: "Hari Ini", this_month: "Bulan Ini", this_year: "Tahun Ini" }[periodFilter.value]}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
                {isDateMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-52 rounded-xl border border-slate-200 dark:border-line bg-white dark:bg-surface p-1.5 shadow-xl z-50">
                    {(
                      [
                        { value: "all", label: "Semua Tanggal" },
                        { value: "today", label: "Hari Ini" },
                        { value: "this_month", label: "Bulan Ini" },
                        { value: "this_year", label: "Tahun Ini" },
                        { value: "custom", label: "Periode Custom" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          periodFilter.onChange(opt.value)
                          if (opt.value !== "custom") setIsDateMenuOpen(false)
                          setCurrentPage(1)
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold rounded-lg text-left cursor-pointer transition-colors ${
                          periodFilter.value === opt.value
                            ? "bg-blue-50 text-[#0544cc] dark:bg-blue-900/30 dark:text-blue-300"
                            : "text-slate-700 dark:text-fg-secondary hover:bg-slate-100/70 dark:hover:bg-surface-hover"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {periodFilter.value === opt.value && <Check className="w-3.5 h-3.5 text-[#0544cc]" />}
                      </button>
                    ))}

                    {periodFilter.value === "custom" && (
                      <div className="mt-1.5 pt-2 px-2 pb-1 border-t border-slate-200/70 dark:border-line space-y-2">
                        <label className="block">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-fg-muted uppercase tracking-wider">Dari</span>
                          <input
                            type="date"
                            value={periodFilter.customFrom}
                            max={periodFilter.customTo || undefined}
                            onChange={(e) => {
                              periodFilter.onCustomFromChange(e.target.value)
                              setCurrentPage(1)
                            }}
                            className="mt-0.5 w-full h-8 px-2 text-xs rounded-lg bg-white dark:bg-surface border border-slate-200/90 dark:border-line text-slate-700 dark:text-fg-secondary"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-fg-muted uppercase tracking-wider">Sampai</span>
                          <input
                            type="date"
                            value={periodFilter.customTo}
                            min={periodFilter.customFrom || undefined}
                            onChange={(e) => {
                              periodFilter.onCustomToChange(e.target.value)
                              setCurrentPage(1)
                            }}
                            className="mt-0.5 w-full h-8 px-2 text-xs rounded-lg bg-white dark:bg-surface border border-slate-200/90 dark:border-line text-slate-700 dark:text-fg-secondary"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsDateMenuOpen(false)}
                          className="w-full h-8 rounded-lg bg-[#0544cc] hover:bg-[#043aa8] text-white text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Terapkan
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {filterGroups && filterGroups.length > 0 && (
              <div className="relative" ref={filterMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsFilterMenuOpen((o) => !o)}
                  className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer transition-colors"
                >
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span>Filter</span>
                  {jumlahFilterAktif > 0 && (
                    <span className="min-w-4 h-4 px-1 rounded-full bg-[#0544cc] text-white text-[10px] font-bold flex items-center justify-center">
                      {jumlahFilterAktif}
                    </span>
                  )}
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
                {isFilterMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-56 rounded-xl border border-slate-200 dark:border-line bg-white dark:bg-surface p-1.5 shadow-xl z-50 max-h-80 overflow-y-auto">
                    {filterGroups.map((g, gi) => (
                      <div key={g.key}>
                        {gi > 0 && <div className="my-1.5 border-t border-slate-200/70 dark:border-line" />}
                        <p className="px-3 pt-1 pb-1.5 text-[10px] font-bold text-slate-400 dark:text-fg-muted uppercase tracking-wider">{g.label}</p>
                        {[{ value: "", label: `Semua ${g.label}` }, ...g.options].map((opt) => (
                          <button
                            key={opt.value || "all"}
                            type="button"
                            onClick={() => g.onChange(opt.value)}
                            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold rounded-lg text-left cursor-pointer transition-colors ${
                              g.value === opt.value
                                ? "bg-blue-50 text-[#0544cc] dark:bg-blue-900/30 dark:text-blue-300"
                                : "text-slate-700 dark:text-fg-secondary hover:bg-slate-100/70 dark:hover:bg-surface-hover"
                            }`}
                          >
                            <span>{opt.label}</span>
                            {g.value === opt.value && <Check className="w-3.5 h-3.5 text-[#0544cc]" />}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {columnMenu && <ColumnVisibilityMenu columns={columnMenu.columns} isVisible={columnMenu.isVisible} onToggle={columnMenu.toggle} />}

            {pdfButton && (
              <button
                type="button"
                onClick={pdfButton.onClick}
                title={pdfButton.title ?? "Pratinjau & cetak PDF"}
                className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>PDF</span>
              </button>
            )}
            {excelHref && (
              <a
                href={excelHref}
                title="Unduh Excel"
                className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                <span>Excel</span>
              </a>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="bg-blue-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
              {renderExpanded && <th className="w-10 py-3.5 px-3 text-center" aria-label="Expand" />}
              {kolom.map((k) => (
                <th key={k.key} className={`py-3.5 px-3 ${kelasAlign(k.align)}`}>
                  {k.sortValue ? (
                    <button
                      type="button"
                      onClick={() => handleSort(k.key)}
                      className={`flex items-center gap-1.5 hover:text-[#0544cc] transition-colors cursor-pointer ${k.align === "right" ? "justify-end w-full" : ""}`}
                    >
                      <span>{k.header}</span>
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  ) : (
                    k.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
            {paginatedRows.length > 0 ? (
              paginatedRows.map((row, i) => {
                const key = rowKey(row)
                const isExpanded = renderExpanded ? expandedKeys.has(key) : false
                return (
                  <Fragment key={key}>
                    <tr className="hover:bg-blue-50/20 dark:hover:bg-surface-hover/40 transition-colors">
                      {renderExpanded && (
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(key)}
                            className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-900/20 text-[#0544cc] dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/40 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
                            title={isExpanded ? "Tutup Rincian" : "Buka Rincian"}
                            aria-label={isExpanded ? "Tutup Rincian" : "Buka Rincian"}
                          >
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                          </button>
                        </td>
                      )}
                      {kolom.map((k) => (
                        <td key={k.key} className={`py-3 px-3 ${kelasAlign(k.align)}`}>
                          {k.cell(row, startIndex + i)}
                        </td>
                      ))}
                    </tr>
                    {renderExpanded && isExpanded && (
                      <tr className="bg-slate-50/60 dark:bg-surface-hover/30">
                        <td colSpan={kolom.length + 1} className="p-3 sm:p-4">
                          <div className="ml-4 sm:ml-8">{renderExpanded(row)}</div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            ) : (
              <tr>
                <td colSpan={kolom.length + (renderExpanded ? 1 : 0)} className="text-center py-10 text-slate-500 dark:text-fg-muted">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-line text-xs font-semibold text-slate-600 dark:text-fg-muted">
        <div className="flex items-center gap-2">
          <span>Tampilkan</span>
          <div className="relative">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="h-8 pl-2.5 pr-7 rounded-lg bg-white dark:bg-surface border border-slate-200/90 dark:border-line text-slate-700 dark:text-fg-secondary cursor-pointer focus:outline-none appearance-none font-bold"
            >
              {[5, 10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>
          <span>dari {totalItems} data</span>
        </div>

        <div className="flex items-center gap-1 self-end sm:self-auto">
          <button
            type="button"
            disabled={halamanAktif <= 1}
            onClick={() => setCurrentPage(Math.max(1, halamanAktif - 1))}
            className="w-8 h-8 rounded-lg border border-slate-200/90 dark:border-line flex items-center justify-center text-slate-600 dark:text-fg-muted hover:bg-slate-50 dark:hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            title="Halaman Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {nomorHalaman.map((pg) => (
            <button
              key={pg}
              type="button"
              onClick={() => setCurrentPage(pg)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                halamanAktif === pg
                  ? "bg-[#0544cc] text-white shadow-xs"
                  : "border border-slate-200/90 dark:border-line text-slate-700 dark:text-fg hover:bg-slate-50 dark:hover:bg-surface-hover"
              }`}
            >
              {pg}
            </button>
          ))}

          <button
            type="button"
            disabled={halamanAktif >= totalPages}
            onClick={() => setCurrentPage(Math.min(totalPages, halamanAktif + 1))}
            className="w-8 h-8 rounded-lg border border-slate-200/90 dark:border-line flex items-center justify-center text-slate-600 dark:text-fg-muted hover:bg-slate-50 dark:hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            title="Halaman Berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
