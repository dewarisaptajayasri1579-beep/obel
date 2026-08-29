import React from "react";
import { Search } from "lucide-react";

export const TableContainer: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div
    className={`w-full overflow-x-auto rounded-2xl glass-panel border border-white/80 dark:border-line shadow-md dark:shadow-none ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <table className={`w-full text-left border-collapse ${className}`} {...props}>
    {children}
  </table>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <thead
    className={`bg-white/80 dark:bg-table-header backdrop-blur-md dark:backdrop-blur-none text-slate-700 dark:text-fg-muted text-xs dark:text-[11px] font-bold uppercase tracking-wider dark:tracking-wide border-b border-slate-200/80 dark:border-line ${className}`}
    {...props}
  >
    {children}
  </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <tbody className={`divide-y divide-slate-200/60 dark:divide-[var(--hairline)] text-sm font-medium ${className}`} {...props}>
    {children}
  </tbody>
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <tr className={`hover:bg-blue-50/40 dark:hover:bg-[rgba(59,130,246,0.05)] transition-colors ${className}`} {...props}>
    {children}
  </tr>
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <th className={`px-4 py-3.5 dark:py-2.5 text-slate-700 dark:text-fg-secondary ${className}`} {...props}>
    {children}
  </th>
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <td className={`px-4 py-3.5 text-slate-800 dark:text-fg-secondary ${className}`} {...props}>
    {children}
  </td>
);

export const TableFilterRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <tr className={`bg-slate-50/70 dark:bg-table-header border-b border-slate-200/80 dark:border-line ${className}`} {...props}>
    {children}
  </tr>
);

export const TableFilterCell: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <th className={`px-4 py-2 font-normal ${className}`} {...props}>
    {children}
  </th>
);

export const TableFilterInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = "",
  ...props
}) => (
  <div className="relative flex items-center w-full">
    <Search className="w-3.5 h-3.5 text-slate-400 dark:text-fg-muted absolute left-2.5 pointer-events-none" />
    <input
      type="text"
      className={`w-full h-8 pl-8 pr-2.5 text-xs font-medium rounded-lg bg-white/70 dark:bg-[var(--field-bg)] border border-slate-200/80 dark:border-[rgba(148,163,184,0.14)] text-slate-700 dark:text-fg-secondary placeholder:text-slate-400 dark:placeholder:text-fg-muted placeholder:font-normal focus:outline-none focus:bg-white dark:focus:bg-[var(--field-bg)] focus:border-blue-500 dark:focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/10 dark:focus:ring-0 dark:focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] transition-colors ${className}`}
      {...props}
    />
  </div>
);

export const TableFilterSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  className = "",
  children,
  ...props
}) => (
  <select
    className={`w-full h-8 px-2 text-xs font-medium rounded-lg bg-white/70 dark:bg-[var(--field-bg)] border border-slate-200/80 dark:border-[rgba(148,163,184,0.14)] text-slate-700 dark:text-fg-secondary focus:outline-none focus:bg-white dark:focus:bg-[var(--field-bg)] focus:border-blue-500 dark:focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/10 dark:focus:ring-0 dark:focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] transition-colors cursor-pointer ${className}`}
    {...props}
  >
    {children}
  </select>
);
