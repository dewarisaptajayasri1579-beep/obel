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
import { useAccess, useAuth } from "@/lib/auth-context";
import { KeyRound, Plus, Power } from "lucide-react";

/// Petugas Booth SENGAJA tidak bisa dibuat dari sini — punya halaman
/// tersendiri (Data Operasional → Petugas) yang juga bisa aktif/nonaktifkan,
/// tidak cuma reset password seperti di sini. Dua jalur bikin satu akun sama
/// mungkin dikelola dari dua tempat berbeda.
///
/// Dari sudut pandang pengguna cuma ada satu pilihan: "Peran". Owner memilih Owner (akun Owner)
/// atau salah satu peran akses (akun Admin); jenis akun diturunkan dari pilihan itu (BR-044).
const TANPA_PERAN = "";
const PERAN_OWNER = "OWNER";

function UserContent() {
  const toast = useToast();
  const { isOwner, canManage } = useAccess();
  const bolehKelolaAdmin = isOwner || canManage("USER");
  const { session } = useAuth();
  const [users, setUsers] = useState<UserAccount[] | null>(null);
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [peran, setPeran] = useState(TANPA_PERAN);
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [nonaktifTarget, setNonaktifTarget] = useState<UserAccount | null>(null);

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
      await api.createUser({
        username,
        password,
        fullName,
        role: peran === PERAN_OWNER ? "OWNER" : "ADMIN",
        accessRoleId: peran && peran !== PERAN_OWNER ? peran : undefined,
      });
      toast.success(`User "${username}" berhasil dibuat.`);
      setModalOpen(false);
      setUsername("");
      setPassword("");
      setFullName("");
      setPeran(TANPA_PERAN);
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

  /// Akun nonaktif langsung ditolak di request berikutnya (token lama tidak berlaku, BR-044).
  async function ubahStatus(u: UserAccount) {
    setTogglingId(u.id);
    try {
      await api.updateUser(u.id, { active: !u.active });
      toast.success(`User "${u.username}" ${u.active ? "dinonaktifkan" : "diaktifkan"}.`);
      setNonaktifTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal mengubah status User.");
    } finally {
      setTogglingId(null);
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
                  <TableCell>
                    {u.role !== "ADMIN" ? (
                      <span className="font-semibold">{u.role === "OWNER" ? "Owner" : "Barista"}</span>
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
                      <div className="flex items-center gap-1">
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
                        {/* Akun sendiri tidak bisa dinonaktifkan (backend juga menolak). */}
                        {u.id !== session?.profile.id && (
                          <Button
                            variant="ghost"
                            leftIcon={<Power className="w-3.5 h-3.5" />}
                            isLoading={togglingId === u.id}
                            onClick={() => (u.active ? setNonaktifTarget(u) : ubahStatus(u))}
                          >
                            {u.active ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                        )}
                      </div>
                    )}
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

      <Modal
        isOpen={nonaktifTarget !== null}
        onClose={() => setNonaktifTarget(null)}
        title="Nonaktifkan User"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-fg-secondary">
            Nonaktifkan <strong className="text-slate-800 dark:text-fg">{nonaktifTarget?.username}</strong>? Akun ini
            langsung keluar dari aplikasi dan tidak bisa masuk lagi sampai diaktifkan kembali. Datanya tetap tersimpan.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setNonaktifTarget(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={togglingId !== null}
              onClick={() => nonaktifTarget && ubahStatus(nonaktifTarget)}
            >
              Nonaktifkan
            </Button>
          </div>
        </div>
      </Modal>

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
          {isOwner ? (
            <Select
              label="Peran"
              options={[
                { value: TANPA_PERAN, label: "Tanpa peran (atur nanti)" },
                ...roles.map((r) => ({ value: r.id, label: r.name })),
                { value: PERAN_OWNER, label: "Owner" },
              ]}
              value={peran}
              onChange={setPeran}
            />
          ) : null}
          <p className="text-xs text-slate-500 dark:text-fg-muted">
            {peran === PERAN_OWNER
              ? "Owner melihat semua menu (hanya baca) dan satu-satunya yang mengatur peran."
              : peran
                ? "Hak akses akun ini mengikuti peran yang dipilih."
                : "Akun belum bisa membuka menu apa pun sampai Owner memasang peran."}
          </p>
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
