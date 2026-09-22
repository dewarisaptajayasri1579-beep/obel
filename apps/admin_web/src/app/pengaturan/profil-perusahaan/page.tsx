"use client";

import { useEffect, useState } from "react";
import { Building2, Save } from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type CompanyProfile } from "@/lib/api-client";
import { LogoPerusahaanInput } from "./LogoPerusahaanInput";

function ProfilPerusahaanContent() {
  const toast = useToast();
  const [profil, setProfil] = useState<CompanyProfile | null>(null);
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    api
      .getCompanyProfile()
      .then((p) => {
        setProfil(p);
        setName(p.name);
        setLegalName(p.legalName ?? "");
        setAddress(p.address ?? "");
        setPhone(p.phone ?? "");
        setLogoUrl(p.logoUrl ?? "");
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Gagal memuat Profil Perusahaan."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function simpan() {
    if (!name.trim()) {
      toast.error("Nama perusahaan wajib diisi.");
      return;
    }
    setMenyimpan(true);
    try {
      const hasil = await api.updateCompanyProfile({
        name: name.trim(),
        legalName: legalName.trim() || undefined,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        logoUrl: logoUrl || undefined,
      });
      setProfil(hasil);
      toast.success("Profil Perusahaan disimpan.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan Profil Perusahaan.");
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Pengaturan" }, { label: "Profil Perusahaan" }]} />

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 flex items-center justify-center flex-shrink-0 border border-brand-100 dark:border-brand-500/20 shadow-2xs">
          <Building2 className="w-4.5 h-4.5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-fg tracking-tight">Profil Perusahaan</h1>
          <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
            Identitas yang dipajang di kop semua dokumen cetak (PDF/Excel) — daftar produk, Tambah Stok Gudang, dan seterusnya.
          </p>
        </div>
      </div>

      {!profil ? (
        <div className="flex justify-center py-14">
          <Spinner />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-5 space-y-5">
          <LogoPerusahaanInput value={logoUrl} onChange={setLogoUrl} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nama Perusahaan" value={name} onChange={(e) => setName(e.target.value)} placeholder="Obbel Coffee & Milk" />
            <Input
              label="Nama Resmi/Legal (opsional)"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="mis. PT/CV ..."
            />
          </div>

          <Input
            label="Alamat"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Boyolali, Jawa Tengah, Indonesia"
          />

          <Input label="Telepon (opsional)" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="mis. 0812xxxxxxx" />

          <div className="flex justify-end pt-1">
            <Button variant="primary" size="sm" leftIcon={<Save className="w-3.5 h-3.5" />} onClick={simpan} isLoading={menyimpan}>
              Simpan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfilPerusahaanPage() {
  return (
    <RequireAuth>
      <ProfilPerusahaanContent />
    </RequireAuth>
  );
}
