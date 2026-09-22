/** Satu-satunya definisi "produk mana yang cocok dengan penyaring" — dipakai bersama oleh
 *  panel di layar (`ProdukPanel`), halaman print sumber PDF, dan ekspor Excel.
 *
 *  Ditaruh di sini, bukan disalin tiga kali, karena berkas yang terunduh HARUS berisi persis
 *  apa yang sedang dilihat di layar. Begitu logikanya digandakan, cepat atau lambat salah satu
 *  ikut berubah sendirian dan angka di Excel tidak lagi sama dengan angka di aplikasi. */

export interface ProdukTersaring {
  code: string
  name: string
  variant: string
  size: string
  businessTypeId: string
  isActive: boolean
}

export interface PenyaringProduk {
  /** Pencarian teks: kode, nama, varian, ukuran. */
  q: string
  /** `businessTypeId`, atau "" untuk semua bisnis. */
  bisnis: string
  /** "active" | "inactive" | "" (semua). */
  status: string
}

export const PENYARING_KOSONG: PenyaringProduk = { q: "", bisnis: "", status: "" }

export function bacaPenyaringProduk(params: URLSearchParams): PenyaringProduk {
  return {
    q: params.get("q") ?? "",
    bisnis: params.get("bisnis") ?? "",
    status: params.get("status") ?? "",
  }
}

/** Ringkasan penyaring yang sedang dipakai, untuk kop PDF/Excel — berkas rekap tanpa keterangan
 *  ini menyesatkan: 40 baris produk terlihat seperti seluruh master produk padahal cuma satu
 *  bisnis yang tersaring. */
export function labelPenyaringProduk(f: PenyaringProduk, namaBisnis: string | null): string {
  const bagian: string[] = []
  if (f.bisnis) bagian.push(`Bisnis: ${namaBisnis ?? f.bisnis}`)
  if (f.status) bagian.push(`Status: ${f.status === "active" ? "Aktif" : "Nonaktif"}`)
  if (f.q.trim()) bagian.push(`Pencarian: "${f.q.trim()}"`)
  return bagian.length ? bagian.join(" · ") : "Semua produk"
}

export function saringProduk<T extends ProdukTersaring>(rows: T[], f: PenyaringProduk): T[] {
  const term = f.q.trim().toLowerCase()
  return rows.filter((p) => {
    if (f.bisnis && p.businessTypeId !== f.bisnis) return false
    if (f.status === "active" && !p.isActive) return false
    if (f.status === "inactive" && p.isActive) return false
    if (term) {
      const haystack = `${p.code} ${p.name} ${p.variant} ${p.size}`.toLowerCase()
      if (!haystack.includes(term)) return false
    }
    return true
  })
}
