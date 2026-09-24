"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CheckCircle2,
  Search,
  Coffee,
  ChevronLeft,
  FileText,
  Printer,
  MessageCircle,
  X,
} from "lucide-react";
import {
  api,
  ApiError,
  type Product,
  type BoothStockRow,
  type ActiveShift,
  type DraftSale,
  type SaleResult,
} from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { useHidePetugasNav } from "@/components/layout/PetugasShell";
import { TopBar } from "../_components/TopBar";
import { formatRupiah, formatJamJakarta } from "../_lib/format";

import { OBBEL, OBBEL_SCALE } from "../_lib/theme";
const GREEN = OBBEL.primaryDark;

interface CartLine {
  product: Product;
  qty: number;
}

type Sheet = null | "cart" | "payment" | "drafts";
type MetodeBayar = "CASH" | "QRIS" | "SPLIT";

/// Input nominal Rupiah dgn pemisah ribuan otomatis saat mengetik (mis.
/// "85.000") — `type="text"` bukan `type="number"` karena `<input
/// type="number">` tidak bisa menampilkan titik pemisah ribuan sama sekali.
function RibuanInput({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value > 0 ? value.toLocaleString("id-ID") : ""}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        onChange(digits === "" ? 0 : Number(digits));
      }}
      className={className}
      placeholder={placeholder}
    />
  );
}

/// Nominal cepat: kelipatan Rp5.000 di atas total (mirip mockup Rp20rb/50rb/
/// 100rb) — dibulatkan sesuai besar transaksinya sendiri, bukan angka tetap,
/// supaya tetap masuk akal untuk transaksi besar.
function nominalCepat(total: number): number[] {
  const bulat = (n: number) => Math.ceil(n / 5000) * 5000;
  const a = bulat(total);
  const b = bulat(total * 1.5);
  const c = bulat(total * 2);
  return Array.from(new Set([a, b, c].filter((n) => n > 0)));
}

function KasirContent() {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState<ActiveShift | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockByProduct, setStockByProduct] = useState<Map<string, number>>(new Map());
  const [cart, setCart] = useState<Map<string, CartLine>>(new Map());
  const [sheet, setSheet] = useState<Sheet>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Semua");

  const [discountInput, setDiscountInput] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<MetodeBayar>("CASH");
  const [nominalTunai, setNominalTunai] = useState<number>(0);
  const [splitTunai, setSplitTunai] = useState<number>(0);
  const [splitQris, setSplitQris] = useState<number>(0);

  const [drafts, setDrafts] = useState<DraftSale[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SaleResult | null>(null);
  const [qtyTerjual7Hari, setQtyTerjual7Hari] = useState<Map<string, number>>(new Map());
  const [qrisImageUrl, setQrisImageUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [active, productList, stockRows, terlaris, booths] = await Promise.all([
          api.getActiveShift(),
          api.getProducts(),
          api.getMyBoothStock(),
          api.getTerlarisMine().catch(() => []),
          api.getBooths().catch(() => []),
        ]);
        setShift(active);
        // Produk nonaktif TETAP ditampilkan (bisa masih ada di keranjang
        // draft lama), cuma digeser ke bawah + tidak bisa ditambah baru —
        // lihat pengurutan & disabled state di grid.
        setProducts(productList);
        setStockByProduct(new Map(stockRows.map((s: BoothStockRow) => [s.productId, s.qtyOnHand])));
        setQtyTerjual7Hari(new Map(terlaris.map((t) => [t.productId, t.qty])));
        setQrisImageUrl(booths.find((b) => b.id === active.booth.id)?.qrisImageUrl ?? null);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Kasir.");
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, []);

  async function loadDrafts() {
    setLoadingDrafts(true);
    try {
      setDrafts(await api.getMyDrafts());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat draft.");
    } finally {
      setLoadingDrafts(false);
    }
  }

  useEffect(() => {
    loadDrafts();
  }, []);

  const lines = useMemo(() => Array.from(cart.values()), [cart]);
  const subtotal = lines.reduce((sum, l) => sum + l.product.sellPrice * l.qty, 0);
  const totalItems = lines.reduce((sum, l) => sum + l.qty, 0);
  const discount = Math.max(0, Math.min(subtotal, discountInput));
  const total = subtotal - discount;

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter((c): c is string => !!c));
    return ["Semua", ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchCategory = activeCategory === "Semua" || p.category === activeCategory;
        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
        return matchCategory && matchSearch;
      })
      .sort((a, b) => {
        // 3 tingkat: (0) aktif & stok ada — diurut terlaris, (1) aktif tapi
        // stok kosong — nggak bisa dibeli sekarang jadi digeser turun
        // meski dulu laris, (2) nonaktif — selalu paling bawah.
        const tingkat = (p: Product) => (!p.active ? 2 : (stockByProduct.get(p.id) ?? 0) <= 0 ? 1 : 0);
        const tingkatA = tingkat(a);
        const tingkatB = tingkat(b);
        if (tingkatA !== tingkatB) return tingkatA - tingkatB;
        if (tingkatA === 0) {
          const qtyA = qtyTerjual7Hari.get(a.id) ?? 0;
          const qtyB = qtyTerjual7Hari.get(b.id) ?? 0;
          if (qtyA !== qtyB) return qtyB - qtyA;
        }
        return a.name.localeCompare(b.name);
      });
  }, [products, activeCategory, search, qtyTerjual7Hari, stockByProduct]);

  // Sheet keranjang/pembayaran/draft sama-sama nempel di bawah —
  // sembunyikan bottom nav supaya tidak numpuk, sama kayak Detail Penerimaan.
  useHidePetugasNav(totalItems > 0 || sheet !== null);

  useEffect(() => {
    if (sheet !== "payment") return;
    setNominalTunai(total);
    setSplitTunai(Math.ceil(total / 2));
    setSplitQris(total - Math.ceil(total / 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  function addToCart(product: Product) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(product.id);
      const stock = stockByProduct.get(product.id) ?? 0;
      const nextQty = (existing?.qty ?? 0) + 1;
      if (nextQty > stock) {
        toast.warning(`Stok ${product.name} tinggal ${stock} cup.`);
        return prev;
      }
      next.set(product.id, { product, qty: nextQty });
      return next;
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) => {
      const next = new Map(prev);
      const line = next.get(productId);
      if (!line) return prev;
      const stock = stockByProduct.get(productId) ?? 0;
      const nextQty = line.qty + delta;
      if (nextQty <= 0) {
        next.delete(productId);
      } else if (nextQty > stock) {
        toast.warning(`Stok ${line.product.name} tinggal ${stock} cup.`);
        return prev;
      } else {
        next.set(productId, { ...line, qty: nextQty });
      }
      return next;
    });
  }

  function resetTransaksi() {
    setCart(new Map());
    setDiscountInput(0);
    setPaymentMethod("CASH");
    setActiveDraftId(null);
    setSheet(null);
  }

  function openDraft(draft: DraftSale) {
    const nextCart = new Map<string, CartLine>();
    for (const item of draft.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;
      nextCart.set(item.productId, { product, qty: item.qty });
    }
    setCart(nextCart);
    setDiscountInput(draft.discount);
    setActiveDraftId(draft.id);
    setSheet("cart");
  }

  const kembalianAtauKurang = nominalTunai - total;
  const sisaSplit = total - splitTunai - splitQris;
  const bisaBayar =
    paymentMethod === "QRIS"
      ? true
      : paymentMethod === "CASH"
        ? nominalTunai >= total
        : splitTunai > 0 && splitQris > 0 && sisaSplit === 0;

  async function handleSimpanDraft() {
    if (!shift || lines.length === 0) return;
    setSubmitting(true);
    try {
      await api.createDraftSale({
        idempotencyKey: crypto.randomUUID(),
        shiftSessionId: shift.shiftSessionId,
        items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
        discount,
      });
      toast.success("Draft transaksi berhasil disimpan.");
      resetTransaksi();
      loadDrafts();
    } catch (err) {
      if (err instanceof ApiError && err.code === "SHIFT_NOT_OPEN") {
        toast.error("Shift Anda sudah tidak aktif. Silakan Check-In ulang.");
        router.replace("/petugas");
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan draft.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleHapusDraft(id: string) {
    try {
      await api.deleteDraftSale(id);
      toast.success("Draft dihapus.");
      loadDrafts();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menghapus draft.");
    }
  }

  async function handleBayar() {
    if (!shift || lines.length === 0 || !bisaBayar) return;
    setSubmitting(true);
    try {
      const payload =
        paymentMethod === "SPLIT"
          ? { payments: [{ method: "CASH" as const, amount: splitTunai }, { method: "QRIS" as const, amount: splitQris }] }
          : { paymentMethod };

      const sale = activeDraftId
        ? await api.payDraftSale(activeDraftId, payload)
        : await api.createSale({
            idempotencyKey: crypto.randomUUID(),
            shiftSessionId: shift.shiftSessionId,
            items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
            discount,
            ...payload,
          });

      setResult(sale);
      resetTransaksi();
      loadDrafts();
    } catch (err) {
      if (err instanceof ApiError && err.code === "SHIFT_NOT_OPEN") {
        toast.error("Shift Anda sudah tidak aktif. Silakan Check-In ulang.");
        router.replace("/petugas");
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Gagal memproses pembayaran.");
    } finally {
      setSubmitting(false);
    }
  }

  function receiptText(sale: SaleResult): string {
    const lines = [
      `*Obbel Coffee & Milk*`,
      `No. Invoice: ${sale.saleNo}`,
      `Booth: ${shift?.booth.name ?? "-"}`,
      `Waktu: ${sale.paidAt ? formatJamJakarta(sale.paidAt) : "-"}`,
      `--------------------------`,
      `Total: ${formatRupiah(sale.total)}`,
      `Metode: ${sale.paymentMethod === "SPLIT" ? "Split" : sale.paymentMethod === "CASH" ? "Tunai" : "QRIS"}`,
      `--------------------------`,
      `Terima kasih telah berbelanja di Obbel Coffee & Milk!`,
    ];
    return lines.join("\n");
  }

  function handleKirimWhatsapp() {
    if (!result) return;
    const url = `https://wa.me/?text=${encodeURIComponent(receiptText(result))}`;
    window.open(url, "_blank");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-[#F7F9F6] flex flex-col items-center justify-center px-6 text-center gap-3 py-10">
        <div className="print:hidden flex flex-col items-center gap-3 w-full">
          <CheckCircle2 size={64} style={{ color: GREEN }} />
          <p className="font-extrabold text-2xl text-slate-900">Transaksi Berhasil</p>
          <p className="text-base text-slate-500">Terima kasih telah melayani dengan sepenuh hati!</p>
        </div>

        {/* Nota cetak — HANYA terlihat di dialog print (window.print()),
            disembunyikan di layar normal supaya tidak dobel dgn kartu di
            bawah. Print browser tidak butuh backend/PDF generator. */}
        <div className="hidden print:block text-left w-full text-base">
          <p className="font-extrabold text-base">Obbel Coffee & Milk</p>
          <p>No. Invoice: {result.saleNo}</p>
          <p>Booth: {shift?.booth.name}</p>
          <p>Waktu: {result.paidAt ? formatJamJakarta(result.paidAt) : "-"}</p>
          <hr className="my-2" />
          <p>Total: {formatRupiah(result.total)}</p>
          <p>Metode: {result.paymentMethod === "SPLIT" ? "Split" : result.paymentMethod === "CASH" ? "Tunai" : "QRIS"}</p>
        </div>

        <div className="print:hidden w-full rounded-2xl bg-white border border-slate-200 p-4 mt-2 text-base text-left flex flex-col gap-1.5">
          <div className="flex justify-between">
            <span className="text-slate-400">No. Invoice</span>
            <span className="font-semibold">{result.saleNo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Booth</span>
            <span className="font-semibold">{shift?.booth.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Waktu Transaksi</span>
            <span className="font-semibold">{result.paidAt ? formatJamJakarta(result.paidAt) : "-"}</span>
          </div>
        </div>

        <div className="print:hidden w-full rounded-2xl bg-white border border-slate-200 p-4 text-base text-left flex flex-col gap-1.5">
          <p className="font-bold text-slate-800 mb-1">Detail Pembayaran</p>
          <div className="flex justify-between">
            <span className="text-slate-400">Subtotal</span>
            <span className="font-semibold">{formatRupiah(result.subtotal)}</span>
          </div>
          {result.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Diskon</span>
              <span className="font-semibold" style={{ color: OBBEL.accentRed }}>
                -{formatRupiah(result.discount)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-400">Total</span>
            <span className="font-bold" style={{ color: GREEN }}>{formatRupiah(result.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Metode Pembayaran</span>
            <span className="font-semibold">
              {result.paymentMethod === "SPLIT" ? "Split" : result.paymentMethod === "CASH" ? "Tunai" : "QRIS"}
            </span>
          </div>
          {result.payments.map((p, i) => (
            <div key={i} className="flex justify-between pl-3">
              <span className="text-slate-400">{p.method === "CASH" ? "· Tunai" : "· QRIS"}</span>
              <span className="font-medium">{formatRupiah(p.amount)}</span>
            </div>
          ))}
        </div>

        <div className="print:hidden grid grid-cols-2 gap-2 w-full mt-1">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 py-3 font-bold text-base"
            style={{ borderColor: GREEN, color: GREEN }}
          >
            <Printer size={16} /> Cetak Nota
          </button>
          <button
            type="button"
            onClick={handleKirimWhatsapp}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 py-3 font-bold text-base"
            style={{ borderColor: "#25D366", color: "#128C4A" }}
          >
            <MessageCircle size={16} /> Kirim WA
          </button>
        </div>

        <button
          type="button"
          onClick={() => setResult(null)}
          className="print:hidden w-full rounded-2xl py-4 font-extrabold text-white mt-1"
          style={{ backgroundColor: GREEN }}
        >
          Transaksi Baru
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9F6] pb-24">
      <TopBar title="Kasir" back="/petugas" />

      <div className="px-4 pt-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari menu..."
            className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-2.5.5 text-base outline-none focus:border-[#0B5D34]"
          />
        </div>
        <button
          type="button"
          onClick={() => setSheet("drafts")}
          className="relative shrink-0 w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center"
          title="Draft Tersimpan"
        >
          <FileText size={18} className="text-slate-600" />
          {drafts.length > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-white text-xs font-extrabold flex items-center justify-center"
              style={{ backgroundColor: OBBEL.accentOrange }}
            >
              {drafts.length}
            </span>
          )}
        </button>
      </div>

      <div className="px-4">
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-4 px-4">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              className="shrink-0 rounded-full px-3.5 py-2 text-sm font-bold"
              style={
                activeCategory === c
                  ? { backgroundColor: GREEN, color: "white" }
                  : { backgroundColor: "white", color: "#475569", border: "1px solid #E2E8F0" }
              }
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 gap-3">
        {filteredProducts.map((p) => {
          const stock = stockByProduct.get(p.id) ?? 0;
          const habis = p.active && stock <= 0;
          const bisaDitambah = p.active && stock > 0;
          return (
            <div
              key={p.id}
              className="rounded-2xl bg-white border border-slate-200 overflow-hidden relative"
              style={!p.active || habis ? { opacity: 0.55 } : undefined}
            >
              <div className="w-full aspect-square bg-slate-100 flex items-center justify-center overflow-hidden relative">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <Coffee size={32} className="text-slate-300" />
                )}
                {!p.active && (
                  <span className="absolute top-2 left-2 bg-slate-700 text-white text-[11px] font-extrabold rounded-full px-2.5 py-1">
                    Nonaktif
                  </span>
                )}
                {habis && (
                  <span
                    className="absolute top-2 left-2 text-white text-[11px] font-extrabold rounded-full px-2.5 py-1"
                    style={{ backgroundColor: OBBEL.accentRed }}
                  >
                    Stok Habis
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="font-bold text-base text-slate-900 truncate">{p.name}</p>
                <p className="text-sm text-slate-500 mt-0.5">Stok {stock} pack</p>
                <div className="flex items-end justify-between mt-1.5">
                  <p className="font-extrabold text-base" style={{ color: GREEN }}>
                    {formatRupiah(p.sellPrice)}
                  </p>
                  <button
                    type="button"
                    disabled={!bisaDitambah}
                    onClick={() => addToCart(p)}
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white disabled:opacity-30 shrink-0"
                    style={{ backgroundColor: GREEN }}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filteredProducts.length === 0 && (
          <p className="col-span-2 text-base text-slate-500 text-center py-10">Produk tidak ditemukan.</p>
        )}
      </div>

      {totalItems > 0 && sheet === null && (
        <div className="fixed bottom-4 inset-x-4 z-20">
          <div className="max-w-md mx-auto flex items-center justify-between bg-white rounded-2xl shadow-[0_12px_32px_-8px_rgba(11,93,52,0.3)] border border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm text-slate-500 font-semibold flex items-center gap-1.5">
                <ShoppingCart size={14} /> {totalItems} pack{activeDraftId ? " · Draft" : ""}
              </p>
              <p className="font-extrabold text-base text-slate-900">{formatRupiah(total)}</p>
            </div>
            <button
              type="button"
              onClick={() => setSheet("cart")}
              className="rounded-xl px-4 py-2.5.5 font-bold text-base text-white"
              style={{ backgroundColor: GREEN }}
            >
              Lihat Keranjang
            </button>
          </div>
        </div>
      )}

      {sheet === "drafts" && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end" onClick={() => setSheet(null)}>
          <div
            className="w-full max-w-md mx-auto bg-white rounded-t-[28px] max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <p className="font-extrabold text-slate-900">Draft Tersimpan</p>
              <button type="button" onClick={() => setSheet(null)} className="text-slate-400">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
              {loadingDrafts ? (
                <div className="flex justify-center py-10">
                  <Spinner />
                </div>
              ) : drafts.length === 0 ? (
                <p className="text-base text-slate-500 text-center py-10">Belum ada draft tersimpan.</p>
              ) : (
                drafts.map((d) => (
                  <div key={d.id} className="rounded-2xl border border-slate-200 p-3.5 flex items-center justify-between gap-3">
                    <button type="button" onClick={() => openDraft(d)} className="flex-1 text-left">
                      <p className="font-bold text-base text-slate-900">{d.saleNo}</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {d.items.reduce((sum, i) => sum + i.qty, 0)} pack · {formatRupiah(d.total)}
                      </p>
                    </button>
                    <button type="button" onClick={() => handleHapusDraft(d.id)} style={{ color: OBBEL.accentRed }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {sheet === "cart" && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end" onClick={() => setSheet(null)}>
          <div
            className="w-full max-w-md mx-auto bg-white rounded-t-[28px] max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <p className="font-extrabold text-slate-900">Keranjang Transaksi{activeDraftId ? " (Draft)" : ""}</p>
              <button type="button" onClick={() => setSheet(null)} className="text-slate-400 text-base">
                Tutup
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {lines.map((l) => (
                <div key={l.product.id} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                    {l.product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.product.imageUrl} alt={l.product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Coffee size={18} className="text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base text-slate-900 truncate">{l.product.name}</p>
                    <p className="text-sm text-slate-500">{formatRupiah(l.product.sellPrice)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => changeQty(l.product.id, -1)} className="w-10 h-10 rounded-full border flex items-center justify-center active:bg-slate-100">
                      <Minus size={18} />
                    </button>
                    <span className="w-6 text-center text-base font-semibold">{l.qty}</span>
                    <button type="button" onClick={() => changeQty(l.product.id, 1)} className="w-10 h-10 rounded-full border flex items-center justify-center active:bg-slate-100">
                      <Plus size={18} />
                    </button>
                    <button type="button" onClick={() => changeQty(l.product.id, -l.qty)} className="w-10 h-10 flex items-center justify-center ml-1" style={{ color: OBBEL.accentRed }}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-base text-slate-500">Subtotal ({totalItems} pack)</span>
                <span className="text-base font-semibold">{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between mb-3 gap-3">
                <span className="text-base text-slate-500 shrink-0">Diskon (Rp)</span>
                <RibuanInput
                  value={discountInput}
                  onChange={setDiscountInput}
                  className="w-28 rounded-lg border border-slate-200 px-2 py-2 text-base text-right"
                />
              </div>
              <div className="flex justify-between mb-3 pt-2 border-t border-slate-100">
                <span className="font-bold text-slate-700">Total</span>
                <span className="font-extrabold text-lg">{formatRupiah(total)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleSimpanDraft}
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 rounded-2xl border-2 py-3.5 font-bold disabled:opacity-50"
                  style={{ borderColor: GREEN, color: GREEN }}
                >
                  {submitting ? <Spinner size="sm" /> : "Simpan Draft"}
                </button>
                <button
                  type="button"
                  onClick={() => setSheet("payment")}
                  className="flex items-center justify-center gap-2 rounded-2xl py-3.5 font-extrabold text-white"
                  style={{ backgroundColor: GREEN }}
                >
                  Lanjut Pembayaran
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sheet === "payment" && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end">
          <div className="w-full max-w-md mx-auto bg-white rounded-t-[28px] max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <button type="button" onClick={() => setSheet("cart")}>
                <ChevronLeft size={20} className="text-slate-700" />
              </button>
              <p className="font-extrabold text-slate-900">Pembayaran</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: OBBEL_SCALE[50] }}>
                <p className="text-sm font-semibold text-slate-600">Total Pembayaran</p>
                <p className="font-extrabold text-2xl mt-1" style={{ color: GREEN }}>
                  {formatRupiah(total)}
                </p>
                {discount > 0 && (
                  <p className="text-sm text-slate-500 mt-1">
                    Subtotal {formatRupiah(subtotal)} - Diskon {formatRupiah(discount)}
                  </p>
                )}
              </div>

              <div>
                <p className="text-base font-bold text-slate-700 mb-2">Metode Pembayaran</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["CASH", "QRIS", "SPLIT"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className="rounded-xl py-3 text-base font-bold border-2"
                      style={
                        paymentMethod === m
                          ? { borderColor: GREEN, color: GREEN, backgroundColor: OBBEL_SCALE[50] }
                          : { borderColor: "#E2E8F0", color: "#475569" }
                      }
                    >
                      {m === "CASH" ? "Tunai" : m === "QRIS" ? "QRIS" : "Split"}
                    </button>
                  ))}
                </div>
              </div>

              {(paymentMethod === "QRIS" || paymentMethod === "SPLIT") && (
                <div>
                  <p className="text-base font-bold text-slate-700 mb-2">Kode QRIS Booth</p>
                  {qrisImageUrl ? (
                    <div className="rounded-2xl border border-slate-200 p-4 flex flex-col items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrisImageUrl} alt="Kode QRIS" className="w-48 h-48 object-contain" />
                      <p className="text-sm text-slate-500 text-center">Tunjukkan ke pelanggan untuk dipindai.</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 font-medium">
                      Kode QRIS Booth ini belum diunggah Admin. Hubungi Admin untuk mengaturnya di Data Booth.
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === "CASH" && (
                <div>
                  <p className="text-base font-bold text-slate-700 mb-2">Nominal Diterima (Tunai)</p>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {nominalCepat(total).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNominalTunai(n)}
                        className="rounded-xl py-2.5.5 text-sm font-bold border-2"
                        style={
                          nominalTunai === n
                            ? { borderColor: GREEN, color: GREEN, backgroundColor: OBBEL_SCALE[50] }
                            : { borderColor: "#E2E8F0", color: "#475569" }
                        }
                      >
                        {formatRupiah(n)}
                      </button>
                    ))}
                  </div>
                  <RibuanInput
                    value={nominalTunai}
                    onChange={setNominalTunai}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base font-semibold outline-none focus:border-[#0B5D34]"
                    placeholder="Masukkan nominal lain"
                  />
                </div>
              )}

              {paymentMethod === "SPLIT" && (
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-600 mb-1.5">Bagian Tunai</p>
                    <RibuanInput
                      value={splitTunai}
                      onChange={setSplitTunai}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base font-semibold outline-none focus:border-[#0B5D34]"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-600 mb-1.5">Bagian QRIS</p>
                    <RibuanInput
                      value={splitQris}
                      onChange={setSplitQris}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base font-semibold outline-none focus:border-[#0B5D34]"
                    />
                  </div>
                  {sisaSplit !== 0 && (
                    <p className="text-sm font-semibold" style={{ color: OBBEL.accentRed }}>
                      {sisaSplit > 0 ? `Kurang ${formatRupiah(sisaSplit)}` : `Lebih ${formatRupiah(-sisaSplit)}`} dari total.
                    </p>
                  )}
                </div>
              )}

              {paymentMethod === "CASH" && (
                <div className="rounded-2xl bg-slate-50 p-4 flex flex-col gap-1.5 text-base">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Pembayaran</span>
                    <span className="font-semibold">{formatRupiah(total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dibayar</span>
                    <span className="font-semibold">{formatRupiah(nominalTunai)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{kembalianAtauKurang < 0 ? "Kekurangan" : "Kembalian"}</span>
                    <span className="font-bold" style={{ color: kembalianAtauKurang < 0 ? OBBEL.accentRed : GREEN }}>
                      {formatRupiah(Math.abs(kembalianAtauKurang))}
                    </span>
                  </div>
                </div>
              )}

              {paymentMethod === "CASH" && kembalianAtauKurang < 0 && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 font-medium">
                  Nominal masih kurang. Mohon masukkan nominal yang sesuai.
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleBayar}
                disabled={submitting || !bisaBayar}
                className="w-full rounded-2xl py-4 font-extrabold text-white disabled:opacity-50"
                style={{ backgroundColor: GREEN }}
              >
                {submitting ? <Spinner size="sm" color="white" /> : "Bayar Sekarang"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function KasirPage() {
  return (
    <RequirePetugasAuth>
      <KasirContent />
    </RequirePetugasAuth>
  );
}
