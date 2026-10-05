"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, ImageOff, PackageX, Plus, Undo2 } from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { QuantityStepperInline } from "@/components/warehouse/QuantityStepperInline";
import { api, ApiError, type Product, type StockAdjustmentRecord, type WarehouseStockItem } from "@/lib/api-client";
import { useAccess } from "@/lib/auth-context";
import { randomUUID } from "@/lib/uuid";

const waktuJakarta = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    .format(new Date(iso))
    .replace(":", ".");

/// Pemusnahan Stok Gudang (BR-041): produk expired / tidak layak jual dikeluarkan
/// dari Gudang Pusat dengan foto bukti wajib. Tercatat sebagai dokumen
/// penyesuaian stok (alasan EXPIRED) + Mutasi Stok; salah input dibatalkan lewat
/// reverse, bukan dihapus.
function PemusnahanContent() {
  const toast = useToast();
  const { canManage } = useAccess();
  const [records, setRecords] = useState<StockAdjustmentRecord[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [gudang, setGudang] = useState<WarehouseStockItem[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [catatan, setCatatan] = useState("");
  const [saving, setSaving] = useState(false);
  // Satu key per isian form: kalau respons hilang lalu Simpan ditekan lagi,
  // backend mengenali key yang sama dan tidak memusnahkan dua kali.
  const [formKey, setFormKey] = useState(() => randomUUID());

  const [batalTarget, setBatalTarget] = useState<StockAdjustmentRecord | null>(null);
  const [alasanBatal, setAlasanBatal] = useState("");
  const [membatalkan, setMembatalkan] = useState(false);
  const [fotoTampil, setFotoTampil] = useState<string | null>(null);

  async function muat() {
    try {
      const [semua, stok] = await Promise.all([api.getStockAdjustments(), api.getWarehouseStock()]);
      setRecords(semua);
      setGudang(stok);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Pemusnahan Stok.");
    }
  }

  useEffect(() => {
    muat();
    api.getProducts().then(setProducts).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pemusnahan = useMemo(
    () => (records ?? []).filter((r) => r.correctionType === "ADJUSTMENT" && r.reasonCode === "EXPIRED"),
    [records],
  );
  const dibatalkan = useMemo(
    () => new Set((records ?? []).filter((r) => r.correctionType === "VOID").map((r) => r.entityId)),
    [records],
  );
  const pratinjauFoto = useMemo(() => (foto ? URL.createObjectURL(foto) : null), [foto]);
  useEffect(() => () => {
    if (pratinjauFoto) URL.revokeObjectURL(pratinjauFoto);
  }, [pratinjauFoto]);
  const namaProduk = (id: string) => products.find((p) => p.id === id)?.name ?? gudang.find((g) => g.productId === id)?.name ?? "-";
  const stokTersedia = gudang.find((g) => g.productId === productId)?.qtyOnHand ?? 0;
  const totalCup = pemusnahan.filter((r) => !dibatalkan.has(r.entityId)).reduce((s, r) => s - r.impactSnapshot.delta, 0);

  function bukaForm() {
    setProductId("");
    setQty(1);
    setFoto(null);
    setFotoUrl(null);
    setCatatan("");
    setFormKey(randomUUID());
    setFormOpen(true);
  }

  async function simpan() {
    if (!productId || !foto || qty < 1 || qty > stokTersedia) return;
    setSaving(true);
    try {
      const photoUrl = fotoUrl ?? (await api.uploadWriteOffPhoto(foto)).photoUrl;
      setFotoUrl(photoUrl);
      await api.writeOffStock({ idempotencyKey: formKey, productId, qty, photoUrl, reasonNote: catatan.trim() || undefined });
      toast.success(`${qty} cup ${namaProduk(productId)} dimusnahkan dari Gudang.`);
      setFormOpen(false);
      await muat();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan Pemusnahan Stok.");
    } finally {
      setSaving(false);
    }
  }

  async function batalkan() {
    if (!batalTarget || !alasanBatal.trim()) return;
    setMembatalkan(true);
    try {
      await api.reverseStockAdjustment(batalTarget.entityId, {
        idempotencyKey: randomUUID(),
        reasonCode: "DATA_ENTRY_ERROR",
        reasonNote: alasanBatal.trim(),
      });
      toast.success("Pemusnahan dibatalkan, stok Gudang dikembalikan.");
      setBatalTarget(null);
      await muat();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal membatalkan Pemusnahan.");
    } finally {
      setMembatalkan(false);
    }
  }

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Transaksi" }, { label: "Pemusnahan Stok" }]} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 border border-red-100 dark:border-red-500/20 shadow-2xs">
            <PackageX className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight">Pemusnahan Stok</h1>
            <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
              Produk expired / tidak layak jual dikeluarkan dari Gudang Pusat. Foto bukti wajib &amp; tercatat di Mutasi Stok.
            </p>
          </div>
        </div>
        {canManage("PEMUSNAHAN_STOK") && (
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={bukaForm}>
            Musnahkan Stok
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Total Dokumen</p>
          <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{pemusnahan.length}</p>
          <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">termasuk yang dibatalkan</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Total Dimusnahkan</p>
          <p className="text-lg sm:text-xl font-bold text-red-600 dark:text-red-400 tracking-tight leading-tight mt-0.5">{totalCup} cup</p>
          <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">tanpa yang dibatalkan</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
        {!records ? (
          <div className="flex justify-center py-14">
            <Spinner />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line">
            <table className="w-full text-xs text-left">
              <thead className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                <tr>
                  <th className="py-3.5 px-3">Waktu</th>
                  <th className="py-3.5 px-3">Produk</th>
                  <th className="py-3.5 px-3 text-right">Qty</th>
                  <th className="py-3.5 px-3 text-right">Stok Gudang</th>
                  <th className="py-3.5 px-3">Catatan</th>
                  <th className="py-3.5 px-3 text-center">Foto</th>
                  <th className="py-3.5 px-3">Oleh</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                {pemusnahan.map((r) => {
                  const batal = dibatalkan.has(r.entityId);
                  return (
                    <tr key={r.id} className={batal ? "opacity-60" : undefined}>
                      <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary whitespace-nowrap">{waktuJakarta(r.createdAt)}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-fg">{namaProduk(r.impactSnapshot.productId)}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-bold text-red-600 dark:text-red-400">{r.impactSnapshot.delta} cup</td>
                      <td className="py-3 px-3 text-right tabular-nums text-slate-600 dark:text-fg-secondary whitespace-nowrap">
                        {r.impactSnapshot.before} → {r.impactSnapshot.after}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-fg-muted">{r.reasonNote || "—"}</td>
                      <td className="py-3 px-3">
                        <div className="flex justify-center">
                          {r.evidencePhotoUrl ? (
                            <button
                              type="button"
                              onClick={() => setFotoTampil(r.evidencePhotoUrl)}
                              title="Lihat foto bukti"
                              className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-line cursor-pointer"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={r.evidencePhotoUrl} alt="Foto bukti" className="w-full h-full object-cover" />
                            </button>
                          ) : (
                            <ImageOff className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary">{r.createdBy.fullName}</td>
                      <td className="py-3 px-3">
                        <div className="flex justify-center">
                          {batal ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-muted border-slate-200 dark:border-line">
                              Dibatalkan
                            </span>
                          ) : !canManage("PEMUSNAHAN_STOK") ? (
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-fg-muted">Berlaku</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setAlasanBatal("");
                                setBatalTarget(r);
                              }}
                              title="Batalkan pemusnahan yang salah input — stok Gudang dikembalikan"
                              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200/90 dark:border-line bg-white/80 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover text-slate-600 dark:text-fg-muted text-[11px] font-semibold shadow-2xs cursor-pointer transition-colors"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                              <span>Batalkan</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pemusnahan.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-slate-500 dark:text-fg-muted py-10">
                      Belum ada Pemusnahan Stok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="Musnahkan Stok Gudang" size="md">
        <div className="space-y-4">
          <Select
            label="Produk"
            placeholder="Pilih Produk"
            options={gudang.map((g) => ({ value: g.productId, label: `${g.name} — stok ${g.qtyOnHand} cup` }))}
            value={productId}
            onChange={(v) => {
              setProductId(v);
              setQty(1);
            }}
          />
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-fg mb-2">Qty Dimusnahkan (cup)</p>
            <QuantityStepperInline value={qty} min={1} onChange={(n) => setQty(Math.min(Math.max(n, 1), Math.max(stokTersedia, 1)))} />
            {productId && (
              <p className={`text-xs mt-1.5 ${stokTersedia === 0 ? "text-red-600 dark:text-red-400 font-semibold" : "text-slate-500 dark:text-fg-muted"}`}>
                {stokTersedia === 0 ? "Stok Gudang produk ini kosong." : `Stok Gudang: ${stokTersedia} cup, setelah dimusnahkan ${stokTersedia - qty} cup.`}
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-fg mb-2">Foto Bukti (wajib)</p>
            <label className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 dark:border-line p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-surface-hover">
              {pratinjauFoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pratinjauFoto} alt="Pratinjau foto bukti" className="w-16 h-16 rounded-lg object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-surface-hover flex items-center justify-center">
                  <Camera className="w-5 h-5 text-slate-400" />
                </div>
              )}
              <div className="text-xs text-slate-500 dark:text-fg-muted">
                <p className="font-semibold text-slate-700 dark:text-fg">{foto ? "Ganti foto" : "Pilih / ambil foto"}</p>
                <p>Foto produk yang dimusnahkan (label expired terlihat). JPG, PNG, WEBP, maks 5 MB.</p>
              </div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setFoto(file);
                  setFotoUrl(null);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          <Textarea label="Catatan (opsional)" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Mis. expired 3 Okt 2026, batch kiriman supplier X" />

          <Button
            type="button"
            fullWidth
            isLoading={saving}
            onClick={simpan}
            disabled={!productId || !foto || qty < 1 || qty > stokTersedia}
          >
            Musnahkan {qty} cup
          </Button>
        </div>
      </Modal>

      <Modal isOpen={!!batalTarget} onClose={() => setBatalTarget(null)} title="Batalkan Pemusnahan?" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-fg-secondary">
            {batalTarget && `${-batalTarget.impactSnapshot.delta} cup ${namaProduk(batalTarget.impactSnapshot.productId)} dikembalikan ke stok Gudang. Dokumen aslinya tetap tercatat.`}
          </p>
          <Textarea label="Alasan pembatalan (wajib)" value={alasanBatal} onChange={(e) => setAlasanBatal(e.target.value)} placeholder="Mis. salah pilih produk" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setBatalTarget(null)}>
              Kembali
            </Button>
            <Button variant="danger" size="sm" isLoading={membatalkan} disabled={!alasanBatal.trim()} onClick={batalkan}>
              Batalkan Pemusnahan
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!fotoTampil} onClose={() => setFotoTampil(null)} title="Foto Bukti Pemusnahan" size="lg">
        {fotoTampil && (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoTampil} alt="Foto bukti pemusnahan" className="w-full max-h-[70vh] object-contain rounded-lg" />
            <a href={fotoTampil} target="_blank" rel="noreferrer" className="text-xs font-semibold text-(--brand-700) hover:underline">
              Buka ukuran asli di tab baru
            </a>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function PemusnahanStokPage() {
  return (
    <RequireAuth>
      <PemusnahanContent />
    </RequireAuth>
  );
}
