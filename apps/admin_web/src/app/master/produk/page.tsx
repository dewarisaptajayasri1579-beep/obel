"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Button } from "@/components/ui/Button";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { FileUpload } from "@/components/ui/FileUpload";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Switch } from "@/components/ui/Switch";
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
import { Image as ImageIcon, Plus, X } from "lucide-react";

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

function ProdukContent() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sellPrice, setSellPrice] = useState(0);
  const [active, setActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
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

  function openCreate() {
    setEditing(null);
    setSku("");
    setName("");
    setCategoryId("");
    setSellPrice(0);
    setActive(true);
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(false);
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setSku(product.sku);
    setName(product.name);
    setCategoryId(categories.find((c) => c.name === product.category)?.id ?? "");
    setSellPrice(product.sellPrice);
    setActive(product.active);
    setImageFile(null);
    setImagePreview(product.imageUrl);
    setRemoveImage(false);
    setModalOpen(true);
  }

  function handleImageChange(files: File[]) {
    const file = files[0] ?? null;
    setImageFile(file);
    setRemoveImage(false);
    setImagePreview(file ? URL.createObjectURL(file) : editing?.imageUrl ?? null);
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(Boolean(editing?.imageUrl));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let uploadedImageUrl: string | undefined;
      if (imageFile) {
        uploadedImageUrl = (await api.uploadProductImage(imageFile)).imageUrl;
      }

      if (editing) {
        await api.updateProduct(editing.id, {
          name,
          categoryId: categoryId || undefined,
          sellPrice,
          active,
          ...(uploadedImageUrl ? { imageUrl: uploadedImageUrl } : {}),
          ...(removeImage ? { imageUrl: null } : {}),
        });
        toast.success(`Produk "${name}" berhasil diperbarui.`);
      } else {
        await api.createProduct({
          sku,
          name,
          categoryId: categoryId || undefined,
          sellPrice,
          imageUrl: uploadedImageUrl,
        });
        toast.success(`Produk "${name}" berhasil ditambahkan.`);
      }

      setModalOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan Produk.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-fg">
            Master Produk
          </h1>
          <p className="text-sm text-slate-500 dark:text-fg-muted">
            Kelola katalog produk siap jual.
          </p>
        </div>

        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate}>
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
                <TableHead>Foto</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Harga Jual</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {products.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => openEdit(p)}
                >
                  <TableCell className="font-mono text-xs">
                    {p.sku}
                  </TableCell>

                  <TableCell>
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <ImageIcon
                        className="h-5 w-5 text-slate-300"
                        aria-label="Belum ada foto"
                      />
                    )}
                  </TableCell>

                  <TableCell className="font-semibold">
                    {p.name}
                  </TableCell>

                  <TableCell>{p.category ?? "-"}</TableCell>

                  <TableCell>{formatRupiah(p.sellPrice)}</TableCell>

                  <TableCell>
                    <StatusBadge
                      type={p.active ? "safe" : "inactive"}
                      label={p.active ? "Aktif" : "Nonaktif"}
                    />
                  </TableCell>
                </TableRow>
              ))}

              {products.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-slate-500 py-8"
                  >
                    Belum ada Produk.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Produk" : "Tambah Produk"}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="SKU"
            placeholder="OBL-XXX"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            required
            disabled={!!editing}
          />

          <Input
            label="Nama Produk"
            placeholder="Nama menu"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Select
            label="Kategori"
            placeholder="Pilih kategori"
            options={categories.map((c) => ({
              value: c.id,
              label: c.name,
            }))}
            value={categoryId}
            onChange={setCategoryId}
          />

          <CurrencyInput
            label="Harga Jual"
            value={sellPrice}
            onChange={setSellPrice}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700 dark:text-fg-secondary">
                Foto Produk
              </span>

              {imagePreview && (
                <button
                  type="button"
                  onClick={clearImage}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                >
                  <X className="h-3.5 w-3.5" />
                  Hapus foto
                </button>
              )}
            </div>

            <FileUpload
              key={editing?.id ?? "new"}
              accept="image/jpeg,image/png,image/webp,image/gif"
              helperText="JPG, PNG, WEBP, atau GIF. Maksimal 5 MB."
              previewUrl={imagePreview}
              onFilesChange={handleImageChange}
            />
          </div>

          {editing && (
            <Switch
              label="Produk Aktif"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
          )}

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