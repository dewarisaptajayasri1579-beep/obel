"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Truck, CheckCircle2, AlertTriangle, Warehouse } from "lucide-react";
import { api, ApiError, type Distribution } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { useHidePetugasNav } from "@/components/layout/PetugasShell";
import { TopBar } from "../_components/TopBar";
import { formatTanggalJakarta } from "../_lib/format";
import { OBBEL } from "../_lib/theme";

const GREEN = OBBEL.primaryDark;

type Tab = "SEMUA" | "MENUNGGU" | "SELESAI";

const STATUS_BADGE: Record<Distribution["status"], { label: string; bg: string; fg: string }> = {
  SENT: { label: "Menunggu Diterima", bg: "#FBEEDA", fg: OBBEL.accentOrange },
  RECEIVED: { label: "Selesai", bg: "#E4F3E9", fg: GREEN },
  DISCREPANCY: { label: "Selesai · Selisih", bg: "#FDEAEA", fg: OBBEL.accentRed },
  CANCELLED: { label: "Dibatalkan", bg: "#F1F5F9", fg: "#64748B" },
  DRAFT: { label: "Draft", bg: "#F1F5F9", fg: "#64748B" },
};

function TerimaStokContent() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [tab, setTab] = useState<Tab>("SEMUA");
  const [selected, setSelected] = useState<Distribution | null>(null);
  const [actualQty, setActualQty] = useState<Record<string, number>>({});
  const [catatan, setCatatan] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useHidePetugasNav(!!selected);

  async function load() {
    setLoading(true);
    try {
      const rows = await api.getMyDistributions();
      setDistributions(rows);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat daftar penerimaan stok.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (tab === "MENUNGGU") return distributions.filter((d) => d.status === "SENT");
    if (tab === "SELESAI") return distributions.filter((d) => d.status === "RECEIVED" || d.status === "DISCREPANCY");
    return distributions;
  }, [distributions, tab]);

  const jumlahMenunggu = distributions.filter((d) => d.status === "SENT").length;
  const jumlahSelesai = distributions.filter((d) => d.status === "RECEIVED" || d.status === "DISCREPANCY").length;

  function openDetail(d: Distribution) {
    setSelected(d);
    setActualQty(Object.fromEntries(d.items.map((i) => [i.productId, i.qtyReceived ?? i.qtySent])));
    setCatatan("");
  }

  async function handleConfirm() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.receiveDistribution(
        selected.id,
        selected.items.map((i) => ({ productId: i.productId, actualQty: actualQty[i.productId] ?? i.qtySent })),
      );
      toast.success("Penerimaan stok berhasil dikonfirmasi.");
      setSelected(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal konfirmasi penerimaan.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (selected) {
    const editable = selected.status === "SENT";
    return (
      <div className="min-h-screen bg-[#F7F9F6] pb-28">
        <TopBar title="Detail Penerimaan" back="/petugas/terima-stok" />
        <div className="p-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-extrabold text-slate-900">{selected.distributionNo}</p>
              <span
                className="text-[10px] font-bold rounded-full px-2.5 py-1"
                style={{ backgroundColor: STATUS_BADGE[selected.status].bg, color: STATUS_BADGE[selected.status].fg }}
              >
                {STATUS_BADGE[selected.status].label}
              </span>
            </div>
            <div className="text-xs text-slate-500 flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <Warehouse size={13} /> Dari Gudang Pusat
              </div>
              <p>
                Dikirim {selected.sentAt ? formatTanggalJakarta(selected.sentAt) : "-"} • {selected.items.length} item barang
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100">
            {selected.items.map((item) => {
              const qty = actualQty[item.productId] ?? item.qtySent;
              const selisih = qty - item.qtySent;
              return (
                <div key={item.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-slate-900">{item.productName}</p>
                    <p className="text-xs text-slate-500">Qty kirim: {item.qtySent}</p>
                  </div>
                  {editable ? (
                    <input
                      type="number"
                      min={0}
                      value={qty}
                      onChange={(e) =>
                        setActualQty((prev) => ({ ...prev, [item.productId]: Math.max(0, Number(e.target.value)) }))
                      }
                      className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-sm text-center"
                    />
                  ) : (
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{item.qtyReceived ?? "-"}</p>
                      {selisih !== 0 && <p className="text-[11px] font-semibold" style={{ color: OBBEL.accentRed }}>Selisih {selisih > 0 ? "+" : ""}{selisih}</p>}
                    </div>
                  )}
                  {selisih === 0 ? (
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                  ) : (
                    <AlertTriangle size={18} style={{ color: OBBEL.accentRed }} className="shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {editable && (
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan (jika ada selisih)..."
              rows={3}
              className="w-full mt-4 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          )}
        </div>

        {editable && (
          <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-4">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full max-w-md mx-auto flex items-center justify-center rounded-xl py-3.5 font-extrabold text-white disabled:opacity-60"
              style={{ backgroundColor: GREEN }}
            >
              {submitting ? <Spinner size="sm" color="white" /> : "Konfirmasi Penerimaan"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9F6]">
      <TopBar title="Terima Stok" back="/petugas" />
      <p className="px-4 -mt-1 text-xs text-slate-500">Kelola dan terima stok masuk ke booth Anda.</p>

      <div className="px-4 pt-3 flex gap-2">
        {([
          ["SEMUA", `Semua (${distributions.length})`],
          ["MENUNGGU", `Menunggu (${jumlahMenunggu})`],
          ["SELESAI", `Selesai (${jumlahSelesai})`],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="rounded-full px-3.5 py-2 text-xs font-bold"
            style={
              tab === key
                ? { backgroundColor: GREEN, color: "white" }
                : { backgroundColor: "white", color: "#475569", border: "1px solid #E2E8F0" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 flex flex-col gap-3">
        {filtered.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-10">Tidak ada data penerimaan stok di tab ini.</p>
        )}
        {filtered.map((d) => {
          const badge = STATUS_BADGE[d.status];
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => openDetail(d)}
              className="text-left rounded-2xl bg-white border border-slate-200 p-4 flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <Truck size={18} style={{ color: GREEN }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-sm text-slate-900">{d.distributionNo}</p>
                  <span className="text-[10px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap" style={{ backgroundColor: badge.bg, color: badge.fg }}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Dari Gudang Pusat</p>
                <p className="text-xs text-slate-500">
                  {d.sentAt ? formatTanggalJakarta(d.sentAt) : "-"} • {d.items.length} item barang
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TerimaStokPage() {
  return (
    <RequirePetugasAuth>
      <TerimaStokContent />
    </RequirePetugasAuth>
  );
}
