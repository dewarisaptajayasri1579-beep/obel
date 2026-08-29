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
import { Plus } from "lucide-react";

function ShiftTemplateContent() {
  const toast = useToast();
  const [templates, setTemplates] = useState<ShiftTemplate[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [saving, setSaving] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createShiftTemplate({ name, startTime, endTime });
      toast.success(`Shift "${name}" berhasil ditambahkan.`);
      setModalOpen(false);
      setName("");
      setStartTime("");
      setEndTime("");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menambahkan Shift.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Master Shift</h1>
          <p className="text-sm text-slate-500 dark:text-fg-muted">Kelola template jam shift Petugas Booth.</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
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
                </TableRow>
              ))}
              {templates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                    Belum ada template Shift.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Tambah Shift" size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nama Shift" placeholder="Shift 1" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            label="Jam Mulai"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
          <Input
            label="Jam Selesai"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
          <Button type="submit" fullWidth isLoading={saving}>
            Simpan
          </Button>
        </form>
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
