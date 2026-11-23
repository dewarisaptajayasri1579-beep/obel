"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, KeyRound, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import {
  api,
  ApiError,
  type AccessLevel,
  type AccessRole,
  type MenuCatalogItem,
  type MenuKey,
  type UserAccount,
} from "@/lib/api-client";

type Choice = AccessLevel | "NONE";
type Levels = Partial<Record<MenuKey, AccessLevel>>;

const CHOICES: { value: Choice; label: string }[] = [
  { value: "NONE", label: "Tanpa akses" },
  { value: "VIEW", label: "Lihat" },
  { value: "MANAGE", label: "Kelola" },
];
const CHOICE_LABEL: Record<Choice, string> = { NONE: "Tanpa akses", VIEW: "Lihat", MANAGE: "Kelola" };
const RANK: Record<Choice, number> = { NONE: 0, VIEW: 1, MANAGE: 2 };

/// Selected tone rises with the level, so "no access" never looks like "manage".
const SELECTED_TONE: Record<Choice, string> = {
  NONE: "bg-slate-200 text-slate-700 dark:bg-surface-hover dark:text-fg",
  VIEW: "bg-brand-100 text-(--brand-700) dark:bg-brand-500/20 dark:text-brand-300",
  MANAGE: "bg-(--brand-700) text-white",
};

interface Draft {
  id: string | null;
  name: string;
  description: string;
  levels: Levels;
  original: { name: string; description: string; levels: Levels };
}

type Step = "edit" | "review" | "discard";

interface Change {
  menu: MenuKey;
  label: string;
  from: Choice;
  to: Choice;
}

/// Peran & Hak Akses (BR-044), Owner only. A role gives each admin-web menu
/// Tanpa akses / Lihat / Kelola; it is assigned to Admins in Master User.
function RolesContent() {
  const toast = useToast();
  const [roles, setRoles] = useState<AccessRole[] | null>(null);
  const [menus, setMenus] = useState<MenuCatalogItem[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState<Step>("edit");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AccessRole | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  async function load() {
    try {
      const [roleList, menuList, userList] = await Promise.all([api.getAccessRoles(), api.getAccessMenus(), api.getUsers()]);
      setRoles(roleList);
      setMenus(menuList);
      setUsers(userList);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat Peran.");
      setRoles([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = useMemo(() => {
    const result: { group: string; items: MenuCatalogItem[] }[] = [];
    for (const m of menus) {
      const g = result.find((x) => x.group === m.group);
      if (g) g.items.push(m);
      else result.push({ group: m.group, items: [m] });
    }
    return result;
  }, [menus]);

  /// Admins per role, active first. Inactive accounts keep their role but cannot log in.
  const membersByRole = useMemo(() => {
    const map = new Map<string, UserAccount[]>();
    for (const u of users) {
      if (u.role !== "ADMIN" || !u.accessRole) continue;
      map.set(u.accessRole.id, [...(map.get(u.accessRole.id) ?? []), u]);
    }
    for (const list of map.values()) list.sort((a, b) => Number(b.active) - Number(a.active));
    return map;
  }, [users]);

  const changes = useMemo<Change[]>(() => {
    if (!draft) return [];
    const list: Change[] = [];
    for (const m of menus) {
      const from: Choice = draft.original.levels[m.key] ?? "NONE";
      const to: Choice = draft.levels[m.key] ?? "NONE";
      if (from !== to) list.push({ menu: m.key, label: m.label, from, to });
    }
    // Reductions first: they are what an Admin will notice right away.
    return list.sort((a, b) => Number(RANK[b.to] < RANK[b.from]) - Number(RANK[a.to] < RANK[a.from]));
  }, [draft, menus]);

  const identityChanged =
    !!draft && (draft.name.trim() !== draft.original.name || draft.description.trim() !== draft.original.description);
  const changeCount = changes.length + (identityChanged ? 1 : 0);
  const dirty = changeCount > 0;
  const editingMembers = draft?.id ? (membersByRole.get(draft.id) ?? []) : [];
  const activeEditingMembers = editingMembers.filter((u) => u.active);

  function openDraft(role: AccessRole | null) {
    const levels: Levels = role ? Object.fromEntries(role.permissions.map((p) => [p.menu, p.level])) : {};
    const original = { name: role?.name ?? "", description: role?.description ?? "", levels };
    setDraft({ id: role?.id ?? null, name: original.name, description: original.description, levels, original });
    setStep("edit");
    // New role: everything open. Existing role: groups start folded behind their summary.
    setOpenGroups(new Set(role ? [] : groups.map((g) => g.group)));
  }

  function toggleGroup(group: string) {
    setOpenGroups((s) => {
      const next = new Set(s);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  function setLevel(menu: MenuKey, choice: Choice) {
    setDraft((d) => {
      if (!d) return d;
      const levels = { ...d.levels };
      if (choice === "NONE") delete levels[menu];
      else levels[menu] = choice;
      return { ...d, levels };
    });
  }

  function setGroup(items: MenuCatalogItem[], choice: Choice) {
    for (const m of items) setLevel(m.key, choice);
  }

  function requestClose() {
    if (step === "review" || step === "discard") setStep("edit");
    else if (dirty && step === "edit") setStep("discard");
    else setDraft(null);
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!draft || !draft.name.trim()) return;
    // A role in use changes access for live Admins: show what changes and for whom first.
    if (step === "edit" && draft.id && activeEditingMembers.length > 0 && changes.length > 0) {
      setStep("review");
      return;
    }
    save();
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    const name = draft.name.trim();
    try {
      const input = {
        name,
        description: draft.description.trim() || undefined,
        permissions: Object.entries(draft.levels).map(([menu, level]) => ({ menu: menu as MenuKey, level: level as AccessLevel })),
      };
      if (draft.id) await api.updateAccessRole(draft.id, input);
      else await api.createAccessRole(input);
      const affected = activeEditingMembers.length;
      toast.success(affected > 0 ? `Peran "${name}" disimpan, berlaku untuk ${affected} Admin.` : `Peran "${name}" disimpan.`);
      setDraft(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan Peran.");
      setStep("edit");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteAccessRole(deleteTarget.id);
      toast.success(`Peran "${deleteTarget.name}" dihapus.`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menghapus Peran.");
    } finally {
      setDeleting(false);
    }
  }

  const deleteMembers = deleteTarget ? (membersByRole.get(deleteTarget.id) ?? []) : [];

  const footer =
    step === "discard" ? (
      <>
        <p className="mr-auto text-sm font-medium text-slate-700 dark:text-fg-secondary">Buang perubahan?</p>
        <Button variant="secondary" size="sm" onClick={() => setStep("edit")}>
          Kembali
        </Button>
        <Button variant="danger" size="sm" onClick={() => setDraft(null)}>
          Buang
        </Button>
      </>
    ) : step === "review" ? (
      <>
        <Button variant="secondary" size="sm" onClick={() => setStep("edit")} disabled={saving}>
          Kembali
        </Button>
        <Button size="sm" isLoading={saving} onClick={save}>
          Ya, simpan
        </Button>
      </>
    ) : (
      <>
        <Button variant="secondary" size="sm" onClick={requestClose}>
          Batal
        </Button>
        <Button type="submit" form="role-form" size="sm" isLoading={saving} disabled={!draft?.name.trim() || (!!draft?.id && !dirty)}>
          {draft?.id && dirty ? `Simpan ${changeCount} perubahan` : "Simpan Peran"}
        </Button>
      </>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-(--brand-700) dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-100 dark:border-brand-500/20 shadow-2xs">
            <KeyRound className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight">Peran &amp; Hak Akses</h1>
            <p className="text-xs text-slate-500 dark:text-fg-muted mt-0.5">
              Atur menu yang boleh dibuka Admin. Pasang peran ke Admin di Master User.
            </p>
          </div>
        </div>
        <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => openDraft(null)}>
          Tambah Peran
        </Button>
      </div>

      {!roles ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {roles.map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-fg flex items-center gap-1.5">
                    {r.fullAccess && <ShieldCheck className="w-4 h-4 text-(--brand-700) shrink-0" />}
                    <span className="truncate">{r.name}</span>
                  </p>
                  <MemberLine members={membersByRole.get(r.id) ?? []} />
                </div>
                {!r.fullAccess && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" title={`Ubah peran ${r.name}`} aria-label={`Ubah peran ${r.name}`} onClick={() => openDraft(r)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" title={`Hapus peran ${r.name}`} aria-label={`Hapus peran ${r.name}`} onClick={() => setDeleteTarget(r)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              {r.description && <p className="text-xs text-slate-600 dark:text-fg-secondary">{r.description}</p>}
              <dl className="divide-y divide-slate-100 dark:divide-line border-t border-slate-100 dark:border-line">
                {groups.map((g) => {
                  const levels: Levels = r.fullAccess
                    ? Object.fromEntries(g.items.map((m) => [m.key, "MANAGE"]))
                    : Object.fromEntries(r.permissions.map((p) => [p.menu, p.level]));
                  return (
                    <div key={g.group} className="flex items-start justify-between gap-3 py-2">
                      <dt className="text-xs text-slate-600 dark:text-fg-secondary pt-0.5">{g.group}</dt>
                      <dd>
                        <GroupSummary items={g.items} levels={levels} />
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={draft !== null}
        onClose={requestClose}
        closeOnBackdropClick={!dirty}
        title={step === "review" ? "Tinjau Perubahan" : draft?.id ? "Ubah Peran" : "Tambah Peran"}
        subtitle={draft?.id ? <MemberLine members={editingMembers} prefix="Dipakai oleh" className="text-sm mt-1" /> : undefined}
        size="lg"
        footer={draft ? footer : undefined}
      >
        {draft && step === "review" ? (
          <ReviewChanges changes={changes} members={activeEditingMembers} />
        ) : draft ? (
          <form id="role-form" onSubmit={submit} className="space-y-4">
            <Input label="Nama Peran" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required minLength={2} maxLength={60} />
            <Input
              label="Keterangan"
              helperText="Boleh dikosongkan."
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              maxLength={200}
            />
            <div className="space-y-4">
              {groups.map((g, gi) => {
                const open = openGroups.has(g.group);
                const groupChanged = g.items.some((m) => (draft.levels[m.key] ?? "NONE") !== (draft.original.levels[m.key] ?? "NONE"));
                return (
                  <div key={g.group} role="group" aria-labelledby={`group-${gi}`} className="rounded-xl border border-slate-200/80 dark:border-line overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-surface-hover/60">
                      <button
                        type="button"
                        onClick={() => toggleGroup(g.group)}
                        aria-expanded={open}
                        aria-controls={`group-body-${gi}`}
                        className="flex flex-1 min-w-0 items-start gap-2 text-left cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                      >
                        <ChevronDown
                          className={`w-4 h-4 mt-0.5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
                        />
                        <span className="flex flex-col gap-1 min-w-0 sm:flex-row sm:items-center sm:gap-2.5">
                          <span id={`group-${gi}`} className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-fg-secondary">
                            {g.group}
                            {groupChanged && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" aria-label="Diubah" />}
                          </span>
                          <GroupSummary items={g.items} levels={draft.levels} align="start" />
                        </span>
                      </button>
                      <select
                        aria-label={`Atur semua menu ${g.group}`}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) setGroup(g.items, e.target.value as Choice);
                        }}
                        className="h-8 rounded-lg border border-slate-200 dark:border-line bg-white dark:bg-surface px-2 text-xs font-semibold text-slate-600 dark:text-fg-secondary cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      >
                        <option value="">Atur semua</option>
                        {CHOICES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* Animated fold: the grid row goes 0fr -> 1fr, so the height follows the content. */}
                    <div
                      id={`group-body-${gi}`}
                      inert={!open}
                      className={`grid transition-[grid-template-rows] duration-250 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="divide-y divide-slate-100 dark:divide-line border-t border-slate-100 dark:border-line">
                          {g.items.map((m) => {
                            const current: Choice = draft.levels[m.key] ?? "NONE";
                            const changed = current !== (draft.original.levels[m.key] ?? "NONE");
                            return (
                              <div key={m.key} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                <span id={`menu-${m.key}`} className="flex items-center gap-2 text-sm text-slate-800 dark:text-fg">
                                  {m.label}
                                  {changed && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Diubah" aria-label="Diubah" />}
                                </span>
                                <LevelControl labelledBy={`menu-${m.key}`} value={current} onChange={(c) => setLevel(m.key, c)} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 dark:text-fg-muted">
              Perubahan berlaku langsung untuk Admin yang memakai peran ini. Tampilan &amp; Panduan Pengguna selalu terbuka.
            </p>
          </form>
        ) : null}
      </Modal>

      <Modal isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Hapus Peran" size="sm">
        <div className="space-y-4">
          {deleteMembers.length > 0 ? (
            <p className="text-sm text-slate-600 dark:text-fg-secondary">
              Peran <strong className="text-slate-800 dark:text-fg">{deleteTarget?.name}</strong> masih dipakai oleh{" "}
              {deleteMembers.map((u) => u.fullName).join(", ")}. Ganti peran mereka di Master User sebelum menghapus.
            </p>
          ) : (
            <p className="text-sm text-slate-600 dark:text-fg-secondary">
              Hapus peran <strong className="text-slate-800 dark:text-fg">{deleteTarget?.name}</strong>? Peran ini belum dipakai Admin mana pun.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>
              {deleteMembers.length > 0 ? "Tutup" : "Batal"}
            </Button>
            {deleteMembers.length > 0 ? (
              <Link href="/master/user">
                <Button size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                  Buka Master User
                </Button>
              </Link>
            ) : (
              <Button variant="danger" size="sm" isLoading={deleting} onClick={confirmDelete}>
                Hapus
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

/// "Dipakai oleh Admin Pusat, Admin Panduan · 1 nonaktif", or "Belum dipakai".
function MemberLine({ members, prefix = "Dipakai oleh", className = "text-xs mt-0.5" }: { members: UserAccount[]; prefix?: string; className?: string }) {
  const active = members.filter((u) => u.active);
  const inactive = members.length - active.length;
  const text =
    active.length > 0
      ? `${prefix} ${active.map((u) => u.fullName).join(", ")}`
      : members.length > 0
        ? "Hanya dipakai akun nonaktif"
        : "Belum dipakai Admin mana pun";
  return (
    <p className={`${className} text-slate-500 dark:text-fg-muted`}>
      {text}
      {active.length > 0 && inactive > 0 && <span className="text-slate-400 dark:text-fg-muted"> · {inactive} nonaktif</span>}
    </p>
  );
}

/// Tanpa akses / Lihat / Kelola as a radio group: one tab stop, arrow keys move.
function LevelControl({ labelledBy, value, onChange }: { labelledBy: string; value: Choice; onChange: (c: Choice) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = CHOICES.findIndex((c) => c.value === value);

  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + CHOICES.length) % CHOICES.length;
    onChange(CHOICES[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      className="grid grid-cols-3 w-full sm:w-auto sm:inline-grid sm:shrink-0 rounded-lg border border-slate-200 dark:border-line overflow-hidden"
    >
      {CHOICES.map((c, i) => {
        const selected = c.value === value;
        return (
          <button
            key={c.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(c.value)}
            className={`min-h-10 sm:min-h-0 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${
              i > 0 ? "border-l border-slate-200 dark:border-line" : ""
            } ${
              selected
                ? SELECTED_TONE[c.value]
                : "bg-white dark:bg-surface text-slate-500 dark:text-fg-muted hover:bg-slate-50 dark:hover:bg-surface-hover"
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

/// Second step when saving a role in use: who is affected and what changes, reductions first.
function ReviewChanges({ changes, members }: { changes: Change[]; members: UserAccount[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-fg-secondary">
        Perubahan ini langsung berlaku untuk <strong className="text-slate-800 dark:text-fg">{members.map((u) => u.fullName).join(", ")}</strong>.
      </p>
      <ul className="divide-y divide-slate-100 dark:divide-line rounded-xl border border-slate-200/80 dark:border-line">
        {changes.map((c) => {
          const reduced = RANK[c.to] < RANK[c.from];
          return (
            <li key={c.menu} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="text-sm text-slate-800 dark:text-fg">{c.label}</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold shrink-0">
                <span className="text-slate-400 dark:text-fg-muted">{CHOICE_LABEL[c.from]}</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className={reduced ? "text-amber-700 dark:text-amber-400" : "text-(--brand-700) dark:text-brand-400"}>{CHOICE_LABEL[c.to]}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function PeranPage() {
  return (
    <RequireAuth>
      <RolesContent />
    </RequireAuth>
  );
}

/// One group's access in chips: "Kelola" when every menu shares a level,
/// otherwise a count per level ("2 Kelola", "1 Tanpa akses"). Same tones as the editor.
function GroupSummary({ items, levels, align = "end" }: { items: MenuCatalogItem[]; levels: Levels; align?: "start" | "end" }) {
  const counts: Record<Choice, number> = { MANAGE: 0, VIEW: 0, NONE: 0 };
  for (const m of items) counts[levels[m.key] ?? "NONE"]++;
  const present = (["MANAGE", "VIEW", "NONE"] as Choice[]).filter((c) => counts[c] > 0);
  return (
    <span className={`flex flex-wrap gap-1 ${align === "end" ? "justify-end" : "justify-start"}`}>
      {present.map((c) => (
        <span key={c} className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${SELECTED_TONE[c]}`}>
          {present.length === 1 ? CHOICE_LABEL[c] : `${counts[c]} ${CHOICE_LABEL[c]}`}
        </span>
      ))}
    </span>
  );
}
