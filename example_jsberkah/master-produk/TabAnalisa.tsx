"use client"

import { Card, StatTile } from "@/components/ui"
import { formatRupiah } from "@/lib/format"
import { ReportFilterBar } from "@/components/laporan/ReportFilterBar"
import { Trophy, Coins, PackageX, ArrowRightLeft, Lightbulb, Store } from "lucide-react"
import { TabelGayaSales, type KolomGayaSales } from "@/components/TabelGayaSales"

export interface BarisPenjualanProduk {
  productId: string
  productCode: string
  productName: string
  unit: string
  qtyTerjual: number
  omzet: number
  margin: number
}

export interface BarisLaris {
  productId: string
  storeId: string
  storeName: string
  code: string
  name: string
  varian: string | null
  unit: string
  qtyTerjual: number
  omzet: number
  stok: number
}

export interface BarisMandek extends BarisLaris {
  nilaiMengendap: number
}

export interface BarisSaran {
  productId: string
  code: string
  name: string
  varian: string | null
  unit: string
  dariStoreName: string
  stokMandek: number
  nilaiMengendap: number
  keStoreName: string
  terjualDiTujuan: number
  stokDiTujuan: number
  saranQty: number
}

/** Tab "Analisa" di halaman Produk (Tahap 23 langkah 2).
 *
 *  Empat bagian, diurutkan dari yang paling sering mengubah keputusan:
 *  1. Terlaris vs paling untung — berdampingan, karena keduanya sering BUKAN produk yang sama
 *  2. Saran pemindahan — jawaban atas "Produk A mandek di Toko A tapi laris di toko lain"
 *  3. Laris per (produk, toko)
 *  4. Mandek per (produk, toko), diurut nilai rupiah yang mengendap
 *
 *  Sarannya MURNI rekomendasi (keputusan Owner): tidak ada tombol yang memindahkan stok, karena
 *  memang belum ada jalur tarik-barang-dari-toko di aplikasi ini — barang titipan cuma bisa
 *  keluar dari toko dengan cara terjual. Menyediakan tombol "Pindahkan" yang tidak benar-benar
 *  memindahkan apa pun jauh lebih berbahaya daripada tidak ada tombolnya sama sekali. */
export function TabAnalisa({
  byProduct,
  laris,
  mandek,
  saran,
  summary,
  from,
  to,
  businessTypeId,
  businessTypeOptions,
}: {
  byProduct: BarisPenjualanProduk[]
  laris: BarisLaris[]
  mandek: BarisMandek[]
  saran: BarisSaran[]
  summary: { jumlahMandek: number; nilaiMengendap: number; jumlahSaran: number }
  from: string
  to: string
  businessTypeId?: string
  businessTypeOptions: { value: string; label: string }[]
}) {
  const terlaris = [...byProduct].sort((a, b) => b.omzet - a.omzet).slice(0, 5)
  const palingUntung = [...byProduct].sort((a, b) => b.margin - a.margin).slice(0, 5)

  const kolomSaran: KolomGayaSales<BarisSaran>[] = [
    {
      key: "produk",
      header: "Produk",
      filterValue: (s) => `${s.name} ${s.code}`,
      cell: (s) => (
        <>
          <span className="font-mono text-[10px] font-bold mr-1.5 text-slate-500">{s.code}</span>
          <span className="font-medium text-slate-800 dark:text-fg">{s.name}</span>
          {s.varian && <span className="block text-[11px] text-slate-500 dark:text-fg-muted">{s.varian}</span>}
        </>
      ),
    },
    {
      key: "dari",
      header: "Dari (mandek)",
      filterValue: (s) => s.dariStoreName,
      cell: (s) => (
        <>
          <span className="text-rose-700 dark:text-rose-400 font-medium">{s.dariStoreName}</span>
          <span className="block text-[11px] text-slate-500 dark:text-fg-muted">
            {s.stokMandek.toLocaleString("id-ID")} {s.unit} diam, 0 terjual
          </span>
        </>
      ),
    },
    {
      key: "ke",
      header: "Ke (laku)",
      filterValue: (s) => s.keStoreName,
      cell: (s) => (
        <>
          <span className="text-emerald-700 dark:text-emerald-400 font-medium">{s.keStoreName}</span>
          <span className="block text-[11px] text-slate-500 dark:text-fg-muted">
            laku {s.terjualDiTujuan.toLocaleString("id-ID")} {s.unit} · sisa stok {s.stokDiTujuan.toLocaleString("id-ID")}
          </span>
        </>
      ),
    },
    {
      key: "saranQty",
      header: "Saran Pindah",
      align: "right",
      sortValue: (s) => s.saranQty,
      cell: (s) => (
        <span className="font-extrabold text-[#0544cc] dark:text-blue-400 tabular-nums">
          {s.saranQty.toLocaleString("id-ID")} {s.unit}
        </span>
      ),
    },
    {
      key: "nilaiMengendap",
      header: "Nilai Mengendap",
      align: "right",
      sortValue: (s) => s.nilaiMengendap,
      cell: (s) => <span className="font-bold text-slate-900 dark:text-fg tabular-nums">{formatRupiah(s.nilaiMengendap)}</span>,
    },
  ]

  return (
    <div className="space-y-5">
      <Card variant="solid" padding="md" className="!rounded-xl !shadow-2xs">
        <ReportFilterBar compact from={from} to={to} businessTypeId={businessTypeId} businessTypeOptions={businessTypeOptions} />
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label="Produk Mandek di Toko" value={`${summary.jumlahMandek} baris`} icon={PackageX} color={summary.jumlahMandek > 0 ? "rose" : "slate"} />
        <StatTile label="Nilai Mengendap" value={formatRupiah(summary.nilaiMengendap)} icon={Coins} color={summary.nilaiMengendap > 0 ? "amber" : "slate"} />
        <StatTile label="Saran Pemindahan" value={`${summary.jumlahSaran} saran`} icon={Lightbulb} color="blue" />
      </div>

      {/* 1 — TERLARIS vs PALING UNTUNG. Berdampingan karena justru perbedaannyalah isinya:
             produk yang paling laku sering bukan penyumbang untung terbesar. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card variant="panel" padding="lg">
          <Judul icon={Trophy} teks="5 Terlaris (omzet)" />
          <TabelRingkas
            baris={terlaris.map((p) => ({
              kunci: p.productId,
              nama: `${p.productName}`,
              kode: p.productCode,
              kanan: formatRupiah(p.omzet),
              bawah: `${p.qtyTerjual.toLocaleString("id-ID")} ${p.unit} terjual`,
            }))}
            kosong="Belum ada penjualan pada periode ini."
          />
        </Card>
        <Card variant="panel" padding="lg">
          <Judul icon={Coins} teks="5 Paling Untung (margin)" />
          <TabelRingkas
            baris={palingUntung.map((p) => ({
              kunci: p.productId,
              nama: `${p.productName}`,
              kode: p.productCode,
              kanan: formatRupiah(p.margin),
              bawah: `omzet ${formatRupiah(p.omzet)}`,
              merah: p.margin < 0,
            }))}
            kosong="Belum ada penjualan pada periode ini."
          />
        </Card>
      </div>

      {/* 2 — SARAN. Ditaruh tinggi karena inilah satu-satunya bagian yang menyarankan TINDAKAN. */}
      <Card variant="panel" padding="lg">
        <Judul icon={ArrowRightLeft} teks="Saran Pemindahan Stok" />
        <p className="text-[11px] text-slate-500 dark:text-fg-muted mb-3">
          Dasarnya sederhana supaya bisa dipercaya: barangnya <strong>ada</strong> di toko asal tapi periode ini <strong>tidak terjual sama sekali</strong>,
          sementara di toko tujuan produk yang sama laku <strong>dan stoknya sudah menipis</strong>. Jumlah yang disarankan dibatasi sebanyak yang laku di
          tujuan — mengirim semuanya cuma memindahkan masalah.
        </p>

        <TabelGayaSales
          kolom={kolomSaran}
          rows={saran}
          rowKey={(s) => `${s.productId}-${s.dariStoreName}-${s.keStoreName}`}
          pageSize={10}
          searchPlaceholder="Cari produk atau toko..."
          emptyMessage="Tidak ada saran untuk periode ini — tidak ada barang yang mandek di satu toko sekaligus laku di toko lain."
        />

        <p className="text-[11px] text-slate-500 dark:text-fg-muted mt-3">
          Ini <strong>saran, bukan perintah</strong> — tidak ada stok yang berpindah dari layar ini. Pemindahannya dikerjakan lewat alur biasa: tarik barang
          dari toko asal, lalu setor ke toko tujuan.
        </p>
      </Card>

      {/* 3 & 4 — rincian yang mendasari saran di atas. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card variant="panel" padding="lg">
          <Judul icon={Store} teks="Paling Laris per Toko" />
          <TabelPasangan
            baris={laris}
            kolomKanan="Terjual"
            nilai={(b) => `${b.qtyTerjual.toLocaleString("id-ID")} ${b.unit}`}
            bawah={(b) => `${b.storeName} · omzet ${formatRupiah(b.omzet)}`}
            kosong="Belum ada penjualan pada periode ini."
          />
        </Card>
        <Card variant="panel" padding="lg">
          <Judul icon={PackageX} teks="Mandek per Toko" />
          <TabelPasangan
            baris={mandek}
            kolomKanan="Diam"
            merah
            nilai={(b) => `${b.stok.toLocaleString("id-ID")} ${b.unit}`}
            bawah={(b) => `${b.storeName} · ${formatRupiah((b as BarisMandek).nilaiMengendap)} mengendap`}
            kosong="Tidak ada barang yang mandek — semua yang ada di toko ikut terjual."
          />
        </Card>
      </div>
    </div>
  )
}

const Judul: React.FC<{ icon: typeof Trophy; teks: string }> = ({ icon: Icon, teks }) => (
  <div className="flex items-center gap-2 mb-3">
    <Icon className="w-4 h-4 text-[#0544cc] dark:text-blue-400" />
    <h2 className="text-sm font-bold text-slate-800 dark:text-fg">{teks}</h2>
  </div>
)

function TabelRingkas({
  baris,
  kosong,
}: {
  baris: { kunci: string; nama: string; kode: string; kanan: string; bawah: string; merah?: boolean }[]
  kosong: string
}) {
  if (baris.length === 0) return <p className="text-xs text-slate-500 dark:text-fg-muted py-6 text-center">{kosong}</p>
  return (
    <div className="space-y-1.5">
      {baris.map((b, i) => (
        <div key={b.kunci} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-50/70 dark:bg-surface-hover/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-5 h-5 rounded-full bg-white dark:bg-surface border border-slate-200 dark:border-line text-[10px] font-black flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 dark:text-fg truncate">
                <span className="font-mono text-[10px] font-bold mr-1.5 text-slate-500">{b.kode}</span>
                {b.nama}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-fg-muted">{b.bawah}</p>
            </div>
          </div>
          <span className={`text-xs font-extrabold tabular-nums shrink-0 ${b.merah ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-fg"}`}>
            {b.kanan}
          </span>
        </div>
      ))}
    </div>
  )
}

function TabelPasangan({
  baris,
  kolomKanan,
  nilai,
  bawah,
  kosong,
  merah = false,
}: {
  baris: BarisLaris[]
  kolomKanan: string
  nilai: (b: BarisLaris) => string
  bawah: (b: BarisLaris) => string
  kosong: string
  merah?: boolean
}) {
  const kolom: KolomGayaSales<BarisLaris>[] = [
    {
      key: "produk",
      header: "Produk & Toko",
      filterValue: (b) => `${b.name} ${b.code} ${b.storeName}`,
      cell: (b) => (
        <>
          <span className="font-mono text-[10px] font-bold mr-1.5 text-slate-500">{b.code}</span>
          <span className="font-medium text-slate-800 dark:text-fg">{b.name}</span>
          {/* Varian & ukuran — inilah yang membedakan dua baris bernama sama. */}
          {b.varian && <span className="ml-1.5 text-[11px] text-slate-500 dark:text-fg-muted">({b.varian})</span>}
          <span className="block text-[11px] text-slate-500 dark:text-fg-muted">{bawah(b)}</span>
        </>
      ),
    },
    {
      key: "nilai",
      header: kolomKanan,
      align: "right",
      cell: (b) => (
        <span className={`font-extrabold tabular-nums ${merah ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-fg"}`}>{nilai(b)}</span>
      ),
    },
  ]

  return (
    <TabelGayaSales
      kolom={kolom}
      rows={baris}
      rowKey={(b) => `${b.productId}-${b.storeId}`}
      pageSize={10}
      searchPlaceholder="Cari produk atau toko..."
      emptyMessage={kosong}
    />
  )
}
