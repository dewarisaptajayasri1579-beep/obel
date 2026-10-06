"use client";

import { useEffect, useState } from "react";
import { Crosshair, MapPinned, Save } from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { useAccess } from "@/lib/auth-context";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type AppSettings } from "@/lib/api-client";
import { pesanGpsError } from "@/lib/gps-error";

/// Pengaturan absen Barista (BR-042): titik Gudang (acuan absen Berangkat &
/// Kembali), radius absen, dan toleransi Check-Out sebelum jam selesai shift.
/// Titik Booth diatur di Data Booth masing-masing.
function AbsensiContent() {
  const toast = useToast();
  const { canManage } = useAccess();
  const bolehKelola = canManage("ABSENSI");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("");
  const [toleransi, setToleransi] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [mencariLokasi, setMencariLokasi] = useState(false);

  function isi(s: AppSettings) {
    setSettings(s);
    setLat(s.warehouseLatitude?.toString() ?? "");
    setLng(s.warehouseLongitude?.toString() ?? "");
    setRadius(String(s.attendanceRadiusMeters));
    setToleransi(String(s.earlyCheckoutToleranceMinutes));
  }

  useEffect(() => {
    api
      .getAppSettings()
      .then(isi)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Gagal memuat Pengaturan Absensi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pakaiLokasiSaya() {
    if (!navigator.geolocation) {
      toast.error("Perangkat ini tidak mendukung GPS.");
      return;
    }
    setMencariLokasi(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setMencariLokasi(false);
        toast.success(`Lokasi diambil (akurasi ±${Math.round(pos.coords.accuracy)} m). Simpan untuk menerapkan.`);
      },
      (err) => {
        setMencariLokasi(false);
        toast.error(pesanGpsError(err));
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function simpan() {
    const kosong = lat.trim() === "" && lng.trim() === "";
    if (!kosong && (lat.trim() === "" || lng.trim() === "")) {
      toast.error("Isi latitude dan longitude Gudang, atau kosongkan keduanya.");
      return;
    }
    setMenyimpan(true);
    try {
      isi(
        await api.updateAppSettings({
          warehouseLatitude: kosong ? null : Number(lat),
          warehouseLongitude: kosong ? null : Number(lng),
          attendanceRadiusMeters: Number(radius),
          earlyCheckoutToleranceMinutes: Number(toleransi),
        }),
      );
      toast.success("Pengaturan Absensi disimpan.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan Pengaturan Absensi.");
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Pengaturan" }, { label: "Absensi" }]} />

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-(--brand-700) dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-100 dark:border-brand-500/20 shadow-2xs">
          <MapPinned className="w-4.5 h-4.5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-fg tracking-tight">Absensi</h1>
          <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
            Barista absen 4 kali per shift: Berangkat &amp; Kembali di Gudang, Tiba &amp; Check-Out di Booth. Titik Booth diatur di Data Booth.
          </p>
        </div>
      </div>

      {!settings ? (
        <div className="flex justify-center py-14">
          <Spinner />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-5 space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-700 dark:text-fg-secondary">Titik Gudang</p>
              {bolehKelola && (
                <Button variant="secondary" size="sm" leftIcon={<Crosshair className="w-3.5 h-3.5" />} onClick={pakaiLokasiSaya} isLoading={mencariLokasi}>
                  Pakai lokasi saya
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Latitude" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-7.540767" />
              <Input label="Longitude" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="110.596337" />
            </div>
            {lat.trim() === "" && lng.trim() === "" && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Titik Gudang belum diatur — absen Berangkat &amp; Kembali tidak dicek jaraknya, hanya ditandai di riwayat.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Radius absen (meter)"
              type="number"
              min={20}
              max={1000}
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              helperText="Di luar radius ini absen ditolak, kecuali Admin memberi izin. 20–1000 m."
            />
            <Input
              label="Toleransi Check-Out (menit)"
              type="number"
              min={0}
              max={180}
              value={toleransi}
              onChange={(e) => setToleransi(e.target.value)}
              helperText="Check-Out boleh sekian menit sebelum jam selesai shift. 0–180."
            />
          </div>

          {bolehKelola && (
            <div className="flex justify-end pt-1">
              <Button variant="primary" size="sm" leftIcon={<Save className="w-3.5 h-3.5" />} onClick={simpan} isLoading={menyimpan}>
                Simpan
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PengaturanAbsensiPage() {
  return (
    <RequireAuth>
      <AbsensiContent />
    </RequireAuth>
  );
}
