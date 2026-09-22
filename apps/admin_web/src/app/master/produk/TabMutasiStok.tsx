"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
  ListTree,
  PackageCheck,
  Table2,
  Warehouse,
} from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import {
  api,
  ApiError,
  type Booth,
  type Product,
  type RekapStokResponse,
  type RinciMutasiResponse,
} from "@/lib/api-client";
import { BULAN, PeriodeFilter, periodeBerjalanJakarta } from "./PeriodeFilter";

type SubTab = "rekap" | "rinci";

/// Nama kategori dipakai sebagai kunci pengelompokan baris Rekap — produk yang
/// belum dikategorikan sengaja diberi label eksplisit, bukan dibiarkan kosong,
/// supaya tetap kebagian header kelompoknya sendiri (selalu di paling akhir).
const TANPA_KATEGORI = "Tanpa Kategori";

// Header tabel & pembungkusnya disamakan dengan tab Main (lihat TabMain.tsx)
// supaya kedua tab dalam satu halaman Produk terasa satu sistem, bukan dua
// gaya berbeda yang ditempel.
const KELAS_WRAPPER_TABEL = "overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line";
const KELAS_HEADER_TABEL =
  "bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line";

function angka(n: number) {
  return n.toLocaleString("id-ID");
}

function tanggalJakarta(iso: string) {
  // businessDate dikirim sebagai tanggal polos UTC; dibaca dengan getter UTC
  // supaya tidak bergeser sehari oleh zona waktu perangkat.
  const d = new Date(iso);
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
}

/// Peringatan untuk baris yang arah mutasinya tidak bisa dipastikan dari ledger
/// lama. Ditampilkan apa adanya, bukan disembunyikan — angka yang mungkin
/// terbalik lebih berbahaya kalau disajikan seolah pasti.
function PeringatanVerifikasi() {
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-900/15 p-3.5 flex items-start gap-2.5">
      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
        <p className="font-bold">Sebagian angka perlu diverifikasi</p>
        <p className="mt-0.5">
          Ada mutasi lama yang arahnya tidak tercatat, sehingga ditebak sebagai
          penambahan. Mutasi baru sudah mencatat arahnya sendiri, jadi ini hanya
          menyangkut data sebelum perbaikan.
        </p>
      </div>
    </div>
  );
}

function KartuAngka({
  label,
  nilai,
  warna,
  icon: Icon,
}: {
  label: string;
  nilai: number;
  warna: "brand" | "hijau" | "jingga" | "abu";
  icon: typeof Layers;
}) {
  const skin = {
    brand: "bg-brand-50 dark:bg-brand-900/20 text-[var(--brand-700)] dark:text-brand-400 border-brand-100 dark:border-brand-900/30",
    hijau:
      "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border-brand-100 dark:border-brand-900/30",
    jingga:
      "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30",
    abu: "bg-slate-100 dark:bg-surface-hover text-slate-500 dark:text-fg-muted border-slate-200 dark:border-line",
  }[warna];

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${skin}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">{label}</p>
        <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5 tabular-nums">
          {angka(nilai)}
        </p>
        <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">cup</p>
      </div>
    </div>
  );
}

export function TabMutasiStok({ products, booths }: { products: Product[]; booths: Booth[] }) {
  const toast = useToast();
  const [sub, setSub] = useState<SubTab>("rekap");
  const [periode, setPeriode] = useState(periodeBerjalanJakarta());
  const [lokasi, setLokasi] = useState("WAREHOUSE");

  const [rekap, setRekap] = useState<RekapStokResponse | null>(null);
  const [memuatRekap, setMemuatRekap] = useState(false);

  const [productId, setProductId] = useState("");
  const [rinci, setRinci] = useState<RinciMutasiResponse | null>(null);
  const [memuatRinci, setMemuatRinci] = useState(false);

  const opsiLokasi = useMemo(
    () => [
      { value: "WAREHOUSE", label: "Gudang Pusat" },
      ...booths.map((b) => ({ value: b.id, label: `Booth ${b.name}` })),
    ],
    [booths],
  );

  const muatRekap = useCallback(async () => {
    setMemuatRekap(true);
    try {
      setRekap(await api.getStockRekap({ ...periode, lokasi }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat rekap stok.");
      setRekap(null);
    } finally {
      setMemuatRekap(false);
    }
    // toast identitasnya berubah tiap render provider; sengaja tidak dijadikan
    // dependensi supaya tidak memicu pemuatan ulang tanpa henti.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode, lokasi]);

  const muatRinci = useCallback(async () => {
    if (!productId) {
      setRinci(null);
      return;
    }
    setMemuatRinci(true);
    try {
      setRinci(await api.getStockRinci({ productId, ...periode, lokasi }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat rincian mutasi.");
      setRinci(null);
    } finally {
      setMemuatRinci(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, periode, lokasi]);

  useEffect(() => {
    if (sub === "rekap") muatRekap();
  }, [sub, muatRekap]);

  useEffect(() => {
    if (sub === "rinci") muatRinci();
  }, [sub, muatRinci]);

  const namaLokasi = opsiLokasi.find((o) => o.value === lokasi)?.label ?? lokasi;

  const opsiProduk = useMemo(() => products.map((p) => ({ value: p.id, label: p.name })), [products]);

  const kategoriProduk = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) map.set(p.id, p.category ?? TANPA_KATEGORI);
    return map;
  }, [products]);

  // Rekap dikelompokkan per kategori (abjad), lalu per nama produk (abjad) di
  // dalam tiap kelompok — "Tanpa Kategori" selalu diletakkan paling akhir
  // supaya produk yang belum dikategorikan tidak menyelip di tengah daftar.
  const rekapTersusun = useMemo(() => {
    if (!rekap) return [];
    const rows = [...rekap.rows];
    rows.sort((a, b) => {
      const ka = kategoriProduk.get(a.productId) ?? TANPA_KATEGORI;
      const kb = kategoriProduk.get(b.productId) ?? TANPA_KATEGORI;
      if (ka !== kb) {
        if (ka === TANPA_KATEGORI) return 1;
        if (kb === TANPA_KATEGORI) return -1;
        return ka.localeCompare(kb, "id");
      }
      return a.name.localeCompare(b.name, "id");
    });
    return rows;
  }, [rekap, kategoriProduk]);

  const SUB: { key: SubTab; label: string; icon: typeof Table2 }[] = [
    { key: "rekap", label: "Rekap", icon: Table2 },
    { key: "rinci", label: "Rinci", icon: ListTree },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {SUB.map(({ key, label, icon: Icon }) => {
          const aktif = sub === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSub(key)}
              className={`flex items-center gap-2 px-3.5 h-8 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border ${
                aktif
                  ? "bg-slate-800 dark:bg-fg/10 text-white dark:text-fg border-slate-800 dark:border-line"
                  : "bg-white/90 dark:bg-surface text-slate-600 dark:text-fg-secondary border-slate-200/90 dark:border-line hover:bg-slate-50 dark:hover:bg-surface-hover"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Rekap ───────────────────────────────────────────────────────── */}
      {sub === "rekap" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
            <PeriodeFilter bulan={periode.bulan} tahun={periode.tahun} onChange={setPeriode}>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-fg-muted ml-1">
                <Warehouse className="w-3.5 h-3.5" />
                Lokasi
              </span>
              <div className="w-44">
                <Select options={opsiLokasi} value={lokasi} onChange={setLokasi} sizeVariant="sm" />
              </div>
            </PeriodeFilter>
          </div>

          {rekap?.total.perluVerifikasi && <PeringatanVerifikasi />}

          <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs overflow-hidden">
            {memuatRekap ? (
              <div className="flex justify-center py-14">
                <Spinner />
              </div>
            ) : (
              <div className={KELAS_WRAPPER_TABEL}>
                <table className="w-full text-xs sm:text-sm">
                  <thead className={KELAS_HEADER_TABEL}>
                    <tr>
                      <th className="py-3.5 px-3 text-center w-10">No.</th>
                      <th className="py-3.5 px-3 text-left">Nama Stok</th>
                      <th className="py-3.5 px-3 text-left">Kategori</th>
                      <th className="py-3.5 px-3 text-center">Saldo Awal</th>
                      <th className="py-3.5 px-3 text-center">Masuk</th>
                      <th className="py-3.5 px-3 text-center">Keluar</th>
                      <th className="py-3.5 px-3 text-center">Saldo Akhir</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                    {(() => {
                      let kategoriSebelumnya: string | null = null;
                      return rekapTersusun.map((r, i) => {
                        const kategori = kategoriProduk.get(r.productId) ?? TANPA_KATEGORI;
                        const kelompokBaru = kategori !== kategoriSebelumnya;
                        kategoriSebelumnya = kategori;
                        return (
                          <Fragment key={r.productId}>
                            {kelompokBaru && (
                              <tr className="bg-slate-50/70 dark:bg-surface-hover/40">
                                <td
                                  colSpan={7}
                                  className="py-2 px-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-fg-muted"
                                >
                                  {kategori}
                                </td>
                              </tr>
                            )}
                            <tr
                              className="hover:bg-brand-50/20 dark:hover:bg-surface-hover/40 transition-colors cursor-pointer"
                              onClick={() => {
                                setProductId(r.productId);
                                setSub("rinci");
                              }}
                              title="Lihat rinciannya"
                            >
                              <td className="py-3 px-3 text-center text-slate-500 dark:text-fg-muted">{i + 1}</td>
                              <td className="py-3 px-3">
                                <span className="font-semibold text-slate-800 dark:text-fg">{r.name}</span>
                                <span className="ml-2 font-mono text-[10px] text-slate-400 dark:text-fg-muted">
                                  {r.sku}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-600 dark:text-fg-muted">{kategori}</td>
                              <td className="py-3 px-3 text-center tabular-nums text-slate-600 dark:text-fg-secondary">
                                {angka(r.saldoAwal)}
                              </td>
                              <td className="py-3 px-3 text-center tabular-nums font-semibold text-brand-600 dark:text-brand-400">
                                {r.masuk === 0 ? "—" : `+${angka(r.masuk)}`}
                              </td>
                              <td className="py-3 px-3 text-center tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                                {r.keluar === 0 ? "—" : `−${angka(r.keluar)}`}
                              </td>
                              <td className="py-3 px-3 text-center tabular-nums font-bold text-slate-900 dark:text-fg">
                                {angka(r.saldoAkhir)}
                              </td>
                            </tr>
                          </Fragment>
                        );
                      });
                    })()}

                    {rekap && rekap.rows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center text-slate-500 dark:text-fg-muted py-10 text-xs">
                          Belum ada produk aktif.
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {rekap && rekap.rows.length > 0 && (
                    <tfoot className="bg-slate-50/80 dark:bg-surface-hover border-t-2 border-slate-200 dark:border-line">
                      <tr className="text-[11px] font-bold text-slate-700 dark:text-fg-secondary">
                        <td colSpan={3} className="py-3 px-3 uppercase tracking-wide">
                          Total · {namaLokasi} · {BULAN[periode.bulan - 1]} {periode.tahun}
                        </td>
                        <td className="py-3 px-3 text-center tabular-nums">{angka(rekap.total.saldoAwal)}</td>
                        <td className="py-3 px-3 text-center tabular-nums text-brand-600 dark:text-brand-400">
                          +{angka(rekap.total.masuk)}
                        </td>
                        <td className="py-3 px-3 text-center tabular-nums text-amber-600 dark:text-amber-400">
                          −{angka(rekap.total.keluar)}
                        </td>
                        <td className="py-3 px-3 text-center tabular-nums text-slate-900 dark:text-fg">
                          {angka(rekap.total.saldoAkhir)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Rinci ───────────────────────────────────────────────────────── */}
      {sub === "rinci" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
            <PeriodeFilter bulan={periode.bulan} tahun={periode.tahun} onChange={setPeriode}>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-fg-muted ml-1">
                <Warehouse className="w-3.5 h-3.5" />
                Lokasi
              </span>
              <div className="w-44">
                <Select options={opsiLokasi} value={lokasi} onChange={setLokasi} sizeVariant="sm" />
              </div>

              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-fg-muted ml-1">
                <PackageCheck className="w-3.5 h-3.5" />
                Produk
              </span>
              <div className="w-56">
                <Select
                  options={opsiProduk}
                  value={productId}
                  onChange={setProductId}
                  placeholder="Pilih produk…"
                  sizeVariant="sm"
                />
              </div>
            </PeriodeFilter>
          </div>

          {!productId ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-line bg-white/60 dark:bg-surface p-12 text-center">
              <ListTree className="w-7 h-7 text-slate-300 dark:text-fg-muted mx-auto" />
              <p className="mt-2.5 text-xs font-semibold text-slate-500 dark:text-fg-muted">
                Pilih produk untuk melihat rincian mutasinya
              </p>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-fg-muted">
                Bisa juga dengan mengklik salah satu baris di tab Rekap.
              </p>
            </div>
          ) : memuatRinci ? (
            <div className="flex justify-center py-14">
              <Spinner />
            </div>
          ) : rinci ? (
            <div className="space-y-4">
              {rinci.perluVerifikasi && <PeringatanVerifikasi />}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <KartuAngka label="Stok Awal" nilai={rinci.ringkasan.saldoAwal} warna="abu" icon={Layers} />
                <KartuAngka label="Masuk" nilai={rinci.ringkasan.masuk} warna="hijau" icon={ArrowDownLeft} />
                <KartuAngka label="Keluar" nilai={rinci.ringkasan.keluar} warna="jingga" icon={ArrowUpRight} />
                <KartuAngka label="Stok Akhir" nilai={rinci.ringkasan.saldoAkhir} warna="brand" icon={PackageCheck} />
              </div>

              <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-line flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-fg">
                      {rinci.product.name}
                      <span className="ml-2 font-mono text-[10px] font-normal text-slate-400 dark:text-fg-muted">
                        {rinci.product.sku}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">
                      {namaLokasi} · {BULAN[periode.bulan - 1]} {periode.tahun}
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-fg-muted tabular-nums">
                    {rinci.rows.length} mutasi
                  </span>
                </div>

                <div className={KELAS_WRAPPER_TABEL}>
                  <table className="w-full text-xs sm:text-sm">
                    <thead className={KELAS_HEADER_TABEL}>
                      <tr>
                        <th className="py-3.5 px-3 text-left w-28">Tanggal</th>
                        <th className="py-3.5 px-3 text-left">Keterangan</th>
                        <th className="py-3.5 px-3 text-center w-24">Masuk/Keluar</th>
                        <th className="py-3.5 px-3 text-center w-20">Qty</th>
                        <th className="py-3.5 px-3 text-center w-28">Saldo Akhir</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                      <tr className="bg-slate-50/50 dark:bg-surface-hover/40">
                        <td colSpan={4} className="py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-fg-muted">
                          Saldo Awal
                        </td>
                        <td className="py-2.5 px-3 text-center tabular-nums font-bold text-slate-700 dark:text-fg-secondary">
                          {angka(rinci.ringkasan.saldoAwal)}
                        </td>
                      </tr>

                      {rinci.rows.map((r) => (
                        <tr
                          key={r.id}
                          className="hover:bg-brand-50/20 dark:hover:bg-surface-hover/40 transition-colors"
                        >
                          <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary whitespace-nowrap">
                            {tanggalJakarta(r.tanggal)}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-medium text-slate-800 dark:text-fg">{r.keterangan}</span>
                            <span className="ml-2 font-mono text-[10px] text-slate-400 dark:text-fg-muted">
                              {r.movementNo}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                r.arah === "MASUK"
                                  ? "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 border-brand-200 dark:border-brand-900/40"
                                  : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40"
                              }`}
                            >
                              {r.arah === "MASUK" ? (
                                <ArrowDownLeft className="w-3 h-3" />
                              ) : (
                                <ArrowUpRight className="w-3 h-3" />
                              )}
                              {r.arah === "MASUK" ? "Masuk" : "Keluar"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center tabular-nums font-semibold text-slate-800 dark:text-fg">
                            {angka(r.qty)}
                          </td>
                          <td className="py-3 px-3 text-center tabular-nums font-bold text-slate-900 dark:text-fg">
                            {angka(r.saldo)}
                          </td>
                        </tr>
                      ))}

                      {rinci.rows.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center text-slate-500 dark:text-fg-muted py-10 text-xs">
                            Tidak ada mutasi pada periode ini.
                          </td>
                        </tr>
                      )}
                    </tbody>

                    <tfoot className="bg-slate-50/80 dark:bg-surface-hover border-t-2 border-slate-200 dark:border-line">
                      <tr className="text-[11px] font-bold text-slate-700 dark:text-fg-secondary">
                        <td colSpan={2} className="py-3 px-3 uppercase tracking-wide">
                          Saldo Akhir
                        </td>
                        <td className="py-3 px-3 text-center text-brand-600 dark:text-brand-400 tabular-nums">
                          +{angka(rinci.ringkasan.masuk)}
                        </td>
                        <td className="py-3 px-3 text-center text-amber-600 dark:text-amber-400 tabular-nums">
                          −{angka(rinci.ringkasan.keluar)}
                        </td>
                        <td className="py-3 px-3 text-center tabular-nums text-slate-900 dark:text-fg">
                          {angka(rinci.ringkasan.saldoAkhir)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
