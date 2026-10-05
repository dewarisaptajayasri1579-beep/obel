"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAccess, useAuth } from "@/lib/auth-context";
import { accessForPath } from "@/lib/nav-config";
import { useNav } from "@/lib/use-nav";
import { AppLayout } from "./AppLayout";
import { NoAccess } from "./NoAccess";
import { Spinner } from "../ui/Spinner";

const ROLE_LABEL: Record<string, string> = {
  BOOTH_STAFF: "Barista",
  ADMIN: "Admin Pusat",
  OWNER: "Owner",
};

/// Guard client-side: otorisasi sesungguhnya tetap ditegakkan Backend API di
/// setiap request (JwtAuthGuard/RolesGuard + hak akses menu, BR-044) — ini
/// mencegah UI terbuka tanpa sesi dan menampilkan "tidak punya akses" untuk
/// halaman yang menunya tidak boleh dilihat, alih-alih halaman penuh error 403.
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading, accessReady } = useAuth();
  const { canView, isOwner, roleName } = useAccess();
  const { flatItems } = useNav();
  const router = useRouter();
  const pathname = usePathname() || "/dashboard";

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    // BOOTH_STAFF tidak boleh melihat shell Admin (Master Data, User, dst) —
    // pengalamannya ada di /petugas (lihat RequirePetugasAuth.tsx).
    if (session.profile.role === "BOOTH_STAFF") {
      router.replace("/petugas");
    }
  }, [loading, session, router]);

  // Sesi lama (sebelum RBAC) belum membawa hak akses — tunggu GET /users/me.
  if (loading || !session || session.profile.role === "BOOTH_STAFF" || (!session.access && !accessReady)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const syarat = accessForPath(pathname);
  const boleh = syarat.kind === "free" || (syarat.kind === "owner" ? isOwner : canView(syarat.menu));
  const tanpaPeran = session.profile.role === "ADMIN" && !roleName;
  const pertama = flatItems[0];

  return (
    <AppLayout userName={session.profile.fullName} userRole={ROLE_LABEL[session.profile.role] ?? session.profile.role}>
      {boleh ? (
        children
      ) : tanpaPeran ? (
        <NoAccess
          title="Akun belum diberi peran"
          description="Akun Admin Anda belum punya peran hak akses, jadi belum ada menu yang bisa dibuka. Hubungi Owner untuk memasang peran."
        />
      ) : (
        <NoAccess
          title="Tidak punya akses"
          description="Peran Anda tidak memberi akses ke halaman ini. Hubungi Owner kalau Anda memerlukannya."
          next={pertama ? { label: pertama.label, href: pertama.href } : undefined}
        />
      )}
    </AppLayout>
  );
}
