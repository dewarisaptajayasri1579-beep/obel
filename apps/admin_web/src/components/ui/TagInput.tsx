"use client";

import React, { useState, KeyboardEvent } from "react";
import { X, Hash } from "lucide-react";

export interface TagInputProps {
  label?: string;
  value?: string[];
  onChange?: (tags: string[]) => void;
  placeholder?: string;
  helperText?: string;
  error?: string;
  sizeVariant?: "sm" | "md" | "lg";
  className?: string;
}

export const TagInput: React.FC<TagInputProps> = ({
  label,
  value = [],
  onChange,
  placeholder = "Tambah tag...",
  helperText,
  error,
  sizeVariant = "lg",
  className = "",
}) => {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = inputValue.trim().replace(/,/g, "");
      if (tag && !value.includes(tag)) {
        const nextTags = [...value, tag];
        if (onChange) onChange(nextTags);
        setInputValue("");
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      const nextTags = value.slice(0, -1);
      if (onChange) onChange(nextTags);
    }
  };

  const removeTag = (indexToRemove: number) => {
    const nextTags = value.filter((_, index) => index !== indexToRemove);
    if (onChange) onChange(nextTags);
  };

  const sizeClasses = {
    sm: "min-h-[40px] text-xs p-1.5 gap-1.5 rounded-xl",
    md: "min-h-[48px] text-sm p-2 gap-2 rounded-xl",
    lg: "min-h-[56px] text-base p-2.5 gap-2 rounded-2xl",
  };

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-fg-secondary select-none">
          {label}
        </span>
      )}
      <div
        className={`flex flex-wrap items-center bg-white/60 hover:bg-white/80 dark:bg-[var(--field-bg)] dark:hover:bg-[var(--field-bg)] border border-slate-200/80 dark:border-[rgba(148,163,184,0.14)] text-slate-800 dark:text-fg transition-all duration-200 focus-within:bg-white/95 dark:focus-within:bg-[var(--field-bg)] focus-within:border-blue-600 dark:focus-within:border-[#3B82F6] focus-within:ring-4 focus-within:ring-blue-500/10 dark:focus-within:ring-0 dark:focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.12),0_0_16px_rgba(59,130,246,0.08)] backdrop-blur-md dark:backdrop-blur-none shadow-[0_2px_6px_rgba(0,0,0,0.02)] dark:shadow-none ${
          error ? "border-red-500 focus-within:ring-red-500/10 focus-within:border-red-500" : ""
        } ${sizeClasses[sizeVariant]}`}
      >
        {/* Render tags */}
        {value.map((tag, index) => (
          <span
            key={index}
            className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 text-xs font-semibold rounded-lg bg-blue-500/10 text-blue-700 dark:bg-[rgba(59,130,246,0.10)] dark:text-[#60A5FA] border border-blue-200/40 dark:border-blue-500/20"
          >
            <Hash className="w-3 h-3 opacity-60" />
            <span>{tag}</span>
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="p-0.5 rounded-md hover:bg-blue-500/20 text-blue-600 dark:text-[#60A5FA] cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {/* Tag Input Field */}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 bg-transparent border-none outline-none font-medium min-w-[120px] placeholder:text-slate-400 dark:placeholder:text-fg-muted h-7 text-sm"
        />
      </div>
      {error ? (
        <span className="text-xs font-semibold text-red-500 dark:text-red-400">{error}</span>
      ) : helperText ? (
        <span className="text-xs font-medium text-slate-500 dark:text-fg-muted">{helperText}</span>
      ) : null}
    </div>
  );
};
