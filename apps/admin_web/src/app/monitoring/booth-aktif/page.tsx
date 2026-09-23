"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { io, type Socket } from "socket.io-client";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBadge, type StatusBadgeType } from "@/components/ui/StatusBadge";
import { BASE_URL, getToken, type BoothAktifCard } from "@/lib/api-client";
import { formatJakartaTime } from "@/lib/datetime";
import { kategoriBooth, type KategoriKartu } from "./kategori";
import {
  X,
  User,
  Clock,
  Coffee,
  Package,
  Search,
  SlidersHorizontal,
  Store,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  CalendarClock,
  LayoutGrid,
  MapPin,
  Send,
} from "lucide-react";

// Leaflet menyentuh `window`/`document` langsung — wajib no-SSR, dan cukup
// dimuat saat tab Map dibuka (bukan ikut bundle awal tab Card).
const BoothMapView = dynamic(() => import("./BoothMapView").then((m) => m.BoothMapView), {
  ssr: false,
  loading: () => (
    <div className="flex-1 min-w-0 rounded-2xl border border-slate-200/90 dark:border-line flex items-center justify-center" style={{ height: 560 }}>
      <Spinner />
    </div>
  ),
});

type SocketStatus = "connecting" | "connected" | "disconnected";
type TabAktif = "card" | "map";

const KATEGORI_STYLE: Record<
  KategoriKartu,
  { dot: string; border: string; borderSelected: string; ring: string }
> = {
  normal: {
    dot: "bg-emerald-500",
    border: "border-slate-200/90 dark:border-line",
    borderSelected: "border-emerald-500",
    ring: "ring-emerald-500/15",
  },
  kritis: {
    dot: "bg-amber-500",
    border: "border-amber-300/80 dark:border-amber-500/40",
    borderSelected: "border-amber-500",
    ring: "ring-amber-500/15",
  },
  habis: {
    dot: "bg-rose-500",
    border: "border-rose-300/80 dark:border-rose-500/40",
    borderSelected: "border-rose-500",
    ring: "ring-rose-500/15",
  },
  nonaktif: {
    dot: "bg-slate-400",
    border: "border-slate-200/90 dark:border-line",
    borderSelected: "border-slate-400",
    ring: "ring-slate-400/15",
  },
};

const STOCK_STATUS_BADGE: Record<BoothAktifCard["stockStatus"], StatusBadgeType> = {
  Aman: "stock_aman",
  Menipis: "stock_menipis",
  Kritis: "stock_kritis",
  Habis: "stock_habis",
};

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

function formatDurasi(startAt: string, now: Date) {
  const start = new Date(startAt);
  const diffMs = Math.max(0, now.getTime() - start.getTime());
  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}j ${minutes}m`;
}

/// Inisial 1-2 huruf untuk avatar Petugas — tidak ada field foto profil di
/// database sama sekali (keputusan produk: avatar inisial dulu, bukan
/// membangun fitur upload foto baru di luar scope halaman ini).
function inisial(nama: string) {
  const bagian = nama.trim().split(/\s+/);
  const dua = bagian.length > 1 ? bagian[0][0] + bagian[1][0] : bagian[0].slice(0, 2);
  return dua.toUpperCase();
}

const AVATAR_PALET = ["bg-brand-600", "bg-blue-600", "bg-violet-600", "bg-amber-600", "bg-rose-600", "bg-teal-600"];

function warnaAvatar(nama: string) {
  let h = 0;
  for (let i = 0; i < nama.length; i++) h = (h + nama.charCodeAt(i)) % AVATAR_PALET.length;
  return AVATAR_PALET[h];
}

function Avatar({ nama, size = "md" }: { nama: string; size?: "sm" | "md" | "lg" }) {
  const dim = { sm: "w-7 h-7 text-[10px]", md: "w-9 h-9 text-xs", lg: "w-12 h-12 text-sm" }[size];
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white font-bold shrink-0 ${dim} ${warnaAvatar(nama)}`}
    >
      {inisial(nama)}
    </span>
  );
}

function IndikatorKoneksi({ status }: { status: SocketStatus }) {
  const config = {
    connecting: { dot: "bg-amber-500 animate-pulse", label: "Menyambungkan...", pill: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    connected: { dot: "bg-emerald-500 animate-pulse", label: "Sistem Online", pill: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
    disconnected: { dot: "bg-rose-500", label: "Terputus", pill: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400" },
  }[status];

  return (
    <div className={`flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-bold shrink-0 ${config.pill}`}>
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      {config.label}
    </div>
  );
}

function WaktuSekarang() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const label = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(now);
  const jam = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(now);
  return (
    <div className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-bold text-slate-600 dark:text-fg-secondary bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line shrink-0">
      <CalendarClock className="w-3.5 h-3.5" />
      {label}, {jam} WIB
    </div>
  );
}

function KartuRingkasan({ icon: Icon, label, value, caption, warna }: {
  icon: typeof Store;
  label: string;
  value: string | number;
  caption: string;
  warna: "brand" | "emerald" | "slate" | "blue" | "amber";
}) {
  const wrap = {
    brand: "bg-brand-500/15 text-brand-700 dark:text-brand-400",
    emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    slate: "bg-slate-500/15 text-slate-700 dark:text-fg-secondary",
    blue: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    amber: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  }[warna];

  return (
    <Card variant="solid" padding="md" className="flex items-center gap-3">
      <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${wrap}`}>
        <Icon className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-slate-500 dark:text-fg-muted truncate">{label}</div>
        <div className="text-xl font-black text-slate-900 dark:text-fg leading-tight">{value}</div>
        <div className="text-[11px] text-slate-400 dark:text-fg-disabled truncate">{caption}</div>
      </div>
    </Card>
  );
}

function KartuBooth({ booth, dipilih, onClick }: { booth: BoothAktifCard; dipilih: boolean; onClick: () => void }) {
  const kategori = kategoriBooth(booth);
  const style = KATEGORI_STYLE[kategori];
  const stockPct = booth.stockQty <= 0 ? 0 : Math.min(100, Math.round((booth.stockQty / 120) * 100));
  const barColor = kategori === "habis" ? "bg-rose-500" : kategori === "kritis" ? "bg-amber-500" : "bg-emerald-500";
  // Kartu Kritis/Habis diberi glow berdenyut (globals.css) supaya alert-nya
  // kelihatan dari sudut mata lewat gerakan, bukan cuma warna statis — yang
  // dipilih sebagai gaya visual (bukan pulsing border/badge ping) karena
  // paling mirip "shadow keluar dari border" yang diminta.
  const glow = kategori === "habis" ? "animate-glow-rose" : kategori === "kritis" ? "animate-glow-amber" : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl border-2 p-3 transition-all bg-white dark:bg-surface cursor-pointer ${glow} ${
        dipilih ? `${style.borderSelected} ring-4 ${style.ring}` : `${style.border} hover:border-slate-300 dark:hover:border-line-strong`
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-black text-slate-800 dark:text-fg">{booth.boothCode}</span>
        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
      </div>

      {booth.pendingDistribution && (
        <div className="flex items-center gap-1 mb-2 px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[9px] font-bold w-fit">
          <Send className="w-2.5 h-2.5" />
          Kirim Stok Proses
        </div>
      )}

      <div className="flex items-center gap-1.5 mb-1">
        <Coffee className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-base font-black text-slate-800 dark:text-fg">
          {booth.isActive ? booth.cupSoldToday : "-"}
        </span>
      </div>
      <div className="h-1 rounded-full bg-slate-100 dark:bg-surface-hover overflow-hidden mb-2">
        <div className={`h-full rounded-full ${booth.isActive ? barColor : "bg-slate-200 dark:bg-line"}`} style={{ width: `${booth.isActive ? stockPct : 0}%` }} />
      </div>

      <div className="flex items-center gap-1.5 mb-2">
        <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-xs font-bold text-slate-600 dark:text-fg-secondary">
          {booth.isActive ? booth.stockQty : "-"}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {booth.staffName ? <Avatar nama={booth.staffName} size="sm" /> : (
          <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-surface-hover flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5 text-slate-300 dark:text-fg-disabled" />
          </span>
        )}
        <span className="text-[11px] font-semibold text-slate-500 dark:text-fg-muted truncate">
          {booth.staffName ? booth.staffName.split(" ")[0] : "-"}
        </span>
      </div>
    </button>
  );
}

function PanelDetail({ booth, now, onClose }: { booth: BoothAktifCard; now: Date; onClose: () => void }) {
  const trend =
    booth.cupSoldYesterday > 0
      ? Math.round(((booth.cupSoldToday - booth.cupSoldYesterday) / booth.cupSoldYesterday) * 100)
      : null;
  // Kirim Stok cuma relevan kalau Booth ini aktif (ada Petugas yang bisa
  // menerima) dan stoknya memang butuh diisi ulang (Kritis/Habis). Tombolnya
  // dinonaktifkan kalau masih ada Serah Terima Stok berstatus SENT ke Booth
  // ini (belum dikonfirmasi diterima) — supaya Admin tidak kirim dobel.
  const perluKirimStok = booth.isActive && (booth.stockStatus === "Kritis" || booth.stockStatus === "Habis");
  const sedangKirimStok = booth.pendingDistribution !== null;

  return (
    <div className="w-full lg:w-[380px] shrink-0">
      <Card variant="solid" padding="md" className="lg:sticky lg:top-4 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-black text-slate-900 dark:text-fg">Booth {booth.boothCode}</h2>
            <StatusBadge type={booth.isActive ? "safe" : "inactive"} label={booth.isActive ? "Aktif" : "Non Aktif"} size="sm" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-hover cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-fg-muted -mt-3">
          Lokasi: {booth.locationName ?? "Belum diisi"}
        </p>

        {booth.staffName ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-surface-hover">
            <Avatar nama={booth.staffName} size="lg" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-800 dark:text-fg truncate">{booth.staffName}</div>
              <div className="text-[11px] text-slate-500 dark:text-fg-muted">Petugas Saat Ini</div>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-hover text-xs text-slate-500 dark:text-fg-muted">
            Tidak ada Petugas bertugas saat ini.
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-line">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Coffee className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Cup Terjual</span>
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-fg">{booth.cupSoldToday}</div>
            {trend !== null && (
              <div className={`flex items-center gap-1 text-[11px] font-bold ${trend >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {trend >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {Math.abs(trend)}% dari kemarin
              </div>
            )}
          </div>
          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-line">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Package className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Stok Saat Ini</span>
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-fg mb-1">{booth.stockQty}</div>
            <StatusBadge type={STOCK_STATUS_BADGE[booth.stockStatus]} size="sm" />
          </div>
          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-line">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Check In</span>
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-fg">
              {booth.shiftStartAt ? formatJakartaTime(new Date(booth.shiftStartAt)) : "-"}
            </div>
          </div>
          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-line">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Durasi Kerja</span>
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-fg">
              {booth.shiftStartAt ? formatDurasi(booth.shiftStartAt, now) : "-"}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm px-1">
          <div>
            <div className="text-[11px] text-slate-400 dark:text-fg-muted">Shift</div>
            <div className="font-bold text-slate-800 dark:text-fg">{booth.shiftLabel ?? "-"}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-slate-400 dark:text-fg-muted">Omzet</div>
            <div className="font-bold text-slate-800 dark:text-fg">{formatRupiah(booth.omzetToday)}</div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-slate-700 dark:text-fg-secondary mb-2">Stok Produk (Top 5)</h3>
          {booth.topStock.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-fg-disabled">Belum ada stok tercatat.</p>
          ) : (
            <div className="space-y-2">
              {booth.topStock.map((p) => {
                const max = booth.topStock[0]?.qty || 1;
                const pct = Math.round((p.qty / max) * 100);
                return (
                  <div key={p.productName} className="flex items-center gap-2 text-xs">
                    <span className="w-24 shrink-0 truncate text-slate-600 dark:text-fg-secondary">{p.productName}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-surface-hover overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-12 shrink-0 text-right font-bold text-slate-700 dark:text-fg-secondary">{p.qty} cup</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {sedangKirimStok && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/15 border border-blue-100 dark:border-blue-900/30 text-blue-700 dark:text-blue-400">
            <Send className="w-4 h-4 shrink-0" />
            <p className="text-xs font-semibold leading-snug">
              Masih ada pengiriman stok yang belum dikonfirmasi diterima (
              <span className="font-mono">{booth.pendingDistribution!.distributionNo}</span>
              {booth.pendingDistribution!.count > 1 ? ` +${booth.pendingDistribution!.count - 1} lainnya` : ""}).
            </p>
          </div>
        )}

        {perluKirimStok &&
          (sedangKirimStok ? (
            <button
              type="button"
              disabled
              title="Selesaikan dulu pengiriman stok yang sedang berjalan"
              className="flex items-center justify-center gap-2 h-10 rounded-xl bg-slate-200 dark:bg-surface-hover text-slate-400 dark:text-fg-disabled text-sm font-bold cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Kirim Stok
            </button>
          ) : (
            <Link
              href={`/serah-terima-stok/baru?boothId=${booth.boothId}`}
              className="flex items-center justify-center gap-2 h-10 rounded-xl bg-[var(--brand-700)] hover:bg-[var(--brand-800)] text-white text-sm font-bold shadow-sm cursor-pointer transition-colors"
            >
              <Send className="w-4 h-4" />
              Kirim Stok
            </Link>
          ))}

        <Link
          href={`/master/booth?tab=riwayat-penjualan&boothId=${booth.boothId}`}
          className="block text-center h-10 leading-10 rounded-xl border border-slate-200/90 dark:border-line text-sm font-bold text-slate-700 dark:text-fg-secondary hover:bg-slate-50 dark:hover:bg-surface-hover cursor-pointer"
        >
          Lihat Riwayat
        </Link>
      </Card>
    </div>
  );
}

const FILTER_OPTIONS: { value: KategoriKartu | "semua"; label: string }[] = [
  { value: "semua", label: "Semua Status" },
  { value: "normal", label: "Aktif & Normal" },
  { value: "kritis", label: "Aktif · Stok Kritis" },
  { value: "habis", label: "Aktif · Stok Habis" },
  { value: "nonaktif", label: "Nonaktif" },
];

function BoothAktifContent() {
  const [data, setData] = useState<BoothAktifCard[] | null>(null);
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [now, setNow] = useState(new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabAktif>("card");
  const [cari, setCari] = useState("");
  const [filter, setFilter] = useState<KategoriKartu | "semua">("semua");
  const [filterOpen, setFilterOpen] = useState(false);
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

  // Push dari backend lewat WebSocket (backend/src/modules/dashboard/booth-aktif.gateway.ts)
  // — bukan polling client. Server broadcast snapshot terbaru tiap ~5 detik
  // ke semua yang tersambung, plus langsung kirim sekali begitu socket connect
  // (termasuk saat reconnect otomatis setelah koneksi sempat putus).
  useEffect(() => {
    const socket: Socket = io(`${BASE_URL}/booth-aktif`, {
      auth: { token: getToken() },
    });

    socket.on("connect", () => setStatus("connected"));
    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("connect_error", () => setStatus("disconnected"));
    socket.on("booth-aktif:snapshot", (rows: BoothAktifCard[]) => setData(rows));

    setSocketInstance(socket);
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  function refresh() {
    // Tidak ada endpoint "minta snapshot sekali" terpisah — reconnect socket
    // sudah cukup, karena handleConnection di gateway selalu mengirim
    // snapshot langsung begitu koneksi baru terbentuk.
    socketInstance?.disconnect();
    socketInstance?.connect();
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = cari.trim().toLowerCase();
    return data.filter((b) => {
      if (filter !== "semua" && kategoriBooth(b) !== filter) return false;
      if (!q) return true;
      return b.boothName.toLowerCase().includes(q) || b.boothCode.toLowerCase().includes(q) || (b.staffName ?? "").toLowerCase().includes(q);
    });
  }, [data, cari, filter]);

  const ringkasan = useMemo(() => {
    if (!data) return null;
    const aktif = data.filter((b) => b.isActive).length;
    const totalCup = data.reduce((s, b) => s + b.cupSoldToday, 0);
    const kritisAtauHabis = data.filter((b) => b.isActive && (b.stockStatus === "Kritis" || b.stockStatus === "Habis")).length;
    return {
      total: data.length,
      aktif,
      nonaktif: data.length - aktif,
      pctAktif: data.length ? Math.round((aktif / data.length) * 100) : 0,
      pctNonaktif: data.length ? Math.round(((data.length - aktif) / data.length) * 100) : 0,
      totalCup,
      kritisAtauHabis,
    };
  }, [data]);

  const selected = data?.find((b) => b.boothId === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Booth Monitoring</h1>
          <p className="text-sm text-slate-500 dark:text-fg-muted">Pantau aktivitas booth secara real-time.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <WaktuSekarang />
          <IndikatorKoneksi status={status} />
          <button
            type="button"
            onClick={refresh}
            className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-bold text-brand-700 dark:text-brand-400 bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line hover:bg-slate-50 dark:hover:bg-surface-hover cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {!data || !ringkasan ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            {(
              [
                { value: "card" as const, label: "Tampilan Kartu", icon: LayoutGrid },
                { value: "map" as const, label: "Peta Lokasi", icon: MapPin },
              ]
            ).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`flex items-center gap-2 px-4 h-9 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                  tab === value
                    ? "bg-brand-700 text-white border-brand-700 shadow-xs"
                    : "bg-white/90 dark:bg-surface text-slate-700 dark:text-fg-secondary border-slate-200/90 dark:border-line hover:bg-slate-50 dark:hover:bg-surface-hover"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KartuRingkasan icon={Store} label="Total Booth" value={ringkasan.total} caption="Seluruh lokasi" warna="brand" />
            <KartuRingkasan icon={Store} label="Booth Aktif" value={ringkasan.aktif} caption={`${ringkasan.pctAktif}% dari total`} warna="emerald" />
            <KartuRingkasan icon={Store} label="Booth Nonaktif" value={ringkasan.nonaktif} caption={`${ringkasan.pctNonaktif}% dari total`} warna="slate" />
            <KartuRingkasan icon={Coffee} label="Total Cup Terjual" value={ringkasan.totalCup} caption="Hari ini" warna="blue" />
            <button type="button" onClick={() => setFilter("kritis")} className="text-left cursor-pointer">
              <KartuRingkasan icon={Package} label="Booth Stok Kritis" value={ringkasan.kritisAtauHabis} caption="Lihat Detail →" warna="amber" />
            </button>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap text-xs font-semibold text-slate-500 dark:text-fg-muted">
              {FILTER_OPTIONS.filter((o) => o.value !== "semua").map((o) => (
                <span key={o.value} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${KATEGORI_STYLE[o.value as KategoriKartu].dot}`} />
                  {o.label}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <div className="w-56">
                <Input
                  sizeVariant="sm"
                  placeholder="Cari booth atau petugas..."
                  leftIcon={<Search className="w-4 h-4" />}
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                />
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFilterOpen((v) => !v)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center border cursor-pointer ${
                    filter !== "semua"
                      ? "bg-brand-700 border-brand-700 text-white"
                      : "bg-white dark:bg-surface border-slate-200/90 dark:border-line text-slate-600 dark:text-fg-secondary hover:bg-slate-50 dark:hover:bg-surface-hover"
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
                {filterOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200/90 dark:border-line bg-white dark:bg-surface shadow-lg z-20 p-1.5">
                    {FILTER_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => {
                          setFilter(o.value);
                          setFilterOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                          filter === o.value
                            ? "bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400"
                            : "text-slate-600 dark:text-fg-secondary hover:bg-slate-50 dark:hover:bg-surface-hover"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 items-start">
            {tab === "card" ? (
              filtered.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-fg-muted py-12 text-center w-full">Tidak ada Booth yang cocok.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 flex-1 min-w-0">
                  {filtered.map((booth) => (
                    <KartuBooth
                      key={booth.boothId}
                      booth={booth}
                      dipilih={booth.boothId === selectedId}
                      onClick={() => setSelectedId(booth.boothId === selectedId ? null : booth.boothId)}
                    />
                  ))}
                </div>
              )
            ) : (
              <BoothMapView
                booths={filtered}
                selectedId={selectedId}
                onSelect={(boothId) => setSelectedId(boothId === selectedId ? null : boothId)}
              />
            )}

            {selected && <PanelDetail booth={selected} now={now} onClose={() => setSelectedId(null)} />}
          </div>
        </>
      )}
    </div>
  );
}

export default function BoothAktifPage() {
  return (
    <RequireAuth>
      <BoothAktifContent />
    </RequireAuth>
  );
}
