"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type AccessLevel, type AccessRole, type MenuCatalogItem, type MenuKey } from "@/lib/api-client";

type Pilihan = AccessLevel | "NONE";

const PILIHAN: { value: Pilihan; label: string }[] = [
  { value: "NONE", label: "Tidak ada" },
  { value: "VIEW", label: "Lihat" },
  { value: "MANAGE", label: "Kelola" },
];

const LABEL_LEVEL: Record<AccessLevel, string> = { VIEW: "Lihat", MANAGE: "Kelola" };

interface Draf {
  id: string | null;
  name: string;
  description: string;
  levels: Partial<Record<MenuKey, AccessLevel>>;
}

/// Peran & Hak Akses (BR-044) — khusus Owner. Satu peran = izin per menu
/// Tidak ada / Lihat / Kelola; dipasang ke Admin dari Master User.
function PeranContent() {
  const toast = useToast();
  const [roles, setRoles] = useState<AccessRole[] | null>(null);
  const [menus, setMenus] = useState<MenuCatalogItem[]>([]);
  const [draf, setDraf] = useState<Draf | null>(null);
  const [saving, setSaving] = useState(false);
  const [hapus, setHapus] = useState<AccessRole | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      const [roleList, menuList] = await Promise.all([api.getAccessRoles(), api.getAccessMenus()]);
      setRoles(roleList);
      setMenus(menuList);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat Peran.");
      setRoles([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grup = useMemo(() => {
    const hasil: { group: string; items: MenuCatalogItem[] }[] = [];
    for (const m of menus) {
      const g = hasil.find((x) => x.group === m.group);
      if (g) g.items.push(m);
      else hasil.push({ group: m.group, items: [m] });
    }
    return hasil;
  }, [menus]);

  const labelMenu = (key: MenuKey) => menus.find((m) => m.key === key)?.label ?? key;

  function aturLevel(menu: MenuKey, pilihan: Pilihan) {
    setDraf((d) => {
      if (!d) return d;
      const levels = { ...d.levels };
      if (pilihan === "NONE") delete levels[menu];
      else levels[menu] = pilihan;
      return { ...d, levels };
    });
  }

  function aturGrup(items: MenuCatalogItem[], pilihan: Pilihan) {
    for (const m of items) aturLevel(m.key, pilihan);
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (!draf) return;
    setSaving(true);
    const input = {
      name: draf.name,
      description: draf.description.trim() || undefined,
      permissions: Object.entries(draf.levels).map(([menu, level]) => ({ menu: menu as MenuKey, level: level as AccessLevel })),
    };
    try {
      if (draf.id) await api.updateAccessRole(draf.id, input);
      else await api.createAccessRole(input);
      toast.success(`Peran "${draf.name.trim()}" disimpan.`);
      setDraf(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan Peran.");
    } finally {
      setSaving(false);
    }
  }

  async function konfirmasiHapus() {
    if (!hapus) return;
    setDeleting(true);
    try {
      await api.deleteAccessRole(hapus.id);
      toast.success(`Peran "${hapus.name}" dihapus.`);
      setHapus(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menghapus Peran.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Peran &amp; Hak Akses</h1>
          <p className="text-sm text-slate-500 dark:text-fg-muted">
            Atur menu yang boleh dibuka Admin: Tidak ada, Lihat, atau Kelola. Pasang peran ke Admin di Master User.
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setDraf({ id: null, name: "", description: "", levels: {} })}>
          Tambah Peran
        </Button>
      </div>

      {!roles ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roles.map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-fg flex items-center gap-1.5">
                    {r.fullAccess && <ShieldCheck className="w-4 h-4 text-(--brand-700) shrink-0" />}
                    <span className="truncate">{r.name}</span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-fg-muted mt-0.5">{r._count.profiles} Admin</p>
                </div>
                {!r.fullAccess && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Ubah peran"
                      onClick={() =>
                        setDraf({
                          id: r.id,
                          name: r.name,
                          description: r.description ?? "",
                          levels: Object.fromEntries(r.permissions.map((p) => [p.menu, p.level])),
                        })
                      }
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" title="Hapus peran" onClick={() => setHapus(r)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              {r.description && <p className="text-xs text-slate-600 dark:text-fg-secondary">{r.description}</p>}
              <div className="flex flex-wrap gap-1.5">
                {r.fullAccess ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand-50 dark:bg-brand-500/10 text-(--brand-700) border border-brand-100 dark:border-brand-500/30">
                    Kelola semua menu
                  </span>
                ) : r.permissions.length === 0 ? (
                  <span className="text-xs text-slate-400 dark:text-fg-muted">Belum ada menu</span>
                ) : (
                  r.permissions.map((p) => (
                    <span
                      key={p.menu}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                        p.level === "MANAGE"
                          ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40"
                          : "bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-muted border-slate-200 dark:border-line"
                      }`}
                    >
                      {labelMenu(p.menu)} · {LABEL_LEVEL[p.level]}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={draf !== null} onClose={() => setDraf(null)} title={draf?.id ? "Ubah Peran" : "Tambah Peran"} size="lg">
        {draf && (
          <form onSubmit={simpan} className="space-y-4 overflow-y-auto">
            <Input label="Nama Peran" value={draf.name} onChange={(e) => setDraf({ ...draf, name: e.target.value })} required minLength={2} maxLength={60} />
            <Input
              label="Keterangan (opsional)"
              value={draf.description}
              onChange={(e) => setDraf({ ...draf, description: e.target.value })}
              maxLength={200}
            />
            <div className="space-y-4">
              {grup.map((g) => (
                <div key={g.group} className="rounded-xl border border-slate-200/80 dark:border-line">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-surface-hover/60 rounded-t-xl">
                    <p className="text-xs font-bold text-slate-700 dark:text-fg-secondary">{g.group}</p>
                    <div className="flex gap-1">
                      {PILIHAN.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => aturGrup(g.items, p.value)}
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-lg text-slate-500 dark:text-fg-muted hover:bg-white dark:hover:bg-surface cursor-pointer"
                        >
                          Semua {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-line">
                    {g.items.map((m) => {
                      const aktif: Pilihan = draf.levels[m.key] ?? "NONE";
                      return (
                        <div key={m.key} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="text-sm text-slate-800 dark:text-fg">{m.label}</span>
                          <div className="flex rounded-lg border border-slate-200 dark:border-line overflow-hidden shrink-0">
                            {PILIHAN.map((p) => (
                              <button
                                key={p.value}
                                type="button"
                                onClick={() => aturLevel(m.key, p.value)}
                                className={`text-xs font-semibold px-2.5 py-1 cursor-pointer transition-colors ${
                                  aktif === p.value
                                    ? "bg-(--brand-700) text-white"
                                    : "bg-white dark:bg-surface text-slate-600 dark:text-fg-secondary hover:bg-slate-50 dark:hover:bg-surface-hover"
                                }`}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-fg-muted">
              Perubahan berlaku langsung untuk Admin yang memakai peran ini. Tampilan &amp; Dokumentasi selalu terbuka.
            </p>
            <Button type="submit" fullWidth isLoading={saving}>
              Simpan Peran
            </Button>
          </form>
        )}
      </Modal>

      <Modal isOpen={hapus !== null} onClose={() => setHapus(null)} title="Hapus Peran" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-fg-secondary">
            Hapus peran <span className="font-semibold">{hapus?.name}</span>? Peran yang masih dipakai Admin tidak bisa dihapus.
          </p>
          <Button variant="danger" fullWidth isLoading={deleting} onClick={konfirmasiHapus}>
            Hapus
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function PeranPage() {
  return (
    <RequireAuth>
      <PeranContent />
    </RequireAuth>
  );
}
