"use client";

import React, { useCallback, useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";

export interface FileUploadProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "onChange"> {
  label?: string;
  helperText?: string;
  error?: string;
  onFilesChange?: (files: File[]) => void;
}

export const FileUpload = React.forwardRef<HTMLInputElement, FileUploadProps>(
  ({ label, helperText, error, onFilesChange, className = "", disabled, id, multiple, accept, ...props }, ref) => {
    const generatedId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [files, setFiles] = useState<File[]>([]);

    const setInputRef = useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      },
      [ref]
    );

    const applyFiles = (fileList: FileList | null) => {
      if (!fileList) return;
      const next = multiple ? [...files, ...Array.from(fileList)] : Array.from(fileList).slice(0, 1);
      setFiles(next);
      onFilesChange?.(next);
    };

    const removeFile = (index: number) => {
      const next = files.filter((_, i) => i !== index);
      setFiles(next);
      onFilesChange?.(next);
    };

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={generatedId} className="text-xs sm:text-sm font-bold text-slate-700 dark:text-fg-secondary select-none">
            {label}
          </label>
        )}
        <div
          onClick={() => !disabled && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (!disabled) applyFiles(e.dataTransfer.files);
          }}
          className={`w-full rounded-2xl border-2 border-dashed px-4 py-8 flex flex-col items-center justify-center gap-2 text-center transition-all duration-200 backdrop-blur-md ${
            disabled
              ? "opacity-50 cursor-not-allowed bg-white/40 dark:bg-surface border-slate-200/80 dark:border-[rgba(148,163,184,0.14)]"
              : "cursor-pointer bg-white/60 hover:bg-white/80 dark:bg-surface dark:hover:bg-surface-hover"
          } ${
            isDragOver
              ? "border-blue-600 bg-blue-50/60 dark:bg-blue-500/10 ring-4 ring-blue-500/10"
              : error
              ? "border-red-400"
              : "border-slate-300 dark:border-[rgba(148,163,184,0.14)]"
          } ${className}`}
        >
          <Upload className={`w-6 h-6 ${isDragOver ? "text-blue-600 dark:text-[var(--accent-primary)]" : "text-slate-400 dark:text-fg-muted"}`} />
          <p className="text-sm font-semibold text-slate-600 dark:text-fg-muted">
            <span className="text-blue-700 dark:text-[var(--accent-primary)]">Klik untuk unggah</span> atau tarik file ke sini
          </p>
          <input
            id={generatedId}
            ref={setInputRef}
            type="file"
            disabled={disabled}
            multiple={multiple}
            accept={accept}
            onChange={(e) => applyFiles(e.target.files)}
            className="hidden"
            {...props}
          />
        </div>

        {files.length > 0 && (
          <ul className="flex flex-col gap-1.5 mt-1">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/70 dark:bg-[var(--field-bg)] border border-slate-200/80 dark:border-[rgba(148,163,184,0.14)] text-xs font-semibold text-slate-700 dark:text-fg-secondary"
              >
                <FileText className="w-4 h-4 text-slate-400 dark:text-fg-muted flex-shrink-0" />
                <span className="truncate flex-1">{file.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="text-slate-400 dark:text-fg-muted hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                  aria-label={`Hapus ${file.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {error ? (
          <span className="text-xs font-semibold text-red-500 dark:text-red-400">{error}</span>
        ) : helperText ? (
          <span className="text-xs font-medium text-slate-500 dark:text-fg-muted">{helperText}</span>
        ) : null}
      </div>
    );
  }
);

FileUpload.displayName = "FileUpload";
