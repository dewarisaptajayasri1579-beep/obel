"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "../ui/Spinner";
import { PetugasShell } from "./PetugasShell";

/// Guard client-side khusus BOOTH_STAFF — mirror RequireAuth.tsx tapi
/// membungkus PetugasShell (bottom tab bar, bukan Sidebar/AppLayout admin)
/// dan mengarahkan role selain BOOTH_STAFF balik ke /dashboard, bukan
/// merender shell ini. Otorisasi sesungguhnya tetap di Backend API.
export function RequirePetugasAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/petugas/login");
      return;
    }
    if (session.profile.role !== "BOOTH_STAFF") {
      router.replace("/dashboard");
    }
  }, [loading, session, router]);

  if (loading || !session || session.profile.role !== "BOOTH_STAFF") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9F6]">
        <Spinner />
      </div>
    );
  }

  return <PetugasShell>{children}</PetugasShell>;
}
