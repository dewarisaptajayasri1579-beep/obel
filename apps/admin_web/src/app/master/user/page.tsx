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
import { api, ApiError, type AccessRole, type UserAccount } from "@/lib/api-client";
import { useAccess } from "@/lib/auth-context";
import { KeyRound, Plus } from "lucide-react";

const ROLE_LABEL: Record<UserAccount["role"], string> = {
  BOOTH_STAFF: "Barista",
  ADMIN: "Admin Pusat",
  OWNER: "Owner",
};

/// Petugas Booth SENGAJA tidak bisa dibuat dari sini — punya halaman
/// tersendiri (Data Operasional → Petugas) yang juga bisa aktif/nonaktifkan,
/// tidak cuma reset password seperti di sini. Dua jalur bikin satu akun sama
/// mungkin dikelola dari dua tempat berbeda. Akun Owner hanya dibuat Owner (BR-044).
const ROLE_OPTIONS_ADMIN = [{ value: "ADMIN", label: "Admin Pusat" }];
const ROLE_OPTIONS_OWNER = [...ROLE_OPTIONS_ADMIN, { value: "OWNER", label: "Owner" }];
const TANPA_PERAN = "";

function UserContent() {
  const toast = useToast();
  const { isOwner, canManage } = useAccess();
  const bolehKelolaAdmin = isOwner || canManage("USER");
  const [users, setUsers] = useState<UserAccount[] | null>(null);
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserAccount["role"]>("ADMIN");
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  // Petugas Booth dikelola di halaman tersendiri (Data Operasional →
  // Petugas) — di sini sengaja hanya menampilkan Admin/Owner.
  async function load() {
    try {
      const [userList, roleList] = await Promise.all([api.getUsers(), api.getAccessRoles()]);
      setUsers(userList.filter((u) => u.role !== "BOOTH_STAFF"));
      setRoles(roleList);
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
      await api.createUser({ username, password, fullName, role });
      toast.success(`User "${username}" berhasil dibuat.`);
      setModalOpen(false);
      setUsername("");
      setPassword("");
      setFullName("");
      setRole("ADMIN");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal membuat User.");
    } finally {
      setSaving(false);
    }
  }

  /// Hanya Owner (BR-044) — berlaku di request berikutnya Admin itu.
  async function handleAssignRole(u: UserAccount, accessRoleId: string) {
    setAssigningId(u.id);
    try {
      await api.assignAccessRole(u.id, accessRoleId === TANPA_PERAN ? null : accessRoleId);
      toast.success(`Peran "${u.username}" diperbarui.`);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal mengubah peran.");
    } finally {
      setAssigningId(null);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setResetting(true);
    try {
      await api.resetUserPassword(resetTarget.id, newPassword);
      toast.success(`Password "${resetTarget.username}" berhasil direset.`);
      setResetTarget(null);
      setNewPassword("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal reset password.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Master User</h1>
          <p className="text-sm text-slate-500 dark:text-fg-muted">
            Kelola akun login Admin &amp; Owner. Barista ada di Data Operasional → Barista.
          </p>
        </div>
        {bolehKelolaAdmin && (
          <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
            Tambah User
          </Button>
        )}
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
                <TableHead>Peran</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs">{u.username}</TableCell>
                  <TableCell className="font-semibold">{u.fullName}</TableCell>
                  <TableCell>{ROLE_LABEL[u.role]}</TableCell>
                  <TableCell>
                    {u.role !== "ADMIN" ? (
                      <span className="text-slate-400 dark:text-fg-muted">-</span>
                    ) : isOwner ? (
                      <div className="w-48">
                        <Select
                          options={[
                            { value: TANPA_PERAN, label: "Tanpa peran" },
                            ...roles.map((r) => ({ value: r.id, label: r.name })),
                          ]}
                          value={u.accessRole?.id ?? TANPA_PERAN}
                          onChange={(v) => handleAssignRole(u, v)}
                          disabled={assigningId === u.id}
                          sizeVariant="sm"
                        />
                      </div>
                    ) : u.accessRole ? (
                      u.accessRole.name
                    ) : (
                      <StatusBadge type="unpaid" label="Belum diberi peran" />
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge type={u.active ? "safe" : "inactive"} label={u.active ? "Aktif" : "Nonaktif"} />
                  </TableCell>
                  <TableCell>
                    {(u.role === "OWNER" ? isOwner : bolehKelolaAdmin) && (
                      <Button
                        variant="ghost"
                        leftIcon={<KeyRound className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setResetTarget(u);
                          setNewPassword("");
                        }}
                      >
                        Reset Password
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-8">
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
          {role === "ADMIN" && (
            <p className="text-xs text-slate-500 dark:text-fg-muted">
              Akun Admin baru belum bisa membuka menu apa pun sampai Owner memasang peran.
            </p>
          )}
          <Select
            label="Role"
            options={isOwner ? ROLE_OPTIONS_OWNER : ROLE_OPTIONS_ADMIN}
            value={role}
            onChange={(v) => setRole(v as UserAccount["role"])}
          />
          <Button type="submit" fullWidth isLoading={saving}>
            Simpan
          </Button>
        </form>
      </Modal>

      <Modal
        isOpen={resetTarget !== null}
        onClose={() => setResetTarget(null)}
        title={`Reset Password — ${resetTarget?.username ?? ""}`}
        size="sm"
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-fg-muted">
            Password baru untuk <span className="font-semibold">{resetTarget?.fullName}</span> berlaku langsung
            tanpa konfirmasi email — beri tahu user secara langsung.
          </p>
          <Input
            label="Password Baru"
            isPassword
            helperText="Minimal 6 karakter"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
          />
          <Button type="submit" fullWidth isLoading={resetting}>
            Reset Password
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
