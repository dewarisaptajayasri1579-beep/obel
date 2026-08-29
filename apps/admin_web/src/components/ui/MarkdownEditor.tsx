"use client";

import React, { useState } from "react";
import { FileText, Eye } from "lucide-react";

export interface MarkdownEditorProps {
  label?: string;
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  helperText?: string;
  error?: string;
  rows?: number;
  className?: string;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  label,
  value = "",
  onChange,
  placeholder = "Tulis markdown disini...",
  helperText,
  error,
  rows = 6,
  className = "",
}) => {
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (onChange) onChange(e.target.value);
  };

  const renderMarkdown = (text: string) => {
    if (!text.trim()) return `<p class="text-slate-400 dark:text-fg-disabled font-normal italic">Tidak ada yang bisa dipratinjau.</p>`;

    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h4 class="text-base font-bold text-slate-800 dark:text-fg mt-4 mb-2">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 class="text-lg font-bold text-slate-800 dark:text-fg mt-5 mb-2">$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2 class="text-xl font-black text-slate-900 dark:text-fg mt-6 mb-3">$1</h2>');

    // Bold & Italic
    html = html.replace(/\*\*(.*)\*\*/gim, '<strong class="font-bold">$1</strong>');
    html = html.replace(/\*(.*)\*/gim, '<em class="italic">$1</em>');

    // Code Blocks
    html = html.replace(/`(.*?)`/gim, '<code class="bg-slate-100 dark:bg-surface border border-slate-200/80 dark:border-line px-1 py-0.5 rounded text-xs font-mono text-blue-600 dark:text-[var(--accent-highlight)]">$1</code>');

    // Bullet Lists
    html = html.replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc text-slate-700 dark:text-fg-secondary font-medium">$1</li>');
    html = html.replace(/^- (.*$)/gim, '<li class="ml-4 list-disc text-slate-700 dark:text-fg-secondary font-medium">$1</li>');

    // Line breaks
    html = html.replace(/\n$/gim, "<br />");

    return html;
  };

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-fg-secondary select-none">
          {label}
        </span>
      )}
      
      {/* Container */}
      <div className="flex flex-col w-full bg-white/60 dark:bg-[var(--field-bg)] border border-slate-200/80 dark:border-[rgba(148,163,184,0.14)] rounded-2xl overflow-hidden backdrop-blur-md dark:backdrop-blur-none shadow-[0_2px_6px_rgba(0,0,0,0.02)]">
        {/* Tab Header */}
        <div className="flex border-b border-slate-200/80 dark:border-line bg-slate-50/50 dark:bg-black/10 px-2 py-1.5 gap-1">
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              tab === "edit"
                ? "bg-white dark:bg-surface text-blue-700 dark:text-[#60A5FA] shadow-xs"
                : "text-slate-500 dark:text-fg-muted hover:text-slate-700 dark:hover:text-fg"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Tulis</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              tab === "preview"
                ? "bg-white dark:bg-surface text-blue-700 dark:text-[#60A5FA] shadow-xs"
                : "text-slate-500 dark:text-fg-muted hover:text-slate-700 dark:hover:text-fg"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Pratinjau</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-3">
          {tab === "edit" ? (
            <textarea
              rows={rows}
              value={value}
              onChange={handleTextChange}
              placeholder={placeholder}
              className="w-full bg-transparent border-none outline-none text-slate-800 dark:text-fg placeholder:text-slate-400 dark:placeholder:text-fg-muted font-medium text-sm resize-y focus:ring-0"
            />
          ) : (
            <div
              className="prose dark:prose-invert max-w-none text-sm leading-relaxed overflow-y-auto space-y-1"
              style={{ minHeight: `${rows * 24}px` }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
            />
          )}
        </div>
      </div>
      
      {error ? (
        <span className="text-xs font-semibold text-red-500 dark:text-red-400">{error}</span>
      ) : helperText ? (
        <span className="text-xs font-medium text-slate-500 dark:text-fg-muted">{helperText}</span>
      ) : null}
    </div>
  );
};
