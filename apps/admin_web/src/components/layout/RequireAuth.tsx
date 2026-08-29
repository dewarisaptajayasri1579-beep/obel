"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "./AppLayout";
import { Spinner } from "../ui/Spinner";

const ROLE_LABEL: Record<string, string> = {
  BOOTH_STAFF: "Petugas Booth",
  ADMIN: "Admin Pusat",
  OWNER: "Owner",
};

/// Guard client-side: otorisasi sesungguhnya tetap ditegakkan Backend API di
/// setiap request (JwtAuthGuard/RolesGuard) — ini cuma mencegah UI terbuka
/// tanpa sesi supaya tidak sempat memanggil endpoint dengan token kosong.
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <AppLayout userName={session.profile.fullName} userRole={ROLE_LABEL[session.profile.role] ?? session.profile.role}>
      {children}
    </AppLayout>
  );
}
