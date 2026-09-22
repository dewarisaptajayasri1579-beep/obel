"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
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
import { api, ApiError, type ShiftTemplate } from "@/lib/api-client";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";

type FormMode = "create" | "edit";

const FORM_KOSONG = { name: "", startTime: "", endTime: "" };

function ShiftTemplateContent() {
  const toast = useToast();
  const [templates, setTemplates] = useState<ShiftTemplate[] | null>(null);

  const [modalMode, setModalMode] = useState<FormMode | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_KOSONG);
  const [saving, setSaving] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [hapusTarget, setHapusTarget] = useState<ShiftTemplate | null>(null);
  const [menghapus, setMenghapus] = useState(false);

  async function load() {
    try {
      setTemplates(await api.getShiftTemplates());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Shift.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function bukaTambah() {
    setForm(FORM_KOSONG);
    setEditingId(null);
    setModalMode("create");
  }

  function bukaEdit(t: ShiftTemplate) {
    setForm({ name: t.name, startTime: t.startTime, endTime: t.endTime });
    setEditingId(t.id);
    setModalMode("edit");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (modalMode === "create") {
        await api.createShiftTemplate(form);
        toast.success(`Shift "${form.name}" berhasil ditambahkan.`);
      } else if (editingId) {
        await api.updateShiftTemplate(editingId, form);
        toast.success(`Shift "${form.name}" berhasil diperbarui.`);
      }
      setModalMode(null);
      setEditingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan Shift.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAktif(t: ShiftTemplate) {
    setTogglingId(t.id);
    try {
      await api.updateShiftTemplate(t.id, { active: !t.active });
      toast.success(`Shift "${t.name}" ${t.active ? "dinonaktifkan" : "diaktifkan"}.`);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal mengubah status Shift.");
    } finally {
      setTogglingId(null);
    }
  }

  async function hapusTemplate() {
    if (!hapusTarget) return;
    setMenghapus(true);
    try {
      await api.deleteShiftTemplate(hapusTarget.id);
      toast.success(`Shift "${hapusTarget.name}" dihapus.`);
      setHapusTarget(null);
      await load();
    } catch (err) {
      // Backend menolak kalau template masih dipakai ShiftSession/Setting
      // Booth-Petugas (lihat ShiftTemplatesService.remove) — pesannya sudah
      // menjelaskan alasannya, tampilkan apa adanya, jangan ditebak di sini.
      toast.error(err instanceof ApiError ? err.message : "Gagal menghapus Shift.");
    } finally {
      setMenghapus(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Master Shift</h1>
          <p className="text-sm text-slate-500 dark:text-fg-muted">Kelola template jam shift Petugas Booth.</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={bukaTambah}>
          Tambah Shift
        </Button>
      </div>

      {!templates ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Jam Mulai</TableHead>
                <TableHead>Jam Selesai</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-semibold">{t.name}</TableCell>
                  <TableCell>{t.startTime}</TableCell>
                  <TableCell>{t.endTime}</TableCell>
                  <TableCell>
                    <StatusBadge
                      type={t.active ? "safe" : "inactive"}
                      label={t.active ? "Aktif" : "Nonaktif"}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" leftIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => bukaEdit(t)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        leftIcon={<Power className="w-3.5 h-3.5" />}
                        isLoading={togglingId === t.id}
                        onClick={() => toggleAktif(t)}
                      >
                        {t.active ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                      <Button
                        variant="ghost"
                        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                        onClick={() => setHapusTarget(t)}
                      >
                        Hapus
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {templates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                    Belum ada template Shift.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Modal
        isOpen={modalMode !== null}
        onClose={() => setModalMode(null)}
        title={modalMode === "create" ? "Tambah Shift" : "Ubah Shift"}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nama Shift"
            placeholder="Pagi"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            label="Jam Mulai"
            type="time"
            value={form.startTime}
            onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            required
          />
          <Input
            label="Jam Selesai"
            type="time"
            value={form.endTime}
            onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
            required
          />
          <Button type="submit" fullWidth isLoading={saving}>
            Simpan
          </Button>
        </form>
      </Modal>

      <Modal isOpen={hapusTarget !== null} onClose={() => setHapusTarget(null)} title="Hapus Shift" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-fg-muted">
            Hapus template Shift <strong className="text-slate-800 dark:text-fg">{hapusTarget?.name}</strong>? Hanya
            berhasil kalau belum pernah dipakai shift session atau Setting Booth-Petugas. Kalau sudah pernah dipakai,
            gunakan Nonaktifkan.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setHapusTarget(null)}>
              Batal
            </Button>
            <Button variant="danger" size="sm" isLoading={menghapus} onClick={hapusTemplate}>
              Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function ShiftTemplatePage() {
  return (
    <RequireAuth>
      <ShiftTemplateContent />
    </RequireAuth>
  );
}
