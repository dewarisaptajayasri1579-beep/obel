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
import { api, ApiError, type Booth } from "@/lib/api-client";
import { Plus } from "lucide-react";

function BoothContent() {
  const toast = useToast();
  const [booths, setBooths] = useState<Booth[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setBooths(await api.getBooths());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Booth.");
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
      await api.createBooth({ code, name, locationName: locationName || undefined });
      toast.success(`Booth "${name}" berhasil ditambahkan.`);
      setModalOpen(false);
      setCode("");
      setName("");
      setLocationName("");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menambahkan Booth.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Master Booth</h1>
          <p className="text-sm text-slate-500 dark:text-fg-muted">Kelola daftar Booth aktif.</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
          Tambah Booth
        </Button>
      </div>

      {!booths ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Lokasi</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {booths.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-semibold">{b.code}</TableCell>
                  <TableCell>{b.name}</TableCell>
                  <TableCell>{b.locationName ?? "-"}</TableCell>
                  <TableCell>
                    <StatusBadge
                      type={b.status === "ACTIVE" ? "safe" : "inactive"}
                      label={b.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {booths.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                    Belum ada Booth.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Tambah Booth" size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Kode Booth" placeholder="BOOTH-11" value={code} onChange={(e) => setCode(e.target.value)} required />
          <Input label="Nama Booth" placeholder="Booth 11" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            label="Lokasi (opsional)"
            placeholder="Depan ..."
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
          />
          <Button type="submit" fullWidth isLoading={saving}>
            Simpan
          </Button>
        </form>
      </Modal>
    </div>
  );
}

export default function BoothPage() {
  return (
    <RequireAuth>
      <BoothContent />
    </RequireAuth>
  );
}
