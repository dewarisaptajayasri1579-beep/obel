"use client";

import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Button } from "@/components/ui/Button";
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

const ENTITY_LABELS: Record<string, string> = {
  sale: "Penjualan",
  payment: "Pembayaran",
  stock_distribution: "Distribusi Stok",
  stock_return: "Return Stok",
  stock_opname: "Stok Opname",
  stock_adjustment: "Adjustment Stok",
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

function KoreksiContent() {
  const toast = useToast();
  const [records, setRecords] = useState<TransactionCorrectionRecord[] | null>(null);
  const [cases, setCases] = useState<ReconciliationCaseRecord[] | null>(null);
  const [entityFilter, setEntityFilter] = useState<string>("");

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

  const filtered = (records ?? []).filter((r) => !entityFilter || r.entityType === entityFilter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Riwayat & Koreksi Data</h1>
        <p className="text-sm text-slate-500 dark:text-fg-muted">
          Audit trail seluruh void, revisi, recount, dan adjustment lintas modul — siapa mengoreksi, kapan, dan alasannya.
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

      <div className="w-56">
        <Select label="Jenis Transaksi" options={entityOptions} value={entityFilter} onChange={setEntityFilter} />
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
                <TableHead>Jenis</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Alasan</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead>Oleh</TableHead>
                <TableHead>Waktu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-semibold">{ENTITY_LABELS[r.entityType] ?? r.entityType}</TableCell>
                  <TableCell>
                    <StatusBadge type={CORRECTION_TYPE_BADGE[r.correctionType].type} label={CORRECTION_TYPE_BADGE[r.correctionType].label} />
                  </TableCell>
                  <TableCell>{reasonLabel(r.reasonCode)}</TableCell>
                  <TableCell className="text-sm text-slate-500 dark:text-fg-muted">{r.reasonNote ?? "-"}</TableCell>
                  <TableCell>{r.createdBy.fullName}</TableCell>
                  <TableCell className="text-sm text-slate-500 dark:text-fg-muted">
                    {new Date(r.createdAt).toLocaleString("id-ID")}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                    Belum ada koreksi tercatat.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
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
