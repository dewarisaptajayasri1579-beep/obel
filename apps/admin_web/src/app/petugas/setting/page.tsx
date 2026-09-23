"use client";

import React, { useEffect, useState } from "react";
import { User, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, type UserAccount } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";

import { OBBEL } from "../_lib/theme";
const GREEN = OBBEL.primaryDark;

function SettingContent() {
  const { logout } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState<UserAccount | null>(null);
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

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
        <p className="text-xs text-slate-500 mt-1">Kelola informasi akun Anda.</p>
      </div>

      <div className="p-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E8F5E9" }}>
            <User size={24} style={{ color: GREEN }} />
          </div>
          <div>
            <p className="font-extrabold text-slate-900">{profile.fullName}</p>
            <p className="text-xs text-slate-500">Petugas Booth • @{profile.username}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-4">
          <label className="text-sm font-semibold text-slate-700 block mb-1.5">Nama Lengkap</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#0B5D34]"
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

        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-rose-200 text-rose-600 py-3.5 font-extrabold"
        >
          <LogOut size={18} /> Keluar Akun
        </button>

        <p className="text-center text-[11px] text-slate-400 mt-6">Obbel Coffee &amp; Milk — Good Coffee, Good Mood</p>
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
