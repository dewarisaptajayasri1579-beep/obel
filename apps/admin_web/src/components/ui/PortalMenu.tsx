"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Penempatan harus terjadi sebelum cat layar (biar tidak berkedip), tapi `useLayoutEffect`
 *  di server memancing peringatan React — jadi di sana dipakai `useEffect` yang tidak jalan. */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface PortalMenuProps {
  /** Menu hanya dirender saat `true`. */
  open: boolean;
  /** Elemen yang jadi patokan posisi — biasanya tombol titik-tiga baris itu sendiri. */
  anchor: HTMLElement | null;
  /** Sisi mana yang disejajarkan: "right" = tepi kanan menu menempel tepi kanan tombol. */
  align?: "left" | "right";
  /** Lebar menu dalam piksel. Wajib diketahui di muka karena penempatan dihitung manual. */
  width?: number;
  /** Jarak menu ke tombol. */
  gap?: number;
  /** Dipanggil saat Escape ditekan. Penutupan karena klik di luar tetap ditangani pemanggil. */
  onClose?: () => void;
  className?: string;
  children: React.ReactNode;
}

/** Panel menu yang di-portal ke `document.body` lalu ditempatkan dengan `position: fixed`.
 *
 *  Alasannya: pembungkus tabel memakai `overflow-x-auto`, dan begitu satu sumbu bukan
 *  `visible`, sumbu satunya ikut jadi `auto` — artinya menu ber-`position: absolute` di
 *  dalam baris akan terpotong oleh tepi bawah tabel. Tabel dengan satu-dua baris paling
 *  parah kena: nyaris tidak ada ruang di bawah baris untuk menampung menunya.
 *
 *  Menu juga membalik ke atas tombol kalau ruang di bawah tidak cukup, dan menempel ulang
 *  saat halaman atau tabel digulir.
 *
 *  Panel membawa `data-action-menu` supaya penutup-saat-klik-di-luar milik panel-panel
 *  daftar (yang memeriksa `closest("[data-action-menu]")`) tetap mengecualikan isinya —
 *  di DOM, panel ini sudah tidak lagi bersarang di dalam pembungkus tombolnya.
 *
 *  Diport dari `PembelianPanel` app-internal Cahaya Baru (Tahap 17a) — lihat `tahapan.md`. */
export const PortalMenu: React.FC<PortalMenuProps> = ({
  open,
  anchor,
  align = "right",
  width = 192,
  gap = 6,
  onClose,
  className = "",
  children,
}) => {
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Disimpan di ref supaya callback inline dari pemanggil tidak memasang-lepas
   *  pendengar Escape setiap kali induknya render ulang. */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const h = panelRef.current?.offsetHeight ?? 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Turun ke bawah tombol; kalau mentok tepi layar, dibalik ke atasnya.
    let top = r.bottom + gap;
    if (h > 0 && top + h > vh - 8) {
      const atas = r.top - gap - h;
      top = atas >= 8 ? atas : Math.max(8, vh - 8 - h);
    }

    let left = align === "right" ? r.right - width : r.left;
    left = Math.min(Math.max(8, left), Math.max(8, vw - width - 8));

    setCoords({ top, left });
  }, [anchor, align, width, gap]);

  useIsoLayoutEffect(() => {
    if (!open || !anchor) {
      setCoords(null);
      return;
    }
    place();

    const onScroll = () => place();
    // `true` supaya guliran pembungkus tabel ikut tertangkap, bukan cuma guliran halaman.
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current?.();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, anchor, place]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      ref={panelRef}
      data-action-menu
      role="menu"
      style={{
        top: coords?.top ?? 0,
        left: coords?.left ?? 0,
        width,
        // Render pertama dipakai untuk mengukur tinggi panel; disembunyikan dulu
        // supaya tidak terlihat berkedip di pojok kiri atas.
        visibility: coords ? "visible" : "hidden",
      }}
      className={`fixed z-[70] ${className}`}
    >
      {children}
    </div>,
    document.body
  );
};
