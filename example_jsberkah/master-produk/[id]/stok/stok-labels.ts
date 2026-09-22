/** Label & istilah rekap stok, dipakai bersama halaman rekap dan halaman mutasinya.
 *
 *  Nama jenis mutasi ditulis seperti nama dokumennya di aplikasi (bukan nama enum-nya), karena
 *  yang membaca halaman ini sedang mencocokkan angka dengan dokumen fisik di tangannya. */

export type JenisLokasi = "WAREHOUSE" | "SALES" | "STORE"

export const JUDUL_LOKASI: Record<JenisLokasi, string> = {
  WAREHOUSE: "Gudang",
  SALES: "Dibawa Sales",
  STORE: "Di Toko",
}

export const KETERANGAN_LOKASI: Record<JenisLokasi, string> = {
  WAREHOUSE: "Stok yang ada di masing-masing lokasi penyimpanan gudang.",
  SALES: "Stok yang sedang dibawa masing-masing sales — sudah keluar gudang, belum sampai toko.",
  STORE: "Stok yang sedang dititipkan di masing-masing toko dan belum terjual.",
}

/** Nilai `?tab=` di halaman rekap — sekaligus yang dikirim tautan dari kolom Stok di
 *  Master Produk (`.../stok?tab=sales`). Dulu jangkar `#sales`; diganti begitu ketiga bagiannya
 *  jadi tab, karena jangkar tidak bisa membuka tab yang sedang tertutup. */
export const ANCHOR_LOKASI: Record<JenisLokasi, string> = {
  WAREHOUSE: "gudang",
  SALES: "sales",
  STORE: "toko",
}

export const URUTAN_LOKASI: JenisLokasi[] = ["WAREHOUSE", "SALES", "STORE"]

export const LABEL_MUTASI: Record<string, string> = {
  MASUK_GUDANG: "Barang Masuk Gudang",
  SETOR_TOKO: "Setor / Titip ke Toko",
  RETUR_TOKO: "Retur dari Toko",
  TRANSFER: "Transfer Antar Lokasi",
  KOREKSI: "Koreksi Stok",
  OPNAME_TERJUAL: "Opname — Terjual",
  REFILL: "Refill Toko",
  RETUR_SELISIH_OPNAME: "Retur Selisih Opname",
  SERAH_TERIMA_SALES: "Serah Terima ke Sales",
  PENJUALAN_LANGSUNG: "Penjualan Langsung",
  PENGEMBALIAN_SALES: "Pengembalian dari Sales",
}

export const labelMutasi = (kode: string) => LABEL_MUTASI[kode] ?? kode

export const tanggalWaktu = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso))

export const tanggalPanjang = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(new Date(iso))

/** `YYYY-MM-DD` untuk mengisi <input type="date"> dari ISO string yang dikirim backend. */
export const keTanggalInput = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
