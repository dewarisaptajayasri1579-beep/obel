"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBadge, type StatusBadgeType } from "@/components/ui/StatusBadge";
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
import { QuantityStepperInline } from "@/components/warehouse/QuantityStepperInline";
import { api, ApiError, type RestockRequest } from "@/lib/api-client";
import { Check, X } from "lucide-react";

const STATUS_CONFIG: Record<RestockRequest["status"], { type: StatusBadgeType; label: string }> = {
  REQUESTED: { type: "expiring_next_month", label: "Menunggu" },
  APPROVED: { type: "safe", label: "Disetujui" },
  REJECTED: { type: "expired", label: "Ditolak" },
  CANCELLED: { type: "inactive", label: "Dibatalkan" },
};

function RestockContent() {
  const toast = useToast();
  const [requests, setRequests] = useState<RestockRequest[] | null>(null);
  const [approving, setApproving] = useState<RestockRequest | null>(null);
  const [approvedQty, setApprovedQty] = useState<Record<string, number>>({});
  const [rejecting, setRejecting] = useState<RestockRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setRequests(await api.getRestockRequests());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat permintaan restock.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openApprove(request: RestockRequest) {
    setApproving(request);
    setApprovedQty(Object.fromEntries(request.items.map((i) => [i.productId, i.qtyRequested])));
  }

  async function handleApprove() {
    if (!approving) return;
    setSaving(true);
    try {
      await api.approveRestockRequest(
        approving.id,
        approving.items.map((i) => ({ productId: i.productId, qtyApproved: approvedQty[i.productId] ?? i.qtyRequested })),
      );
      toast.success(`Restock "${approving.requestNo}" disetujui & dikirim.`);
      setApproving(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menyetujui restock.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReject() {
    if (!rejecting || !rejectReason.trim()) return;
    setSaving(true);
    try {
      await api.rejectRestockRequest(rejecting.id, rejectReason.trim());
      toast.success(`Restock "${rejecting.requestNo}" ditolak.`);
      setRejecting(null);
      setRejectReason("");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menolak restock.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Restock Booth</h1>
        <p className="text-sm text-slate-500 dark:text-fg-muted">
          Permintaan restock dari Petugas Booth. Approve akan langsung mengirim stok (jadi Distribusi baru).
        </p>
      </div>

      {!requests ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Request</TableHead>
                <TableHead>Booth</TableHead>
                <TableHead>Item Diminta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.requestNo}</TableCell>
                  <TableCell className="font-semibold">{r.booth.name}</TableCell>
                  <TableCell className="text-sm text-slate-500 dark:text-fg-muted">
                    {r.items.map((i) => `${i.product.name} x${i.qtyRequested}`).join(", ")}
                  </TableCell>
                  <TableCell>
                    <StatusBadge type={STATUS_CONFIG[r.status].type} label={STATUS_CONFIG[r.status].label} />
                  </TableCell>
                  <TableCell>
                    {r.status === "REQUESTED" && (
                      <div className="flex gap-2">
                        <Button size="sm" leftIcon={<Check className="w-3.5 h-3.5" />} onClick={() => openApprove(r)}>
                          Setujui
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          leftIcon={<X className="w-3.5 h-3.5" />}
                          onClick={() => setRejecting(r)}
                        >
                          Tolak
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                    Tidak ada permintaan restock yang menunggu.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Modal isOpen={!!approving} onClose={() => setApproving(null)} title={`Setujui Restock — ${approving?.requestNo}`} size="md">
        {approving && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-fg-muted">
              Booth: <span className="font-semibold text-slate-800 dark:text-fg">{approving.booth.name}</span>
            </p>
            <div className="space-y-2">
              {approving.items.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-line px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-fg">{item.product.name}</p>
                    <p className="text-xs text-slate-500 dark:text-fg-muted">Diminta: {item.qtyRequested} cup</p>
                  </div>
                  <QuantityStepperInline
                    value={approvedQty[item.productId] ?? item.qtyRequested}
                    onChange={(v) => setApprovedQty((prev) => ({ ...prev, [item.productId]: v }))}
                  />
                </div>
              ))}
            </div>
            <Button fullWidth isLoading={saving} onClick={handleApprove}>
              Setujui & Kirim
            </Button>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!rejecting} onClose={() => setRejecting(null)} title={`Tolak Restock — ${rejecting?.requestNo}`} size="sm">
        {rejecting && (
          <div className="space-y-4">
            <Input
              label="Alasan Penolakan"
              placeholder="mis. Stok Gudang tidak cukup"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              required
            />
            <Button fullWidth variant="danger" isLoading={saving} onClick={handleReject} disabled={!rejectReason.trim()}>
              Tolak Permintaan
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function RestockPage() {
  return (
    <RequireAuth>
      <RestockContent />
    </RequireAuth>
  );
}
