"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Button } from "@/components/ui/Button";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
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
import { api, ApiError, type Product, type ProductCategory } from "@/lib/api-client";
import { Plus } from "lucide-react";

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

function ProdukContent() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sellPrice, setSellPrice] = useState(0);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [productList, categoryList] = await Promise.all([
        api.getProducts(),
        api.getProductCategories(),
      ]);
      setProducts(productList);
      setCategories(categoryList);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Produk.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createProduct({ sku, name, categoryId: categoryId || undefined, sellPrice });
      toast.success(`Produk "${name}" berhasil ditambahkan.`);
      setModalOpen(false);
      setSku("");
      setName("");
      setCategoryId("");
      setSellPrice(0);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menambahkan Produk.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Master Produk</h1>
          <p className="text-sm text-slate-500 dark:text-fg-muted">Kelola katalog produk siap jual.</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
          Tambah Produk
        </Button>
      </div>

      {!products ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Harga Jual</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell className="font-semibold">{p.name}</TableCell>
                  <TableCell>{p.category ?? "-"}</TableCell>
                  <TableCell>{formatRupiah(p.sellPrice)}</TableCell>
                  <TableCell>
                    <StatusBadge type={p.active ? "safe" : "inactive"} label={p.active ? "Aktif" : "Nonaktif"} />
                  </TableCell>
                </TableRow>
              ))}
              {products.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                    Belum ada Produk.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Tambah Produk" size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="SKU" placeholder="OBL-XXX" value={sku} onChange={(e) => setSku(e.target.value)} required />
          <Input label="Nama Produk" placeholder="Nama menu" value={name} onChange={(e) => setName(e.target.value)} required />
          <Select
            label="Kategori"
            placeholder="Pilih kategori"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={categoryId}
            onChange={setCategoryId}
          />
          <CurrencyInput label="Harga Jual" value={sellPrice} onChange={setSellPrice} />
          <Button type="submit" fullWidth isLoading={saving}>
            Simpan
          </Button>
        </form>
      </Modal>
    </div>
  );
}

export default function ProdukPage() {
  return (
    <RequireAuth>
      <ProdukContent />
    </RequireAuth>
  );
}
