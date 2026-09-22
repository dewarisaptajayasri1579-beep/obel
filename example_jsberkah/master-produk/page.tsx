import { Breadcrumb } from "@/components/ui"
import { requirePageRole } from "@/lib/current-user"
import { getAccessToken } from "@/lib/session"
import { backendFetch } from "@/lib/backend-client"
import { resolveReportPeriod } from "@/lib/report-period"
import { TautanArsip } from "@/components/TautanArsip"
import { ProdukPanel } from "./ProdukPanel"
import { ProdukTabs } from "./ProdukTabs"
import { TabRankingPenjualan, type BarisRanking } from "./TabRankingPenjualan"
import { TabMutasiStok, type BarisBulan, type BarisLokasi, type BarisRekapSemuaProduk, type RiwayatMutasiLokasi } from "./TabMutasiStok"
import { TabAnalisa, type BarisLaris, type BarisMandek, type BarisSaran } from "./TabAnalisa"
import {
  TabSebaran,
  type BarisSebaranToko,
  type BarisSebaranSales,
  type BarisSebaranArea,
  type BarisSebaranKabupaten,
  type BarisRekapSebaranProduk,
} from "./TabSebaran"
import type { ProductDto, BusinessTypeDto, RingkasStokResponse } from "./types"
import { keBarisProduk } from "./types"

interface StoreDto { id: string; name: string }
interface WarehouseDto { id: string; name: string; isActive: boolean }
interface UserDto { id: string; name: string; role: string }
interface MutasiBulananReport {
  produk: { id: string; code: string; name: string; unit: string }[]
  hargaCampuran: boolean
  bulan: BarisBulan[]
  perLokasi: BarisLokasi[]
  summary: { saldoAkhir: number; nilaiPersediaan: number; nilaiPotensi: number }
}
interface SaranReport {
  laris: BarisLaris[]
  mandek: BarisMandek[]
  saran: BarisSaran[]
  summary: { jumlahPasangan: number; jumlahMandek: number; nilaiMengendap: number; jumlahSaran: number }
}
interface SebaranReport {
  product: { id: string; code: string; name: string; unit: string } | null
  perToko: BarisSebaranToko[]
  perSales: BarisSebaranSales[]
  perArea: BarisSebaranArea[]
  perKabupaten: BarisSebaranKabupaten[]
  summary: { totalStok: number; totalStokSales: number; totalTerjual: number; totalOmzet: number; jumlahToko: number }
}
interface AnalisaPenjualanReport {
  summary: { totalQty: number; totalOmzet: number; totalMargin: number }
  byProduct: BarisRanking[]
}

export default async function MasterProdukPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string
    to?: string
    storeId?: string
    businessTypeId?: string
    tab?: string
    produkId?: string
    lokasiTipe?: string
    lokasiId?: string
  }>
}) {
  const user = await requirePageRole(["owner", "admin"])
  const sp = await searchParams
  const accessToken = await getAccessToken()
  // Periode untuk tab Ranking. Bawaannya bulan berjalan (`resolveReportPeriod`, sama dengan
  // seluruh laporan lain) — jangan dibikin bawaan sendiri, nanti angka di tab ini tidak pernah
  // cocok dengan halaman laporan yang dibuka berdampingan.
  const period = resolveReportPeriod(sp)

  const [products, businessTypes, stok, stores, gudangList, users, ranking, analisa] = await Promise.all([
    backendFetch<ProductDto[]>("/produk", { accessToken }),
    backendFetch<BusinessTypeDto[]>("/business-types", { accessToken }),
    // Stok sifatnya pelengkap kolom — kalau gagal diambil, daftar produknya tetap terbit dengan
    // stok 0 daripada seluruh halaman ikut gagal.
    backendFetch<RingkasStokResponse>("/stock/produk/ringkas", { accessToken }).catch(() => null),
    backendFetch<StoreDto[]>("/toko", { accessToken }).catch(() => []),
    // Gudang & Sales — opsi pemilih lokasi di tab Mutasi Stok → Rinci → Riwayat Keluar-Masuk.
    backendFetch<WarehouseDto[]>("/gudang", { accessToken }).catch(() => []),
    backendFetch<UserDto[]>("/users", { accessToken }).catch(() => []),
    // Endpoint yang SAMA dengan halaman Laporan > Analisa Penjualan — satu sumber angka.
    backendFetch<AnalisaPenjualanReport>(
      `/analisa/penjualan?${new URLSearchParams({ from: period.fromStr, to: period.toStr, ...(sp.storeId ? { storeId: sp.storeId } : {}) })}`,
      { accessToken },
    ).catch(() => null),
    // Analisa laris/mandek/saran — endpoint terpisah karena pertanyaannya per (produk, toko),
    // bukan per produk seperti /analisa/penjualan.
    backendFetch<SaranReport>(
      `/analisa/saran-produk?${new URLSearchParams({ from: period.fromStr, to: period.toStr, ...(sp.businessTypeId ? { businessTypeId: sp.businessTypeId } : {}) })}`,
      { accessToken },
    ).catch(() => null),
  ])
  const stokPerProduk = new Map((stok?.rows ?? []).map((s) => [s.productId, s]))
  // Baris "Rekap" (semua produk sekaligus) di tab Mutasi Stok & Sebaran — dibangun dari data
  // yang SUDAH ditarik di atas (stok & ranking), bukan panggilan API baru. `ranking` dibatasi
  // storeId kalau dipilih, jadi kolom terjual/omzet di Rekap Sebaran ikut mengikuti filter toko
  // itu — konsisten dengan tab Ranking Penjualan yang datanya sama.
  const ringkasPerProduk = new Map((ranking?.byProduct ?? []).map((r) => [r.productId, r]))
  const semuaProdukMutasi: BarisRekapSemuaProduk[] = products.map((p) => {
    const s = stokPerProduk.get(p.id)
    return { productId: p.id, productCode: p.code, productName: p.name, unit: p.unit, gudang: s?.gudangTotal ?? 0, sales: s?.salesTotal ?? 0, toko: s?.tokoTotal ?? 0, total: s?.total ?? 0 }
  })
  const semuaProdukSebaran: BarisRekapSebaranProduk[] = products.map((p) => {
    const s = stokPerProduk.get(p.id)
    const r = ringkasPerProduk.get(p.id)
    return { productId: p.id, productCode: p.code, productName: p.name, unit: p.unit, stokToko: s?.tokoTotal ?? 0, stokSales: s?.salesTotal ?? 0, qtyTerjual: r?.qtyTerjual ?? 0, omzet: r?.omzet ?? 0 }
  })
  // Tab Sebaran menyoroti SATU produk; kalau belum dipilih, ambil produk pertama supaya tabnya
  // langsung berisi. Diambil terpisah dari Promise.all di atas karena bergantung pada daftar
  // produk yang baru selesai di situ.
  const produkId = sp.produkId || products[0]?.id || ""
  // Mutasi Stok: kalau divisi dipilih, produk SENGAJA tidak dikirim — angkanya jadi gabungan
  // seluruh produk divisi itu. Kalau tidak, jatuh ke produk terpilih seperti tab Sebaran.
  const mutasi = await backendFetch<MutasiBulananReport>(
    `/stock/produk/mutasi-bulanan?${new URLSearchParams({
      ...(sp.businessTypeId ? { businessTypeId: sp.businessTypeId } : produkId ? { productId: produkId } : {}),
      from: period.fromStr,
      to: period.toStr,
    })}`,
    { accessToken },
  ).catch(() => null)

  const sebaran = produkId
    ? await backendFetch<SebaranReport>(
        `/analisa/sebaran-produk?${new URLSearchParams({ productId: produkId, from: period.fromStr, to: period.toStr })}`,
        { accessToken },
      ).catch(() => null)
    : null

  // Riwayat Keluar-Masuk (tab Mutasi Stok → Rinci): SATU produk di SATU lokasi persis, cuma
  // ditarik begitu keduanya sudah dipilih lewat `PilihLokasiMutasi` — beda dari `mutasi` di atas
  // yang selalu jalan (agregat, boleh gabungan divisi).
  const riwayatMutasi =
    produkId && sp.lokasiTipe && sp.lokasiId
      ? await backendFetch<RiwayatMutasiLokasi>(
          `/stock/produk/${produkId}/mutasi?${new URLSearchParams({
            locationType: sp.lokasiTipe,
            locationId: sp.lokasiId,
            from: period.fromStr,
            to: period.toStr,
          })}`,
          { accessToken },
        ).catch(() => null)
      : null

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Data Operasional" }, { label: "Produk" }]} />
        <TautanArsip href="/master/produk/arsip" role={user.role} />
      </div>

      {/* Tab yang belum dibangun (Mutasi Stok, Sebaran per Toko, Analisa) sengaja TIDAK dikirim
          isinya — tombolnya digambar abu-abu bertanda "Segera" oleh ProdukTabs, bukan tab kosong
          yang bisa dibuka. Tinggal tambahkan node-nya di sini begitu tiap tab jadi. */}
      <ProdukTabs
        isi={{
          main: (
            <ProdukPanel
              rows={products.map((p) => keBarisProduk(p, stokPerProduk.get(p.id)))}
              businessTypes={businessTypes.map((b) => ({ id: b.id, name: b.name }))}
              periodeStok={stok?.period ?? null}
              canManage={user.role === "owner" || user.role === "admin"}
            />
          ),
          ranking: ranking ? (
            <TabRankingPenjualan
              rows={ranking.byProduct}
              summary={ranking.summary}
              from={period.fromStr}
              to={period.toStr}
              storeId={sp.storeId}
              storeOptions={stores.map((s) => ({ value: s.id, label: s.name }))}
            />
          ) : undefined,
          mutasi: mutasi ? (
            <TabMutasiStok
              produkId={produkId}
              produkOptions={products.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))}
              divisiOptions={businessTypes.map((b) => ({ value: b.id, label: b.name }))}
              businessTypeId={sp.businessTypeId}
              bulan={mutasi.bulan}
              perLokasi={mutasi.perLokasi}
              summary={mutasi.summary}
              hargaCampuran={mutasi.hargaCampuran}
              satuan={mutasi.produk.length === 1 ? mutasi.produk[0].unit : ""}
              semuaProduk={semuaProdukMutasi}
              from={period.fromStr}
              to={period.toStr}
              lokasiTipe={sp.lokasiTipe ?? ""}
              lokasiId={sp.lokasiId ?? ""}
              gudangOptions={gudangList.filter((w) => w.isActive).map((w) => ({ value: w.id, label: w.name }))}
              salesOptions={users.filter((u) => u.role === "sales").map((u) => ({ value: u.id, label: u.name }))}
              tokoOptions={stores.map((s) => ({ value: s.id, label: s.name }))}
              riwayat={riwayatMutasi}
            />
          ) : undefined,
          analisa: analisa && ranking ? (
            <TabAnalisa
              byProduct={ranking.byProduct}
              laris={analisa.laris}
              mandek={analisa.mandek}
              saran={analisa.saran}
              summary={analisa.summary}
              from={period.fromStr}
              to={period.toStr}
              businessTypeId={sp.businessTypeId}
              businessTypeOptions={businessTypes.map((b) => ({ value: b.id, label: b.name }))}
            />
          ) : undefined,
          sebaran: sebaran ? (
            <TabSebaran
              produkId={produkId}
              produkOptions={products.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))}
              product={sebaran.product}
              perToko={sebaran.perToko}
              perSales={sebaran.perSales}
              perArea={sebaran.perArea}
              perKabupaten={sebaran.perKabupaten}
              summary={sebaran.summary}
              semuaProduk={semuaProdukSebaran}
              from={period.fromStr}
              to={period.toStr}
            />
          ) : undefined,
        }}
      />
    </div>
  )
}
