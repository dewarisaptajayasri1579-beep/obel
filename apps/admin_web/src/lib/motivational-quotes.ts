const GENERIC_QUOTES = [
  "Satu kopi, sejuta cerita — mari mulai hari dengan semangat.",
  "Booth rapi, stok akurat, pelanggan senang.",
  "Konsisten sedikit-sedikit lebih baik daripada semangat sesaat.",
  "Kerja tim yang solid, hasil yang luar biasa.",
  "Setiap cangkir yang tersaji adalah hasil kerja keras bersama.",
] as const

const ADMIN_QUOTES = [
  "Stok tercatat rapi, booth berjalan lancar — kerja bagus, Admin!",
  "Setiap distribusi yang tepat waktu bikin Petugas di booth makin semangat.",
  "Data akurat hari ini, laporan tenang di akhir bulan.",
  "Terima kasih sudah jadi jembatan gudang dan booth yang bisa diandalkan.",
  "Serah terima yang rapi adalah fondasi operasional yang sehat.",
] as const

const OWNER_QUOTES = [
  "Setiap booth yang lancar hari ini adalah hasil kerja tim yang bisa dipercaya.",
  "Bisnis kecil yang dikelola rapi, tumbuh jadi bisnis besar.",
  "Pantau dari jauh, percaya pada tim di lapangan — itu kekuatan Obbel.",
  "Pertumbuhan yang sehat dimulai dari data yang jujur dan tim yang solid.",
  "Terima kasih sudah membangun Obbel Coffee & Milk bersama seluruh tim.",
] as const

const BOOTH_STAFF_QUOTES = [
  "Semangat pagi, Petugas! Satu shift lagi, satu cerita baru.",
  "Setiap gelas yang kamu sajikan bikin harinya pelanggan lebih baik.",
  "Kerja hebat hari ini, istirahat yang cukup nanti.",
  "Booth rapi, kasir tertib — kamu bagian penting dari tim ini.",
  "Terima kasih sudah jaga booth dengan sepenuh hati hari ini.",
] as const

const QUOTES_BY_ROLE: Record<string, readonly string[]> = {
  ADMIN: ADMIN_QUOTES,
  "Admin Pusat": ADMIN_QUOTES,
  OWNER: OWNER_QUOTES,
  Owner: OWNER_QUOTES,
  BOOTH_STAFF: BOOTH_STAFF_QUOTES,
  "Petugas Booth": BOOTH_STAFF_QUOTES,
}

export function getRandomMotivationalQuote(role?: string): string {
  const pool = (role && QUOTES_BY_ROLE[role]) || GENERIC_QUOTES
  const index = Math.floor(Math.random() * pool.length)
  return pool[index]
}
