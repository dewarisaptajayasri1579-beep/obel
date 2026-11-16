"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type ProductCategory } from "@/lib/api-client";

type Mode = { id: string; jenis: "ubah" | "hapus" } | null;

/// Add, rename and delete product categories from the Produk page. A category
/// still used by a product cannot be deleted (the backend refuses too), so the
/// delete button is disabled with the reason instead of failing after a click.
export function KelolaKategoriModal({
  isOpen,
  onClose,
  categories,
  onReload,
}: {
  isOpen: boolean;
  onClose: () => void;
  categories: ProductCategory[];
  onReload: () => Promise<void>;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>(null);
  const [nama, setNama] = useState("");
  const [namaBaru, setNamaBaru] = useState("");
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setMode(null);
      setNamaBaru("");
    }
  }, [isOpen]);

  async function jalankan(aksi: () => Promise<unknown>, pesanSukses: string, pesanGagal: string) {
    setSibuk(true);
    try {
      await aksi();
      toast.success(pesanSukses);
      setMode(null);
      await onReload();
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : pesanGagal);
      return false;
    } finally {
      setSibuk(false);
    }
  }

  async function tambah() {
    const name = namaBaru.trim();
    if (!name) return;
    const ok = await jalankan(() => api.createProductCategory({ name }), `Kategori "${name}" ditambahkan.`, "Gagal menambah kategori.");
    if (ok) setNamaBaru("");
  }

  function simpanNama(c: ProductCategory) {
    const name = nama.trim();
    if (!name || name === c.name) {
      setMode(null);
      return;
    }
    jalankan(() => api.updateProductCategory(c.id, { name }), `Kategori diubah menjadi "${name}".`, "Gagal mengubah kategori.");
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kelola Kategori" subtitle="Tambah, ubah nama, atau hapus kategori produk." size="md">
      <div className="space-y-4">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            tambah();
          }}
        >
          <Input
            sizeVariant="sm"
            placeholder="Nama kategori baru"
            aria-label="Nama kategori baru"
            value={namaBaru}
            onChange={(e) => setNamaBaru(e.target.value)}
          />
          <Button type="submit" variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} disabled={!namaBaru.trim() || sibuk}>
            Tambah
          </Button>
        </form>

        {categories.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-fg-muted py-6 text-center">Belum ada kategori.</p>
        ) : (
          <ul className="divide-y divide-slate-200/70 dark:divide-line rounded-xl border border-slate-200/80 dark:border-line">
            {categories.map((c) => {
              const ubah = mode?.id === c.id && mode.jenis === "ubah";
              const hapus = mode?.id === c.id && mode.jenis === "hapus";
              const dipakai = c.productCount > 0;
              return (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2 min-h-12">
                  {ubah ? (
                    <form
                      className="flex flex-1 items-center gap-1.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        simpanNama(c);
                      }}
                    >
                      <Input
                        sizeVariant="sm"
                        aria-label={`Nama kategori ${c.name}`}
                        value={nama}
                        onChange={(e) => setNama(e.target.value)}
                        autoFocus
                      />
                      <IconButton label="Simpan nama" type="submit" disabled={sibuk || !nama.trim()} tone="brand">
                        <Check className="w-4 h-4" />
                      </IconButton>
                      <IconButton label="Batal ubah" onClick={() => setMode(null)}>
                        <X className="w-4 h-4" />
                      </IconButton>
                    </form>
                  ) : hapus ? (
                    <>
                      <span className="flex-1 min-w-0 text-sm text-slate-700 dark:text-fg-secondary">
                        Hapus kategori <strong className="text-slate-900 dark:text-fg">{c.name}</strong>?
                      </span>
                      <Button variant="secondary" size="sm" onClick={() => setMode(null)} disabled={sibuk}>
                        Batal
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        isLoading={sibuk}
                        onClick={() => jalankan(() => api.deleteProductCategory(c.id), `Kategori "${c.name}" dihapus.`, "Gagal menghapus kategori.")}
                      >
                        Hapus
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-fg truncate">{c.name}</p>
                        <p className="text-xs text-slate-500 dark:text-fg-muted">{dipakai ? `${c.productCount} produk` : "Belum dipakai"}</p>
                      </div>
                      <IconButton
                        label={`Ubah nama ${c.name}`}
                        onClick={() => {
                          setNama(c.name);
                          setMode({ id: c.id, jenis: "ubah" });
                        }}
                        disabled={sibuk}
                      >
                        <Pencil className="w-4 h-4" />
                      </IconButton>
                      <IconButton
                        label={dipakai ? `Masih dipakai ${c.productCount} produk` : `Hapus ${c.name}`}
                        onClick={() => setMode({ id: c.id, jenis: "hapus" })}
                        disabled={sibuk || dipakai}
                        tone="danger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </IconButton>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function IconButton({
  label,
  tone = "neutral",
  type = "button",
  children,
  ...rest
}: {
  label: string;
  tone?: "neutral" | "brand" | "danger";
  type?: "button" | "submit";
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const warna = {
    neutral: "hover:text-slate-800 dark:hover:text-fg",
    brand: "hover:text-(--brand-700) dark:hover:text-brand-400",
    danger: "hover:text-rose-600",
  }[tone];
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-slate-500 dark:text-fg-muted hover:bg-slate-100 dark:hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent ${warna}`}
      {...rest}
    >
      {children}
    </button>
  );
}
