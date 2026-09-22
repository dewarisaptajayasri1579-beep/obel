"use client";

import { useEffect } from "react";

export interface HotkeyCombo {
  key: string;
  alt?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  /** Tetap aktif walau fokus lagi di field yang bisa diketik — dipakai untuk shortcut yang
   *  memang harus jalan sambil ngetik, bukan buat huruf tunggal yang bisa bentrok dengan
   *  pengetikan biasa. */
  allowInEditable?: boolean;
}

function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return (el as HTMLElement).isContentEditable;
}

/** Global keyboard shortcut, mis. Ctrl+N untuk "Tambah".
 *  Mendukung Ctrl (Windows/Linux) dan Cmd/Ctrl (macOS) secara otomatis saat `ctrl: true`. */
export function useHotkey(combo: HotkeyCombo, handler: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== combo.key.toLowerCase()) return;
      if (!!combo.alt !== e.altKey) return;

      if (combo.ctrl) {
        const hasCtrlOrCmd = e.ctrlKey || e.metaKey;
        if (!hasCtrlOrCmd) return;
      } else {
        if (!!combo.ctrl !== e.ctrlKey) return;
        if (combo.meta !== undefined && !!combo.meta !== e.metaKey) return;
      }

      if (!combo.allowInEditable && isEditableElement(document.activeElement)) return;
      e.preventDefault();
      handler();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [combo.key, combo.alt, combo.ctrl, combo.meta, combo.allowInEditable, handler]);
}
