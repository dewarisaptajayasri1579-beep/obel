"use client";

import React, { useMemo, useState } from "react";
import { Search, ArrowUpDown, ChevronDown, ChevronRight, Columns3, Check, Download, Printer } from "lucide-react";
import {
  Table,
  TableContainer,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableFilterRow,
  TableFilterCell,
  TableFilterInput,
  TableFilterSelect,
} from "./Table";
import { Pagination } from "./Pagination";
import { Checkbox } from "./Checkbox";
import { usePagination } from "@/lib/use-pagination";

export interface FilterableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T, rowIndex: number) => React.ReactNode;
  /** Return the text used to match this column's filter input. Omit to leave the column unfiltered. */
  filterValue?: (row: T) => string;
  /** Render the filter as a dropdown instead of a text input. */
  filterOptions?: { value: string; label: string }[];
  sortValue?: (row: T) => any;
  headClassName?: string;
  cellClassName?: string;
}

export interface FilterableTableProps<T> {
  columns: FilterableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  pageSize?: number;
  emptyMessage?: string;
  containerClassName?: string;
  /** Placeholder for the global search box. Set to null to hide the search box entirely. */
  searchPlaceholder?: string | null;
  /** Render rows as stacked cards on small screens instead of a table. */
  mobileCardMode?: boolean;
  /** Aktifkan kolom checkbox (select-all di header) buat bulk action. */
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  /** Dirender sebagai bar di atas tabel kalau ada baris yang tercentang. */
  bulkActions?: (selectedKeys: Set<string>) => React.ReactNode;
  /** Render details panel inside expandable row */
  renderExpandableRow?: (row: T) => React.ReactNode;
  /** Aktifkan pagination server-side — `rows` dianggap SUDAH jadi 1 halaman dari server
   *  (bukan seluruh dataset), jadi filter/search/pagination internal di-skip, di-drive dari
   *  props ini. Kolom filter (filterOptions/filterValue) dan sort tetap beroperasi di level
   *  halaman yang sedang di-load saja — lihat docs/template/15-performance-pattern.md. */
  serverMode?: {
    totalCount: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onSearchChange?: (search: string) => void;
  };
}

export function FilterableTable<T>({
  columns,
  rows,
  rowKey,
  pageSize = 10,
  emptyMessage = "Tidak ada data yang cocok.",
  containerClassName = "rounded-none border-x-0 border-b-0 shadow-none",
  searchPlaceholder = "Cari...",
  mobileCardMode = false,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  bulkActions,
  renderExpandableRow,
  serverMode,
}: FilterableTableProps<T>) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set());
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const hasExpandable = !!renderExpandableRow;

  // Sorting State
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(columns.map((c) => c.key))
  );
  const [isColMenuOpen, setIsColMenuOpen] = useState(false);
  const colMenuRef = React.useRef<HTMLDivElement>(null);

  // Expandable Row State
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const selected = selectedKeys ?? internalSelected;
  const setSelected = (next: Set<string>) => {
    if (!selectedKeys) setInternalSelected(next);
    onSelectionChange?.(next);
  };

  const searchableColumns = useMemo(() => columns.filter((c) => c.filterValue), [columns]);

  // Handle outside click for column visibility menu
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setIsColMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSort = (key: string) => {
    if (sortColumn === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(key);
      setSortDirection("asc");
    }
  };

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // Keep at least one column visible
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleExpandRow = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredAndSortedRows = useMemo(() => {
    let result = rows.filter((row): row is T => row != null);

    // Mode server: `rows` sudah 1 halaman jadi dari server (sudah difilter/di-search di sana) —
    // skip filter/search lokal, biar tidak "filter dobel" yang keliru.
    if (!serverMode) {
      // Apply filters
      const activeFilters = columns.filter((c) => c.filterValue && filters[c.key]?.trim());
      if (activeFilters.length > 0) {
        result = result.filter((row) =>
          activeFilters.every((col) =>
            col.filterValue!(row)
              .toLowerCase()
              .includes(filters[col.key]!.trim().toLowerCase())
          )
        );
      }

      // Apply global search
      const term = search.trim().toLowerCase();
      if (term && searchableColumns.length > 0) {
        result = result.filter((row) =>
          searchableColumns.some((col) =>
            col.filterValue!(row).toLowerCase().includes(term)
          )
        );
      }
    }

    // Apply Sorting — tetap jalan di mode server, tapi cuma di dalam halaman yang di-load
    // (bukan across semua data), lihat catatan di FilterableTableProps.serverMode.
    if (sortColumn) {
      const activeCol = columns.find((c) => c.key === sortColumn);
      result.sort((a, b) => {
        let valA = activeCol?.sortValue ? activeCol.sortValue(a) : (a as any)[sortColumn];
        let valB = activeCol?.sortValue ? activeCol.sortValue(b) : (b as any)[sortColumn];

        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();

        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rows, filters, search, columns, searchableColumns, sortColumn, sortDirection, serverMode]);

  const clientPagination = usePagination(filteredAndSortedRows.length, currentPageSize);
  // Mode server: total & halaman aktif ikut props (server yang tau total sebenarnya), `rows`
  // yang masuk sudah jadi 1 halaman jadi tidak perlu di-slice lagi.
  const pagination = serverMode
    ? {
        page: serverMode.page,
        totalPages: Math.max(1, Math.ceil(serverMode.totalCount / serverMode.pageSize)),
        start: (serverMode.page - 1) * serverMode.pageSize,
        end: serverMode.page * serverMode.pageSize,
        setPage: serverMode.onPageChange,
      }
    : clientPagination;
  const pageRows = serverMode ? filteredAndSortedRows : filteredAndSortedRows.slice(pagination.start, pagination.end);
  const activeColumns = columns.filter((c) => visibleColumns.has(c.key));
  const hasFilters = activeColumns.some((c) => c.filterValue);

  const setFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    pagination.setPage(1);
  };

  const pageKeys = pageRows.map(rowKey);
  const allPageSelected = pageKeys.length > 0 && pageKeys.every((k) => selected.has(k));

  const toggleRow = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const toggleAllOnPage = () => {
    const next = new Set(selected);
    if (allPageSelected) pageKeys.forEach((k) => next.delete(k));
    else pageKeys.forEach((k) => next.add(k));
    setSelected(next);
  };

  // CSV Export Helper
  const handleExportCSV = () => {
    const headers = activeColumns.map((col) => typeof col.header === "string" ? col.header : col.key).join(",");
    const csvRows = filteredAndSortedRows.map((row) =>
      activeColumns
        .map((col) => {
          const val = col.filterValue ? col.filterValue(row) : (row as any)[col.key] ?? "";
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csvContent = [headers, ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "export-tabel.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        {/* Bulk Action Panel */}
        {selectable && bulkActions && selected.size > 0 ? (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-blue-50/80 dark:bg-blue-500/10 border border-blue-200/80 dark:border-blue-500/30 flex-1">
            <span className="text-xs sm:text-sm font-bold text-blue-800 dark:text-[var(--accent-highlight)]">
              {selected.size} dipilih
            </span>
            <div className="flex items-center gap-2">{bulkActions(selected)}</div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Data Table Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-end">
          {/* Export & Print */}
          <button
            onClick={handleExportCSV}
            title="Ekspor ke CSV"
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/80 dark:bg-surface hover:bg-white dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-xs text-slate-500 dark:text-fg-muted cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => window.print()}
            title="Cetak Halaman"
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/80 dark:bg-surface hover:bg-white dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-xs text-slate-500 dark:text-fg-muted cursor-pointer transition-colors"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Column Visibility Menu */}
          <div className="relative" ref={colMenuRef}>
            <button
              onClick={() => setIsColMenuOpen((o) => !o)}
              className="flex items-center gap-2 px-3.5 h-9 rounded-xl bg-white/80 dark:bg-surface hover:bg-white dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-xs text-xs font-bold text-slate-600 dark:text-fg-secondary cursor-pointer transition-colors"
            >
              <Columns3 className="w-4 h-4 text-slate-400" />
              <span>Kolom</span>
            </button>
            {isColMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 glass-dropdown p-2 rounded-2xl shadow-xl z-50">
                {columns.map((col) => (
                  <button
                    key={col.key}
                    onClick={() => toggleColumn(col.key)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-fg-secondary hover:bg-blue-50/80 dark:hover:bg-blue-500/10 hover:text-blue-700 dark:hover:text-[var(--accent-highlight)] rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <span
                      className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 ${
                        visibleColumns.has(col.key)
                          ? "bg-blue-600 border-blue-600"
                          : "border-slate-300 dark:border-line-strong"
                      }`}
                    >
                      {visibleColumns.has(col.key) && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span>{typeof col.header === "string" ? col.header : col.key}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Page Size Selector — disembunyikan di mode server, ukuran halaman dikontrol caller */}
          {!serverMode && (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-fg-muted">
              <span>Tampilkan</span>
              <select
                value={currentPageSize}
                onChange={(e) => {
                  setCurrentPageSize(Number(e.target.value));
                  pagination.setPage(1);
                }}
                className="h-9 px-2 rounded-xl bg-white/80 dark:bg-surface border border-slate-200/90 dark:border-line text-slate-700 dark:text-fg-secondary cursor-pointer focus:outline-none"
              >
                {[5, 10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <TableContainer className={containerClassName}>
        {searchPlaceholder && searchableColumns.length > 0 && (
          <div className="no-print px-4 py-3 border-b border-slate-200/80 dark:border-line bg-white/60 dark:bg-surface">
            <div className="relative flex items-center w-full max-w-xs">
              <Search className="w-4 h-4 text-slate-400 dark:text-fg-muted absolute left-3 pointer-events-none" />
              <input
                type="text"
                aria-label="Cari"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  serverMode?.onSearchChange?.(e.target.value);
                  pagination.setPage(1);
                }}
                className="w-full h-9 pl-9 pr-3 text-sm font-medium rounded-lg bg-white/70 dark:bg-surface border border-slate-200/80 dark:border-line text-slate-700 dark:text-fg-secondary placeholder:text-slate-400 dark:placeholder:text-fg-muted placeholder:font-normal focus:outline-none focus:bg-white dark:focus:bg-[var(--field-bg)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-colors"
              />
            </div>
          </div>
        )}

        {mobileCardMode && (
          <div className="block md:hidden p-3 sm:p-4 space-y-3">
            {pageRows.map((row, i) => {
              const key = rowKey(row);
              const isExpanded = expandedRows.has(key);
              return (
                <div key={key} className="rounded-2xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    {selectable && (
                      <Checkbox checked={selected.has(key)} onChange={() => toggleRow(key)} aria-label={`Pilih baris ${key}`} />
                    )}
                    {renderExpandableRow && (
                      <button
                        onClick={() => toggleExpandRow(key)}
                        className="text-slate-500 dark:text-fg-muted p-1"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {activeColumns.map((col) => (
                      <div key={col.key} className="flex items-start justify-between gap-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-fg-muted">
                          {col.header}
                        </div>
                        <div className={`min-w-0 text-sm font-medium text-slate-800 dark:text-fg-secondary ${col.cellClassName ?? ""}`}>
                          {col.cell(row, pagination.start + i)}
                        </div>
                      </div>
                    ))}
                  </div>
                  {isExpanded && renderExpandableRow && (
                    <div className="pt-3 border-t border-slate-200/60 dark:border-line mt-2">
                      {renderExpandableRow(row)}
                    </div>
                  )}
                </div>
              );
            })}
            {pageRows.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-line bg-white/70 dark:bg-surface px-4 py-8 text-center text-sm text-slate-500 dark:text-fg-muted">
                {emptyMessage}
              </div>
            )}
          </div>
        )}

        <div className={mobileCardMode ? "hidden md:block" : "block"}>
          <Table>
            <TableHeader>
              <TableRow>
                {renderExpandableRow && <TableHead className="w-10" />}
                {selectable && (
                  <TableHead className="w-10">
                    <Checkbox checked={allPageSelected} onChange={toggleAllOnPage} aria-label="Pilih semua di halaman ini" />
                  </TableHead>
                )}
                {activeColumns.map((col) => (
                  <TableHead key={col.key} className={col.headClassName}>
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-fg transition-colors font-bold cursor-pointer"
                    >
                      <span>{col.header}</span>
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </TableHead>
                ))}
              </TableRow>
              {hasFilters && (
                <TableFilterRow>
                  {renderExpandableRow && <TableFilterCell />}
                  {selectable && <TableFilterCell />}
                  {activeColumns.map((col) => (
                    <TableFilterCell key={col.key}>
                      {col.filterOptions ? (
                        <TableFilterSelect
                          aria-label={`Filter ${typeof col.header === "string" ? col.header : col.key}`}
                          value={filters[col.key] ?? ""}
                          onChange={(e) => setFilter(col.key, e.target.value)}
                        >
                          <option value="">Semua</option>
                          {col.filterOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </TableFilterSelect>
                      ) : col.filterValue ? (
                        <TableFilterInput
                          aria-label={`Filter ${typeof col.header === "string" ? col.header : col.key}`}
                          placeholder="Filter..."
                          value={filters[col.key] ?? ""}
                          onChange={(e) => setFilter(col.key, e.target.value)}
                        />
                      ) : null}
                    </TableFilterCell>
                  ))}
                </TableFilterRow>
              )}
            </TableHeader>
            <TableBody>
              {pageRows.map((row, i) => {
                const key = rowKey(row);
                const isExpanded = expandedRows.has(key);
                return (
                  <React.Fragment key={key}>
                    <TableRow>
                      {renderExpandableRow && (
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => toggleExpandRow(key)}
                            className="text-slate-500 dark:text-fg-muted p-1 hover:bg-slate-100 dark:hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </TableCell>
                      )}
                      {selectable && (
                        <TableCell>
                          <Checkbox checked={selected.has(key)} onChange={() => toggleRow(key)} aria-label={`Pilih baris ${key}`} />
                        </TableCell>
                      )}
                      {activeColumns.map((col) => (
                        <TableCell key={col.key} className={col.cellClassName}>
                          {col.cell(row, pagination.start + i)}
                        </TableCell>
                      ))}
                    </TableRow>
                    {isExpanded && renderExpandableRow && (
                      <TableRow className="bg-slate-50/40 dark:bg-black/5">
                        <TableCell colSpan={activeColumns.length + (selectable ? 1 : 0) + (hasExpandable ? 1 : 0)} className="p-4 border-l-2 border-l-blue-500">
                          {renderExpandableRow(row)}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={activeColumns.length + (selectable ? 1 : 0) + (hasExpandable ? 1 : 0)} className="text-center text-slate-500 dark:text-fg-muted py-8">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TableContainer>
      
      <div className="no-print">
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
          totalItems={serverMode ? serverMode.totalCount : filteredAndSortedRows.length}
          pageSize={serverMode ? serverMode.pageSize : currentPageSize}
        />
      </div>
    </>
  );
}
