"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
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
import { api, ApiError, type WarehouseStockItem } from "@/lib/api-client";
import { Pencil } from "lucide-react";

function GudangContent() {
  const toast = useToast();
  const [items, setItems] = useState<WarehouseStockItem[] | null>(null);
  const [editing, setEditing] = useState<WarehouseStockItem | null>(null);
  const [targetQty, setTargetQty] = useState(0);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setItems(await api.getWarehouseStock());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat Stok Gudang.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEdit(item: WarehouseStockItem) {
    setEditing(item);
    setTargetQty(item.qtyOnHand);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      await api.adjustWarehouseStock({ productId: editing.productId, targetQty });
      toast.success(`Stok ${editing.name} diperbarui menjadi ${targetQty} cup.`);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memperbarui stok.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Stok Gudang Pusat</h1>
        <p className="text-sm text-slate-500 dark:text-fg-muted">
          Stok sebelum didistribusikan ke Booth. Sesuaikan jumlah kalau ada penerimaan barang baru.
        </p>
      </div>

      {!items ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Stok (cup)</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.productId}>
                  <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                  <TableCell className="font-semibold">{item.name}</TableCell>
                  <TableCell>{item.qtyOnHand} cup</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" leftIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openEdit(item)}>
                      Sesuaikan
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={`Sesuaikan Stok — ${editing?.name}`} size="sm">
        {editing && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-fg-muted">
              Stok saat ini: <span className="font-semibold text-slate-800 dark:text-fg">{editing.qtyOnHand} cup</span>
            </p>
            <QuantityStepperInline value={targetQty} onChange={setTargetQty} />
            <Button fullWidth isLoading={saving} onClick={handleSave}>
              Simpan
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function GudangPage() {
  return (
    <RequireAuth>
      <GudangContent />
    </RequireAuth>
  );
}
