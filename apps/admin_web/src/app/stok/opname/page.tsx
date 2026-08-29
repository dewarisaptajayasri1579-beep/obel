"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/Textarea";
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
import {
  api,
  ApiError,
  REASON_CODE_OPTIONS,
  type Booth,
  type ReasonCode,
  type StockOpname,
} from "@/lib/api-client";
import { Plus, ClipboardCheck } from "lucide-react";

function statusBadgeType(status: StockOpname["status"]) {
  if (status === "CONFIRMED") return "safe" as const;
  if (status === "SUPERSEDED") return "inactive" as const;
  return "draft" as const;
}

function OpnameContent() {
  const toast = useToast();
  const [opnames, setOpnames] = useState<StockOpname[] | null>(null);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [starting, setStarting] = useState(false);
  const [locationType, setLocationType] = useState<"WAREHOUSE" | "BOOTH">("WAREHOUSE");
  const [boothId, setBoothId] = useState("");

  const [active, setActive] = useState<StockOpname | null>(null);
  const [actualByProduct, setActualByProduct] = useState<Record<string, number>>({});
  const [reasonCode, setReasonCode] = useState<ReasonCode>("WRONG_PHYSICAL_COUNT");
  const [reasonNote, setReasonNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      setOpnames(await api.getStockOpnames());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Stok Opname.");
    }
  }

  useEffect(() => {
    load();
    api.getBooths().then(setBooths).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStart() {
    setStarting(true);
    try {
      const opname = await api.startStockOpname({
        locationType,
        boothId: locationType === "BOOTH" ? boothId : undefined,
      });
      setActive(opname);
      setActualByProduct(Object.fromEntries(opname.items.map((i) => [i.productId, i.actualQty])));
      setReasonCode("WRONG_PHYSICAL_COUNT");
      setReasonNote("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memulai Stok Opname.");
    } finally {
      setStarting(false);
    }
  }

  async function handleConfirm() {
    if (!active) return;
    setSubmitting(true);
    try {
      await api.confirmStockOpname(active.id, {
        idempotencyKey: crypto.randomUUID(),
        items: active.items.map((i) => ({ productId: i.productId, actualQty: actualByProduct[i.productId] ?? i.actualQty })),
        reasonCode,
        reasonNote: reasonNote || undefined,
      });
      toast.success(`Stok Opname ${active.opnameNo} berhasil dikonfirmasi.`);
      setActive(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal konfirmasi Stok Opname.");
    } finally {
      setSubmitting(false);
    }
  }

  const totalDiscrepancy = active
    ? active.items.reduce((sum, i) => sum + Math.abs((actualByProduct[i.productId] ?? i.actualQty) - i.expectedQty), 0)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Stok Opname</h1>
          <p className="text-sm text-slate-500 dark:text-fg-muted">
            Hitung fisik Gudang atau Booth kapan saja untuk mencocokkan stok sistem dengan stok nyata.
          </p>
        </div>
      </div>

      {!active ? (
        <>
          <div className="rounded-2xl border border-slate-200 dark:border-line p-4 flex flex-wrap items-end gap-4">
            <div className="w-48">
              <Select
                label="Lokasi"
                options={[
                  { value: "WAREHOUSE", label: "Gudang Pusat" },
                  { value: "BOOTH", label: "Booth" },
                ]}
                value={locationType}
                onChange={(v) => setLocationType(v as "WAREHOUSE" | "BOOTH")}
              />
            </div>
            {locationType === "BOOTH" && (
              <div className="w-56">
                <Select
                  label="Pilih Booth"
                  placeholder="Pilih Booth"
                  options={booths.map((b) => ({ value: b.id, label: b.name }))}
                  value={boothId}
                  onChange={setBoothId}
                />
              </div>
            )}
            <Button
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleStart}
              isLoading={starting}
              disabled={locationType === "BOOTH" && !boothId}
            >
              Mulai Opname
            </Button>
          </div>

          {!opnames ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : (
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Opname</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Versi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dihitung Oleh</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opnames.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-semibold">{o.opnameNo}</TableCell>
                      <TableCell>{o.locationType === "WAREHOUSE" ? "Gudang Pusat" : o.booth?.name ?? "-"}</TableCell>
                      <TableCell>V{o.versionNo}</TableCell>
                      <TableCell>
                        <StatusBadge type={statusBadgeType(o.status)} label={o.status} />
                      </TableCell>
                      <TableCell>{o.countedBy.fullName}</TableCell>
                    </TableRow>
                  ))}
                  {opnames.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                        Belum ada Stok Opname.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-fg-muted">
            <ClipboardCheck className="w-4 h-4" />
            Snapshot {active.opnameNo} — {active.locationType === "WAREHOUSE" ? "Gudang Pusat" : active.booth?.name}
          </div>

          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead>Expected (Sistem)</TableHead>
                  <TableHead>Hitung Fisik (Actual)</TableHead>
                  <TableHead>Selisih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.items.map((item) => {
                  const actual = actualByProduct[item.productId] ?? item.actualQty;
                  const diff = actual - item.expectedQty;
                  return (
                    <TableRow key={item.productId}>
                      <TableCell className="font-semibold">{item.productName}</TableCell>
                      <TableCell>{item.expectedQty}</TableCell>
                      <TableCell>
                        <QuantityStepperInline
                          value={actual}
                          onChange={(v) => setActualByProduct((prev) => ({ ...prev, [item.productId]: v }))}
                        />
                      </TableCell>
                      <TableCell className={diff < 0 ? "text-red-500 font-semibold" : diff > 0 ? "text-emerald-500 font-semibold" : ""}>
                        {diff > 0 ? `+${diff}` : diff}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {totalDiscrepancy > 0 && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-4">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Ditemukan selisih — alasan wajib diisi sebelum konfirmasi.
              </p>
              <Select
                label="Alasan Selisih"
                options={REASON_CODE_OPTIONS}
                value={reasonCode}
                onChange={(v) => setReasonCode(v as ReasonCode)}
              />
              <Textarea
                label="Catatan (wajib jika alasan Lainnya)"
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder="Catatan tambahan..."
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={handleConfirm} isLoading={submitting}>
              Konfirmasi Opname
            </Button>
            <Button variant="secondary" onClick={() => setActive(null)}>
              Batal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StockOpnamePage() {
  return (
    <RequireAuth>
      <OpnameContent />
    </RequireAuth>
  );
}
