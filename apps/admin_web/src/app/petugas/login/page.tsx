"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { User, Lock, Eye, EyeOff, LifeBuoy } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { Spinner } from "@/components/ui/Spinner";
import { OBBEL, OBBEL_SCALE } from "../_lib/theme";

const PETUGAS_GREEN = OBBEL.primaryDark;

export default function PetugasLoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      router.push("/petugas");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal login. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{
        background: `
          radial-gradient(120% 80% at 15% 0%, rgba(255,255,255,0.16) 0%, transparent 55%),
          radial-gradient(90% 70% at 100% 10%, rgba(255,255,255,0.10) 0%, transparent 50%),
          linear-gradient(160deg, ${OBBEL.primaryMedium} 0%, ${PETUGAS_GREEN} 55%, ${OBBEL_SCALE[800]} 100%)
        `,
      }}
    >
      <div className="w-full max-w-sm flex flex-col items-center pt-10 pb-8">
        <div className="w-24 h-24 rounded-[28px] bg-white flex items-center justify-center shadow-[0_16px_40px_-12px_rgba(0,0,0,0.45)] mb-5 ring-4 ring-white/15">
          <Image src="/logo.png" alt="Obbel" width={66} height={66} className="object-contain" priority />
        </div>
        <h1 className="text-white font-extrabold text-[26px] tracking-tight">Obbel Petugas Booth</h1>
        <p className="text-white/75 text-base mt-1.5 font-medium">Check-In, Kasir, dan aktivitas harian Anda</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-[28px] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.35)] p-7 flex flex-col gap-4"
      >
        <div>
          <label className="text-sm font-bold uppercase tracking-wide text-slate-400 block mb-2">Username</label>
          <div className="relative">
            <User size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              className="w-full rounded-2xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 pl-10 pr-4 py-3.5 text-base font-medium outline-none transition focus:border-[#0B5D34] focus:ring-4 focus:ring-[#0B5D34]/10"
              placeholder="Masukkan username"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-bold uppercase tracking-wide text-slate-400 block mb-2">Password</label>
          <div className="relative">
            <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-2xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 pl-10 pr-10 py-3.5 text-base font-medium outline-none transition focus:border-[#0B5D34] focus:ring-4 focus:ring-[#0B5D34]/10"
              placeholder="Masukkan password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-base px-4 py-3 font-medium">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl py-4 font-extrabold text-white flex items-center justify-center gap-2 disabled:opacity-60 shadow-[0_12px_28px_-8px_rgba(11,93,52,0.55)] transition active:scale-[0.99]"
          style={{ backgroundColor: PETUGAS_GREEN }}
        >
          {submitting ? <Spinner size="sm" color="white" /> : "MASUK"}
        </button>

        <button type="button" className="flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-400 mt-1">
          <LifeBuoy size={13} /> Butuh bantuan?
        </button>
      </form>

      <p className="text-white/60 text-sm mt-8 text-center font-medium">Obbel Coffee &amp; Milk — Good Coffee, Good Mood</p>
    </div>
  );
}
