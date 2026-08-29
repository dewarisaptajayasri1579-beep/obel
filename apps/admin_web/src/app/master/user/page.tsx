"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Button } from "@/components/ui/Button";
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
import { api, ApiError, type Booth, type UserAccount } from "@/lib/api-client";
import { Plus } from "lucide-react";

const ROLE_LABEL: Record<UserAccount["role"], string> = {
  BOOTH_STAFF: "Petugas Booth",
  ADMIN: "Admin Pusat",
  OWNER: "Owner",
};

const ROLE_OPTIONS = [
  { value: "BOOTH_STAFF", label: "Petugas Booth" },
  { value: "ADMIN", label: "Admin Pusat" },
  { value: "OWNER", label: "Owner" },
];

function UserContent() {
  const toast = useToast();
  const [users, setUsers] = useState<UserAccount[] | null>(null);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserAccount["role"]>("BOOTH_STAFF");
  const [defaultBoothId, setDefaultBoothId] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [userList, boothList] = await Promise.all([api.getUsers(), api.getBooths()]);
      setUsers(userList);
      setBooths(boothList);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat data User.");
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
      await api.createUser({
        username,
        password,
        fullName,
        role,
        defaultBoothId: role === "BOOTH_STAFF" ? defaultBoothId || undefined : undefined,
      });
      toast.success(`User "${username}" berhasil dibuat.`);
      setModalOpen(false);
      setUsername("");
      setPassword("");
      setFullName("");
      setRole("BOOTH_STAFF");
      setDefaultBoothId("");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal membuat User.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Master User</h1>
          <p className="text-sm text-slate-500 dark:text-fg-muted">Kelola akun login Petugas Booth, Admin, dan Owner.</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
          Tambah User
        </Button>
      </div>

      {!users ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Nama Lengkap</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Booth</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs">{u.username}</TableCell>
                  <TableCell className="font-semibold">{u.fullName}</TableCell>
                  <TableCell>{ROLE_LABEL[u.role]}</TableCell>
                  <TableCell>{booths.find((b) => b.id === u.defaultBoothId)?.name ?? "-"}</TableCell>
                  <TableCell>
                    <StatusBadge type={u.active ? "safe" : "inactive"} label={u.active ? "Aktif" : "Nonaktif"} />
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                    Belum ada User.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Tambah User" size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <Input
            label="Password"
            isPassword
            helperText="Minimal 6 karakter"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Input label="Nama Lengkap" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <Select
            label="Role"
            options={ROLE_OPTIONS}
            value={role}
            onChange={(v) => setRole(v as UserAccount["role"])}
          />
          {role === "BOOTH_STAFF" && (
            <Select
              label="Default Booth"
              placeholder="Pilih Booth"
              options={booths.map((b) => ({ value: b.id, label: b.name }))}
              value={defaultBoothId}
              onChange={setDefaultBoothId}
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

export default function UserPage() {
  return (
    <RequireAuth>
      <UserContent />
    </RequireAuth>
  );
}
