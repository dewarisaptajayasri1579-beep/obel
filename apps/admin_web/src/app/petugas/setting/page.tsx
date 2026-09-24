"use client";

import React, { useEffect, useState } from "react";
import { User, LogOut, Printer, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, type UserAccount } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import {
  isNativeBridgeAvailable,
  listPairedPrinters,
  openPrinterSettings,
  selectPrinter,
  type PairedPrinter,
} from "../_lib/native-bridge";

import { OBBEL, OBBEL_SCALE } from "../_lib/theme";
const GREEN = OBBEL.primaryDark;

function SettingContent() {
  const { logout } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState<UserAccount | null>(null);
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const [printers, setPrinters] = useState<PairedPrinter[]>([]);
  const [izinDitolakPermanen, setIzinDitolakPermanen] = useState(false);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  // Highlight pilihan di sesi ini saja — bridge tidak punya action buat baca
  // balik printer mana yang tersimpan sebagai "preferred" (cuma bisa set),
  // jadi lintas-reload memang tidak ke-highlight otomatis, itu bukan bug.
  const [macTerpilih, setMacTerpilih] = useState<string | null>(null);
  const [memilih, setMemilih] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMyProfile()
      .then((p) => {
        setProfile(p);
        setFullName(p.fullName);
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Gagal memuat profil."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setBridgeAvailable(isNativeBridgeAvailable());
  }, []);

  async function muatPrinter() {
    setLoadingPrinters(true);
    try {
      const hasil = await listPairedPrinters();
      setPrinters(hasil.printers);
      setIzinDitolakPermanen(hasil.permissionPermanentlyDenied);
    } catch {
      toast.error("Gagal memuat daftar printer Bluetooth.");
    } finally {
      setLoadingPrinters(false);
    }
  }

  useEffect(() => {
    if (bridgeAvailable) muatPrinter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgeAvailable]);

  async function handlePilihPrinter(p: PairedPrinter) {
    setMemilih(p.macAddress);
    try {
      await selectPrinter(p);
      setMacTerpilih(p.macAddress);
      toast.success(`Printer "${p.name}" dipilih untuk cetak struk.`);
    } catch {
      toast.error("Gagal memilih printer.");
    } finally {
      setMemilih(null);
    }
  }

  async function handleSave() {
    if (!fullName.trim()) return;
    setSaving(true);
    try {
      const updated = await api.updateMyProfile({ fullName: fullName.trim() });
      setProfile(updated);
      toast.success("Profil berhasil diperbarui.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan profil.");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9F6]">
      <div className="bg-white px-5 pt-5 pb-4">
        <h1 className="text-lg font-extrabold text-slate-900">Profil &amp; Pengaturan</h1>
        <p className="text-sm text-slate-500 mt-1">Kelola informasi akun Anda.</p>
      </div>

      <div className="p-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: OBBEL_SCALE[50] }}>
            <User size={24} style={{ color: GREEN }} />
          </div>
          <div>
            <p className="font-extrabold text-slate-900">{profile.fullName}</p>
            <p className="text-sm text-slate-500">Petugas Booth • @{profile.username}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-4">
          <label className="text-base font-semibold text-slate-700 block mb-1.5">Nama Lengkap</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-[#0B5D34]"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || fullName.trim() === profile.fullName}
            className="w-full mt-3 rounded-xl py-3 font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: GREEN }}
          >
            {saving ? <Spinner size="sm" color="white" /> : "Simpan Perubahan"}
          </button>
        </div>

        {bridgeAvailable ? (
          <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-base font-semibold text-slate-700 flex items-center gap-2">
                <Printer size={18} style={{ color: GREEN }} /> Printer Bluetooth
              </label>
              <button
                type="button"
                onClick={muatPrinter}
                disabled={loadingPrinters}
                className="text-sm font-semibold disabled:opacity-50"
                style={{ color: GREEN }}
              >
                {loadingPrinters ? "Memuat..." : "Muat ulang"}
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-3">
              Pilih printer struk untuk transaksi Kasir. Pairing perangkat dulu lewat pengaturan Bluetooth HP.
            </p>
            {izinDitolakPermanen && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-3 text-sm text-amber-800 mb-3">
                <p className="font-semibold mb-1.5">Izin Bluetooth ditolak</p>
                <p className="mb-2">
                  Aplikasi tidak bisa lihat printer sampai izin Bluetooth diaktifkan manual — nyalain dulu lewat
                  Pengaturan aplikasi.
                </p>
                <button
                  type="button"
                  onClick={openPrinterSettings}
                  className="font-bold underline"
                >
                  Buka Pengaturan Aplikasi
                </button>
              </div>
            )}
            {loadingPrinters ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : printers.length === 0 && !izinDitolakPermanen ? (
              <p className="text-sm text-slate-400 text-center py-4">
                Belum ada printer ter-pairing. Pairing dulu lewat pengaturan Bluetooth HP, lalu tekan "Muat ulang".
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {printers.map((p) => {
                  const aktif = macTerpilih === p.macAddress;
                  return (
                    <button
                      key={p.macAddress}
                      type="button"
                      onClick={() => handlePilihPrinter(p)}
                      disabled={memilih === p.macAddress}
                      className="flex items-center justify-between rounded-xl border-2 px-3.5 py-3 text-left disabled:opacity-60"
                      style={aktif ? { borderColor: GREEN, backgroundColor: OBBEL_SCALE[50] } : { borderColor: "#E2E8F0" }}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-base text-slate-900 truncate">{p.name}</p>
                        <p className="text-sm text-slate-400 font-mono truncate">{p.macAddress}</p>
                      </div>
                      {memilih === p.macAddress ? (
                        <Spinner size="sm" />
                      ) : aktif ? (
                        <Check size={18} style={{ color: GREEN }} />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 mb-4 text-sm text-slate-500">
            Pengaturan printer Bluetooth cuma tersedia lewat aplikasi Obbel (bukan browser biasa).
          </div>
        )}

        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-rose-200 text-rose-600 py-3.5 font-extrabold"
        >
          <LogOut size={18} /> Keluar Akun
        </button>

        <p className="text-center text-sm text-slate-400 mt-6">Obbel Coffee &amp; Milk — Good Coffee, Good Mood</p>
      </div>
    </div>
  );
}

export default function SettingPage() {
  return (
    <RequirePetugasAuth>
      <SettingContent />
    </RequirePetugasAuth>
  );
}
