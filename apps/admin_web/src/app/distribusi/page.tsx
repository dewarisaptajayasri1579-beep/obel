"use client";

import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBadge, type StatusBadgeType } from "@/components/ui/StatusBadge";
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
import { api, ApiError, type Booth, type Distribution, type Product } from "@/lib/api-client";
import { Plus, Truck } from "lucide-react";

const STATUS_CONFIG: Record<Distribution["status"], { type: StatusBadgeType; label: string }> = {
  DRAFT: { type: "inactive", label: "Draft" },
  SENT: { type: "expiring_next_month", label: "Menunggu Diterima" },
  RECEIVED: { type: "safe", label: "Diterima" },
  DISCREPANCY: { type: "expiring_this_month", label: "Ada Selisih" },
  CANCELLED: { type: "expired", label: "Dibatalkan" },
};

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

function DistribusiContent() {
  const toast = useToast();
  const [distributions, setDistributions] = useState<Distribution[] | null>(null);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [boothId, setBoothId] = useState("");
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    try {
      const [distList, boothList, productList] = await Promise.all([
        api.getDistributions(),
        api.getBooths(),
        api.getProducts(),
      ]);
      setDistributions(distList);
      setBooths(boothList);
      setProducts(productList.filter((p) => p.active));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Distribusi.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedItems = useMemo(
    () => Object.entries(qtyByProduct).filter(([, qty]) => qty > 0),
    [qtyByProduct],
  );

  function resetForm() {
    setBoothId("");
    setQtyByProduct({});
    setNote("");
  }

  async function handleSend() {
    if (!boothId || selectedItems.length === 0) {
      toast.warning("Pilih Booth dan minimal 1 produk dengan qty > 0.");
      return;
    }
    setSending(true);
    try {
      await api.createDistribution({
        idempotencyKey: crypto.randomUUID(),
        boothId,
        items: selectedItems.map(([productId, qty]) => ({ productId, qty })),
        note: note || undefined,
      });
      toast.success("Distribusi berhasil dikirim.");
      setModalOpen(false);
      resetForm();
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal mengirim distribusi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Distribusi Stok</h1>
          <p className="text-sm text-slate-500 dark:text-fg-muted">
            Kirim stok dari Gudang Pusat ke Booth. Booth menerima lewat app Petugas Booth.
          </p>
        </div>
        <Button leftIcon={<Truck className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
          Kirim Distribusi
        </Button>
      </div>

      {!distributions ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Distribusi</TableHead>
                <TableHead>Booth</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dikirim</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {distributions.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">{d.distributionNo}</TableCell>
                  <TableCell className="font-semibold">{d.boothName}</TableCell>
                  <TableCell className="text-sm text-slate-500 dark:text-fg-muted">
                    {d.items.map((i) => `${i.productName} x${i.qtySent}`).join(", ")}
                  </TableCell>
                  <TableCell>
                    <StatusBadge type={STATUS_CONFIG[d.status].type} label={STATUS_CONFIG[d.status].label} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.sentAt ? new Date(d.sentAt).toLocaleString("id-ID") : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {distributions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                    Belum ada distribusi.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title="Kirim Distribusi Stok"
        size="lg"
      >
        <div className="space-y-4">
          <Select
            label="Booth Tujuan"
            placeholder="Pilih Booth"
            options={booths.map((b) => ({ value: b.id, label: b.name }))}
            value={boothId}
            onChange={setBoothId}
          />

          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-fg mb-2">Produk & Qty</p>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-line px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-fg">{p.name}</p>
                    <p className="text-xs text-slate-500 dark:text-fg-muted">{formatRupiah(p.sellPrice)}</p>
                  </div>
                  <QuantityStepperInline
                    value={qtyByProduct[p.id] ?? 0}
                    onChange={(v) => setQtyByProduct((prev) => ({ ...prev, [p.id]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {selectedItems.length > 0 && (
            <div className="rounded-xl bg-slate-50 dark:bg-elevated px-3 py-2 text-sm text-slate-600 dark:text-fg-muted">
              {selectedItems.length} produk dipilih, total{" "}
              {selectedItems.reduce((sum, [, qty]) => sum + qty, 0)} cup.
            </div>
          )}

          <Button leftIcon={<Plus className="w-4 h-4" />} fullWidth isLoading={sending} onClick={handleSend}>
            Kirim Distribusi
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function DistribusiPage() {
  return (
    <RequireAuth>
      <DistribusiContent />
    </RequireAuth>
  );
}
