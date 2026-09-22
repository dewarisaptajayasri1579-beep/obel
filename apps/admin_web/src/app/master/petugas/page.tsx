"use client";

import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type Booth, type UserAccount } from "@/lib/api-client";
import { PetugasTabs } from "./PetugasTabs";
import { TabMain } from "./TabMain";

/// Halaman Petugas (Data Operasional) — akun login Petugas Booth (role
/// BOOTH_STAFF) di aplikasi Android. TERPISAH dari `/master/user`: halaman
/// itu tetap jadi tempat kelola akun Admin/Owner, di sini khusus Petugas
/// karena karakternya beda (banyak, sering ganti, diaktif/nonaktifkan
/// mengikuti pergantian personel) dan lebih sering dibuka dari sini.
function PetugasContent() {
  const toast = useToast();
  const [users, setUsers] = useState<UserAccount[] | null>(null);
  const [booths, setBooths] = useState<Booth[]>([]);

  const load = useCallback(async () => {
    try {
      const [userList, boothList] = await Promise.all([api.getUsers(), api.getBooths()]);
      setUsers(userList.filter((u) => u.role === "BOOTH_STAFF"));
      setBooths(boothList);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Petugas.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!users) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <Breadcrumb
        items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Data Operasional" }, { label: "Petugas" }]}
      />

      <PetugasTabs
        isi={{
          main: <TabMain users={users} booths={booths} onReload={load} />,
        }}
      />
    </div>
  );
}

export default function PetugasPage() {
  return (
    <RequireAuth>
      <PetugasContent />
    </RequireAuth>
  );
}
