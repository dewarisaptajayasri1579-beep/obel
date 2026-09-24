"use client";

import React, { Fragment, useEffect, useMemo, useState } from "react";
import { Truck, CheckCircle2, AlertTriangle, Warehouse, Circle } from "lucide-react";
import { api, ApiError, type Distribution, type DistributionItem } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { useHidePetugasNav } from "@/components/layout/PetugasShell";
import { TopBar } from "../_components/TopBar";
import { QtyStepper } from "../_components/QtyStepper";
import { formatTanggalJakarta } from "../_lib/format";
import { OBBEL, OBBEL_SCALE } from "../_lib/theme";

const GREEN = OBBEL.primaryDark;
const TANPA_KATEGORI = "Tanpa Kategori";

/// Kelompokkan item DistributionItem berdasarkan Kategori produk (abjad,
/// "Tanpa Kategori" di akhir), produk dalam tiap Kategori diurutkan abjad —
/// sama pola dengan kelompokKategori di admin_web/serah-terima-stok/page.tsx.
function kelompokKategori(items: DistributionItem[]): { nama: string; rows: DistributionItem[] }[] {
  const perKategori = new Map<string, DistributionItem[]>();
  for (const item of items) {
    const kunci = item.productCategory ?? TANPA_KATEGORI;
    if (!perKategori.has(kunci)) perKategori.set(kunci, []);
    perKategori.get(kunci)!.push(item);
  }
  for (const rows of perKategori.values()) rows.sort((a, b) => a.productName.localeCompare(b.productName, "id"));
  return Array.from(perKategori.entries())
    .map(([nama, rows]) => ({ nama, rows }))
    .sort((a, b) => {
      if (a.nama === TANPA_KATEGORI) return 1;
      if (b.nama === TANPA_KATEGORI) return -1;
      return a.nama.localeCompare(b.nama, "id");
    });
}

type AlasanKode = "LEBIH" | "KURANG" | "RUSAK" | "LAINNYA";

const ALASAN_LABEL: Record<AlasanKode, string> = {
  LEBIH: "Stok Lebih",
  KURANG: "Stok Kurang",
  RUSAK: "Rusak",
  LAINNYA: "Lainnya",
};

/// Qty Terima < Qty Kirim: kemungkinan penyebabnya cuma "memang kurang" atau
/// "rusak" (barang ada tapi tidak layak dihitung); Qty Terima > Qty Kirim:
/// cuma "kelebihan kiriman" yang masuk akal — "Rusak"/"Kurang" tidak relevan
/// buat arah selisih plus.
function alasanUntukSelisih(selisih: number): AlasanKode[] {
  if (selisih < 0) return ["KURANG", "RUSAK", "LAINNYA"];
  return ["LEBIH", "LAINNYA"];
}

interface AlasanSelisih {
  kode: AlasanKode;
  catatan: string;
}

type Tab = "SEMUA" | "MENUNGGU" | "SELESAI";

const STATUS_BADGE: Record<Distribution["status"], { label: string; bg: string; fg: string }> = {
  SENT: { label: "Menunggu Diterima", bg: "#FBEEDA", fg: OBBEL.accentOrange },
  RECEIVED: { label: "Selesai", bg: OBBEL_SCALE[50], fg: GREEN },
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
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [alasanSelisih, setAlasanSelisih] = useState<Record<string, AlasanSelisih>>({});
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
    setChecklist({});
    setAlasanSelisih({});
  }

  const produkSelisih = selected
    ? selected.items.filter((i) => (actualQty[i.productId] ?? i.qtySent) !== i.qtySent)
    : [];
  const adaSelisih = produkSelisih.length > 0;
  const semuaDicentang = selected ? selected.items.every((i) => checklist[i.productId]) : false;
  const semuaAlasanTerisi = produkSelisih.every((i) => {
    const alasan = alasanSelisih[i.productId];
    if (!alasan) return false;
    const selisih = (actualQty[i.productId] ?? i.qtySent) - i.qtySent;
    if (!alasanUntukSelisih(selisih).includes(alasan.kode)) return false;
    return alasan.kode !== "LAINNYA" || alasan.catatan.trim().length > 0;
  });
  const bisaKonfirmasi = semuaDicentang && semuaAlasanTerisi;

  function buildCatatanSelisih(): string | undefined {
    if (produkSelisih.length === 0) return undefined;
    return produkSelisih
      .map((i) => {
        const alasan = alasanSelisih[i.productId];
        const label = alasan ? ALASAN_LABEL[alasan.kode] : "-";
        const detail = alasan?.kode === "LAINNYA" && alasan.catatan.trim() ? `: ${alasan.catatan.trim()}` : "";
        return `${i.productName} — ${label}${detail}`;
      })
      .join("; ");
  }

  async function handleConfirm() {
    if (!selected || !bisaKonfirmasi) return;
    setSubmitting(true);
    try {
      await api.receiveDistribution(
        selected.id,
        selected.items.map((i) => {
          const alasan = alasanSelisih[i.productId];
          return {
            productId: i.productId,
            actualQty: actualQty[i.productId] ?? i.qtySent,
            reasonCode: alasan?.kode,
            reasonNote: alasan?.kode === "LAINNYA" ? alasan.catatan.trim() : undefined,
          };
        }),
        buildCatatanSelisih(),
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
        <TopBar title="Detail Penerimaan" onBack={() => setSelected(null)} />
        <div className="p-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-extrabold text-slate-900">{selected.distributionNo}</p>
              <span
                className="text-xs font-bold rounded-full px-2.5 py-1"
                style={{ backgroundColor: STATUS_BADGE[selected.status].bg, color: STATUS_BADGE[selected.status].fg }}
              >
                {STATUS_BADGE[selected.status].label}
              </span>
            </div>
            <div className="text-sm text-slate-500 flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <Warehouse size={13} /> Dari Gudang Pusat
              </div>
              <p>
                Dikirim {selected.sentAt ? formatTanggalJakarta(selected.sentAt) : "-"} • {selected.items.length} item barang
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
            {kelompokKategori(selected.items).map((k) => (
              <Fragment key={k.nama}>
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{k.nama}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {k.rows.map((item) => {
                    const qty = actualQty[item.productId] ?? item.qtySent;
                    const selisih = qty - item.qtySent;
                    const dicentang = !!checklist[item.productId];
                    const alasan = alasanSelisih[item.productId];
                    return (
                      <div key={item.id} className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-base text-slate-900">{item.productName}</p>
                          <p className="text-sm text-slate-500">Qty kirim: {item.qtySent}</p>
                        </div>
                        {editable ? (
                          <div className="flex flex-col items-end gap-1">
                            <QtyStepper
                              value={qty}
                              highlighted={selisih !== 0}
                              onChange={(n) => setActualQty((prev) => ({ ...prev, [item.productId]: n }))}
                            />
                            {selisih !== 0 && (
                              <span className="text-xs font-semibold" style={{ color: OBBEL.accentRed }}>
                                Selisih {selisih > 0 ? "+" : ""}{selisih}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-right">
                            <p className="text-base font-bold text-slate-900">{item.qtyReceived ?? "-"}</p>
                            {selisih !== 0 && <p className="text-sm font-semibold" style={{ color: OBBEL.accentRed }}>Selisih {selisih > 0 ? "+" : ""}{selisih}</p>}
                          </div>
                        )}
                        {editable ? (
                          <button
                            type="button"
                            onClick={() => setChecklist((prev) => ({ ...prev, [item.productId]: !prev[item.productId] }))}
                            aria-pressed={dicentang}
                            aria-label={dicentang ? "Batalkan centang" : "Centang sudah dicek"}
                            className="shrink-0"
                          >
                            {dicentang ? (
                              <CheckCircle2 size={22} className="text-emerald-500" />
                            ) : (
                              <Circle size={22} className="text-slate-300" />
                            )}
                          </button>
                        ) : selisih === 0 ? (
                          <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                        ) : (
                          <AlertTriangle size={18} style={{ color: OBBEL.accentRed }} className="shrink-0" />
                        )}
                      </div>

                      {editable && selisih !== 0 && (
                        <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
                          <p className="text-sm font-semibold text-slate-500 mb-1.5">Kenapa selisih?</p>
                          <div className="flex flex-wrap gap-1.5">
                            {alasanUntukSelisih(selisih).map((kode) => {
                              const aktif = alasan?.kode === kode;
                              return (
                                <button
                                  key={kode}
                                  type="button"
                                  onClick={() =>
                                    setAlasanSelisih((prev) => ({
                                      ...prev,
                                      [item.productId]: { kode, catatan: prev[item.productId]?.catatan ?? "" },
                                    }))
                                  }
                                  className="text-sm font-bold rounded-full px-3 py-2"
                                  style={
                                    aktif
                                      ? { backgroundColor: GREEN, color: "white" }
                                      : { backgroundColor: "white", color: "#475569", border: "1px solid #E2E8F0" }
                                  }
                                >
                                  {ALASAN_LABEL[kode]}
                                </button>
                              );
                            })}
                          </div>
                          {alasan?.kode === "LAINNYA" && (
                            <input
                              type="text"
                              value={alasan.catatan}
                              onChange={(e) =>
                                setAlasanSelisih((prev) => ({
                                  ...prev,
                                  [item.productId]: { kode: "LAINNYA", catatan: e.target.value },
                                }))
                              }
                              placeholder="Tulis alasan selisih..."
                              className="w-full mt-2 rounded-lg border border-slate-200 px-3 py-2.5 text-base"
                            />
                          )}
                        </div>
                      )}
                      </div>
                    );
                  })}
                </div>
              </Fragment>
            ))}
          </div>

          {editable && !bisaKonfirmasi && (
            <p className="text-sm mt-4" style={{ color: OBBEL.accentRed }}>
              {!semuaDicentang
                ? "Centang semua produk yang sudah dicek fisik sebelum konfirmasi."
                : "Pilih alasan selisih untuk tiap produk yang Qty Terima-nya berbeda dari Qty Kirim."}
            </p>
          )}
        </div>

        {editable && (
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 p-4">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || !bisaKonfirmasi}
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
      <p className="px-4 -mt-1 text-sm text-slate-500">Kelola dan terima stok masuk ke booth Anda.</p>

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
            className="rounded-full px-3.5 py-2.5 text-sm font-bold"
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
          <p className="text-base text-slate-500 text-center py-10">Tidak ada data penerimaan stok di tab ini.</p>
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
                  <p className="font-bold text-base text-slate-900">{d.distributionNo}</p>
                  <span className="text-xs font-bold rounded-full px-2 py-0.5 whitespace-nowrap" style={{ backgroundColor: badge.bg, color: badge.fg }}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">Dari Gudang Pusat</p>
                <p className="text-sm text-slate-500">
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
