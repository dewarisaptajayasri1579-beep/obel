"use client";

import React from "react";
import { labelMetodeBayar } from "@/lib/receipt";
import { OBBEL, OBBEL_SCALE } from "../_lib/theme";

const GREEN = OBBEL.primaryDark;

export type MetodeBayar = "CASH" | "QRIS" | "SPLIT";

/// Bagian layar pembayaran yang dipakai bersama sheet Pembayaran di Kasir dan sheet
/// Ganti Metode Bayar di Riwayat Penjualan, supaya aturan Split & tampilannya satu.

/// Input nominal Rupiah dgn pemisah ribuan otomatis saat mengetik (mis.
/// "85.000") — `type="text"` bukan `type="number"` karena `<input
/// type="number">` tidak bisa menampilkan titik pemisah ribuan sama sekali.
export function RibuanInput({
  value,
  onChange,
  className = "w-full rounded-xl border border-slate-200 px-4 py-3 text-base font-semibold outline-none focus:border-[#0B5D34]",
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value > 0 ? value.toLocaleString("id-ID") : ""}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        onChange(digits === "" ? 0 : Number(digits));
      }}
      className={className}
      placeholder={placeholder}
    />
  );
}

export function PilihMetodeBayar({ value, onChange }: { value: MetodeBayar; onChange: (m: MetodeBayar) => void }) {
  return (
    <div>
      <p className="text-base font-bold text-slate-700 mb-2">Metode Pembayaran</p>
      <div className="grid grid-cols-3 gap-2">
        {(["CASH", "QRIS", "SPLIT"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className="rounded-xl py-3 text-base font-bold border-2"
            style={
              value === m
                ? { borderColor: GREEN, color: GREEN, backgroundColor: OBBEL_SCALE[50] }
                : { borderColor: "#E2E8F0", color: "#475569" }
            }
          >
            {labelMetodeBayar(m)}
          </button>
        ))}
      </div>
    </div>
  );
}

/// Kode QRIS Booth untuk dipindai pelanggan (QRIS & Split).
export function KodeQrisBooth({ imageUrl }: { imageUrl: string | null }) {
  return (
    <div>
      <p className="text-base font-bold text-slate-700 mb-2">Kode QRIS Booth</p>
      {imageUrl ? (
        <div className="rounded-2xl border border-slate-200 p-4 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Kode QRIS" className="w-48 h-48 object-contain" />
          <p className="text-sm text-slate-500 text-center">Tunjukkan ke pelanggan untuk dipindai.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 font-medium">
          Kode QRIS Booth ini belum diunggah Admin. Hubungi Admin untuk mengaturnya di Data Booth.
        </div>
      )}
    </div>
  );
}

/// Split Tunai + QRIS. Cukup simpan bagian Tunai — bagian QRIS selalu sisanya,
/// jadi jumlah keduanya pasti sama dengan total. Mengisi salah satu bagian
/// otomatis menyesuaikan bagian lainnya; nilai di atas total dibatasi ke total.
export function SplitBayarInput({ total, tunai, onTunai }: { total: number; tunai: number; onTunai: (n: number) => void }) {
  const qris = total - tunai;
  const atur = (bagian: "TUNAI" | "QRIS", nilai: number) => {
    const n = Math.min(Math.max(nilai, 0), total);
    onTunai(bagian === "TUNAI" ? n : total - n);
  };
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-bold text-slate-600 mb-1.5">Bagian Tunai</p>
        <RibuanInput value={tunai} onChange={(n) => atur("TUNAI", n)} />
      </div>
      <div>
        <p className="text-sm font-bold text-slate-600 mb-1.5">Bagian QRIS</p>
        <RibuanInput value={qris} onChange={(n) => atur("QRIS", n)} />
      </div>
      {!splitValid(total, tunai) && (
        <p className="text-sm font-semibold" style={{ color: OBBEL.accentRed }}>
          Split butuh bagian Tunai dan QRIS masing-masing lebih dari Rp0. Kalau hanya satu metode, pilih Tunai atau QRIS.
        </p>
      )}
    </div>
  );
}

export function splitValid(total: number, tunai: number): boolean {
  return tunai > 0 && total - tunai > 0;
}

/// Body request pembayaran sesuai metode — sama untuk bayar & ganti metode.
export function rencanaBayar(
  metode: MetodeBayar,
  total: number,
  tunai: number,
): { paymentMethod: "CASH" | "QRIS" } | { payments: { method: "CASH" | "QRIS"; amount: number }[] } {
  return metode === "SPLIT"
    ? { payments: [{ method: "CASH", amount: tunai }, { method: "QRIS", amount: total - tunai }] }
    : { paymentMethod: metode };
}
