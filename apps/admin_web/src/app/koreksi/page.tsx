"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  api,
  ApiError,
  REASON_CODE_OPTIONS,
  type ReconciliationCaseRecord,
  type TransactionCorrectionRecord,
} from "@/lib/api-client";
import { Search } from "lucide-react";

const ENTITY_LABELS: Record<string, string> = {
  sale: "Penjualan",
  payment: "Pembayaran",
  stock_distribution: "Distribusi Stok",
  stock_return: "Return Stok",
  stock_opname: "Stok Opname",
  stock_adjustment: "Adjustment Stok",
  restock_request: "Restock Booth",
  shift_session: "Shift",
};

const CORRECTION_TYPE_BADGE: Record<TransactionCorrectionRecord["correctionType"], { type: "expired" | "expiring_this_month" | "safe" | "inactive"; label: string }> = {
  VOID: { type: "expired", label: "Void / Batal" },
  REVISION: { type: "expiring_this_month", label: "Revisi" },
  RECOUNT: { type: "expiring_this_month", label: "Recount" },
  ADJUSTMENT: { type: "safe", label: "Adjustment" },
  PAYMENT_CORRECTION: { type: "inactive", label: "Koreksi Pembayaran" },
};

function reasonLabel(code: string) {
  return REASON_CODE_OPTIONS.find((o) => o.value === code)?.label ?? code;
}

function formatSnapshotValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return value.toLocaleString("id-ID");
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function ImpactSnapshotView({ snapshot }: { snapshot: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      {Object.entries(snapshot).map(([key, value]) => (
        <div key={key} className="rounded-xl border border-slate-200 dark:border-line px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-fg-muted font-semibold mb-1">{key}</p>
          {Array.isArray(value) ? (
            <div className="space-y-1">
              {value.map((row, i) => (
                <p key={i} className="text-xs text-slate-700 dark:text-fg font-mono">
                  {typeof row === "object" && row !== null
                    ? Object.entries(row as Record<string, unknown>)
                        .map(([k, v]) => `${k}: ${formatSnapshotValue(v)}`)
                        .join("  ·  ")
                    : formatSnapshotValue(row)}
                </p>
              ))}
              {value.length === 0 && <p className="text-xs text-slate-400">(kosong)</p>}
            </div>
          ) : typeof value === "object" && value !== null ? (
            <p className="text-xs text-slate-700 dark:text-fg font-mono">
              {Object.entries(value as Record<string, unknown>)
                .map(([k, v]) => `${k}: ${formatSnapshotValue(v)}`)
                .join("  ·  ")}
            </p>
          ) : (
            <p className="text-sm font-semibold text-slate-800 dark:text-fg">{formatSnapshotValue(value)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function KoreksiContent() {
  const toast = useToast();
  const [records, setRecords] = useState<TransactionCorrectionRecord[] | null>(null);
  const [cases, setCases] = useState<ReconciliationCaseRecord[] | null>(null);
  const [entityFilter, setEntityFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<TransactionCorrectionRecord | null>(null);

  async function loadCases() {
    try {
      setCases(await api.getReconciliationCases());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat Reconciliation Cases.");
    }
  }

  async function handleResolve(caseId: string, status: "RESOLVED" | "IGNORED") {
    try {
      await api.resolveReconciliationCase(caseId, { status });
      toast.success("Case berhasil diperbarui.");
      await loadCases();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memperbarui case.");
    }
  }

  useEffect(() => {
    api
      .getTransactionCorrections()
      .then(setRecords)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Gagal memuat Riwayat & Koreksi Data."));
    loadCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCases = (cases ?? []).filter((c) => c.status === "OPEN");

  const entityOptions = useMemo(() => {
    const types = new Set((records ?? []).map((r) => r.entityType));
    return [
      { value: "", label: "Semua Jenis" },
      ...[...types].map((t) => ({ value: t, label: ENTITY_LABELS[t] ?? t })),
    ];
  }, [records]);

  const filtered = (records ?? []).filter((r) => {
    if (entityFilter && r.entityType !== entityFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (r.entityLabel ?? "").toLowerCase().includes(q) ||
      r.createdBy.fullName.toLowerCase().includes(q) ||
      (r.reasonNote ?? "").toLowerCase().includes(q) ||
      reasonLabel(r.reasonCode).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Riwayat & Koreksi Data</h1>
        <p className="text-sm text-slate-500 dark:text-fg-muted">
          Audit trail seluruh void, revisi, recount, dan adjustment lintas modul — siapa mengoreksi, kapan, dan alasannya. Klik baris untuk lihat dampak.
        </p>
      </div>

      {openCases.length > 0 && (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Case</TableHead>
                <TableHead>Sumber</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Alasan</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {openCases.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-semibold">{c.caseNo}</TableCell>
                  <TableCell>{ENTITY_LABELS[c.sourceEntityType] ?? c.sourceEntityType}</TableCell>
                  <TableCell>
                    <StatusBadge
                      type={c.severity === "CRITICAL" ? "expired" : c.severity === "WARNING" ? "expiring_this_month" : "inactive"}
                      label={c.severity}
                    />
                  </TableCell>
                  <TableCell>{reasonLabel(c.reasonCode)}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="sm" onClick={() => handleResolve(c.id, "RESOLVED")}>
                      Tandai Selesai
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleResolve(c.id, "IGNORED")}>
                      Abaikan
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <div className="flex flex-wrap gap-4">
        <div className="w-56">
          <Select label="Jenis Transaksi" options={entityOptions} value={entityFilter} onChange={setEntityFilter} />
        </div>
        <div className="flex-1 min-w-[220px]">
          <Input
            label="Cari"
            placeholder="Nomor transaksi, nama petugas, atau alasan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
      </div>

      {!records ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Transaksi</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Alasan</TableHead>
                <TableHead>Oleh</TableHead>
                <TableHead>Waktu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetail(r)}>
                  <TableCell className="font-mono text-xs">{r.entityLabel ?? r.entityId.slice(0, 8)}</TableCell>
                  <TableCell className="font-semibold">{ENTITY_LABELS[r.entityType] ?? r.entityType}</TableCell>
                  <TableCell>
                    <StatusBadge type={CORRECTION_TYPE_BADGE[r.correctionType].type} label={CORRECTION_TYPE_BADGE[r.correctionType].label} />
                  </TableCell>
                  <TableCell>{reasonLabel(r.reasonCode)}</TableCell>
                  <TableCell>{r.createdBy.fullName}</TableCell>
                  <TableCell className="text-sm text-slate-500 dark:text-fg-muted">
                    {new Date(r.createdAt).toLocaleString("id-ID")}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                    {records.length === 0 ? "Belum ada koreksi tercatat." : "Tidak ada hasil yang cocok."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `Detail Koreksi — ${detail.entityLabel ?? detail.entityId.slice(0, 8)}` : ""} size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] uppercase text-slate-400 font-semibold">Jenis Transaksi</p>
                <p className="font-semibold text-slate-800 dark:text-fg">{ENTITY_LABELS[detail.entityType] ?? detail.entityType}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-slate-400 font-semibold">Aksi</p>
                <StatusBadge type={CORRECTION_TYPE_BADGE[detail.correctionType].type} label={CORRECTION_TYPE_BADGE[detail.correctionType].label} />
              </div>
              <div>
                <p className="text-[11px] uppercase text-slate-400 font-semibold">Alasan</p>
                <p className="font-semibold text-slate-800 dark:text-fg">{reasonLabel(detail.reasonCode)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-slate-400 font-semibold">Oleh</p>
                <p className="font-semibold text-slate-800 dark:text-fg">{detail.createdBy.fullName}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-slate-400 font-semibold">Waktu</p>
                <p className="text-slate-700 dark:text-fg">{new Date(detail.createdAt).toLocaleString("id-ID")}</p>
              </div>
              {detail.reasonNote && (
                <div>
                  <p className="text-[11px] uppercase text-slate-400 font-semibold">Catatan</p>
                  <p className="text-slate-700 dark:text-fg">{detail.reasonNote}</p>
                </div>
              )}
            </div>

            {(detail.originalVersionId || detail.replacementVersionId) && (
              <div className="rounded-xl bg-slate-50 dark:bg-elevated px-3 py-2 text-xs text-slate-600 dark:text-fg-muted">
                Riwayat Versi:{" "}
                {detail.originalVersionId && <span className="font-mono">V-lama {detail.originalVersionId.slice(0, 8)}</span>}
                {detail.originalVersionId && detail.replacementVersionId && " → "}
                {detail.replacementVersionId && <span className="font-mono">V-baru {detail.replacementVersionId.slice(0, 8)}</span>}
              </div>
            )}

            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-fg mb-2">Dampak (Before/After)</p>
              <ImpactSnapshotView snapshot={detail.impactSnapshot} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function KoreksiPage() {
  return (
    <RequireAuth>
      <KoreksiContent />
    </RequireAuth>
  );
}
