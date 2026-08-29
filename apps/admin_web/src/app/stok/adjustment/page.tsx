"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/Textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { QuantityStepperInline } from "@/components/warehouse/QuantityStepperInline";
import {
  api,
  ApiError,
  REASON_CODE_OPTIONS,
  type Booth,
  type Product,
  type ReasonCode,
  type StockAdjustmentRecord,
} from "@/lib/api-client";
import { Plus, Undo2 } from "lucide-react";

function ProductName({ productId, products }: { productId: string; products: Product[] }) {
  return <>{products.find((p) => p.id === productId)?.name ?? productId}</>;
}

function AdjustmentContent() {
  const toast = useToast();
  const [records, setRecords] = useState<StockAdjustmentRecord[] | null>(null);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [locationType, setLocationType] = useState<"WAREHOUSE" | "BOOTH">("WAREHOUSE");
  const [boothId, setBoothId] = useState("");
  const [productId, setProductId] = useState("");
  const [targetQty, setTargetQty] = useState(0);
  const [reasonCode, setReasonCode] = useState<ReasonCode>("DATA_ENTRY_ERROR");
  const [reasonNote, setReasonNote] = useState("");

  async function load() {
    try {
      setRecords(await api.getStockAdjustments());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Adjustment.");
    }
  }

  useEffect(() => {
    load();
    api.getBooths().then(setBooths).catch(() => {});
    api.getProducts().then(setProducts).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createStockAdjustment({
        idempotencyKey: crypto.randomUUID(),
        locationType,
        boothId: locationType === "BOOTH" ? boothId : undefined,
        productId,
        targetQty,
        reasonCode,
        reasonNote: reasonNote || undefined,
      });
      toast.success("Adjustment stok berhasil disimpan.");
      setModalOpen(false);
      setProductId("");
      setTargetQty(0);
      setReasonNote("");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan Adjustment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReverse(record: StockAdjustmentRecord) {
    try {
      await api.reverseStockAdjustment(record.entityId, {
        idempotencyKey: crypto.randomUUID(),
        reasonCode: "DATA_ENTRY_ERROR",
        reasonNote: "Reverse dari halaman Adjustment",
      });
      toast.success("Adjustment berhasil di-reverse.");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal reverse Adjustment.");
    }
  }

  const reversedIds = new Set(
    (records ?? []).filter((r) => r.correctionType === "VOID").map((r) => r.entityId),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Adjustment / Koreksi Stok</h1>
          <p className="text-sm text-slate-500 dark:text-fg-muted">
            Perbaikan stok manual untuk kejadian seperti rusak, tumpah, hilang, atau salah input — bukan jalan pintas edit stok bebas.
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
          Buat Adjustment
        </Button>
      </div>

      {!records ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lokasi</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Before → After</TableHead>
                <TableHead>Delta</TableHead>
                <TableHead>Alasan</TableHead>
                <TableHead>Oleh</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records
                .filter((r) => r.correctionType === "ADJUSTMENT")
                .map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.impactSnapshot.locationType === "WAREHOUSE"
                        ? "Gudang Pusat"
                        : booths.find((b) => b.id === r.impactSnapshot.boothId)?.name ?? "Booth"}
                    </TableCell>
                    <TableCell className="font-semibold">
                      <ProductName productId={r.impactSnapshot.productId} products={products} />
                    </TableCell>
                    <TableCell>
                      {r.impactSnapshot.before} → {r.impactSnapshot.after}
                    </TableCell>
                    <TableCell className={r.impactSnapshot.delta < 0 ? "text-red-500 font-semibold" : "text-emerald-500 font-semibold"}>
                      {r.impactSnapshot.delta > 0 ? `+${r.impactSnapshot.delta}` : r.impactSnapshot.delta}
                    </TableCell>
                    <TableCell>{REASON_CODE_OPTIONS.find((o) => o.value === r.reasonCode)?.label ?? r.reasonCode}</TableCell>
                    <TableCell>{r.createdBy.fullName}</TableCell>
                    <TableCell>
                      {reversedIds.has(r.entityId) ? (
                        <StatusBadge type="inactive" label="Sudah di-reverse" />
                      ) : (
                        <Button size="sm" variant="secondary" leftIcon={<Undo2 className="w-3 h-3" />} onClick={() => handleReverse(r)}>
                          Reverse
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              {records.filter((r) => r.correctionType === "ADJUSTMENT").length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                    Belum ada Adjustment.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Buat Adjustment Stok" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Lokasi"
            options={[
              { value: "WAREHOUSE", label: "Gudang Pusat" },
              { value: "BOOTH", label: "Booth" },
            ]}
            value={locationType}
            onChange={(v) => setLocationType(v as "WAREHOUSE" | "BOOTH")}
          />
          {locationType === "BOOTH" && (
            <Select
              label="Booth"
              placeholder="Pilih Booth"
              options={booths.map((b) => ({ value: b.id, label: b.name }))}
              value={boothId}
              onChange={setBoothId}
            />
          )}
          <Select
            label="Produk"
            placeholder="Pilih Produk"
            options={products.map((p) => ({ value: p.id, label: p.name }))}
            value={productId}
            onChange={setProductId}
          />
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-fg mb-2">Target Qty Aktual</p>
            <QuantityStepperInline value={targetQty} onChange={setTargetQty} />
          </div>
          <Select
            label="Alasan"
            options={REASON_CODE_OPTIONS}
            value={reasonCode}
            onChange={(v) => setReasonCode(v as ReasonCode)}
          />
          <Textarea
            label="Catatan (wajib jika alasan Lainnya)"
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value)}
            placeholder="Catatan tambahan..."
          />
          <Button type="submit" fullWidth isLoading={saving} disabled={!productId || (locationType === "BOOTH" && !boothId)}>
            Simpan Adjustment
          </Button>
        </form>
      </Modal>
    </div>
  );
}

export default function StockAdjustmentPage() {
  return (
    <RequireAuth>
      <AdjustmentContent />
    </RequireAuth>
  );
}
