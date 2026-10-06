/// Struk thermal 58mm dibangun DI SINI (web), bukan di aplikasi Flutter: web menyusun daftar baris yang
/// sudah dibungkus dan dirata ke lebar kertas, aplikasi Android hanya menerjemahkannya ke ESC/POS.
/// Satu susunan yang sama dipakai untuk cetak Bluetooth, teks WhatsApp dan cetak browser, dan mengubah
/// tata letak cukup deploy web (tanpa membangun ulang APK).

/// Kertas 58mm memuat 32 karakter font normal; dengan lebar ganda (judul) tinggal 16.
export const LEBAR_STRUK = 32;
export const LEBAR_JUDUL = 16;

/// Nominal tanpa "Rp", seperti struk client: `18.000`.
const angka = (n: number): string => Math.round(n).toLocaleString("id-ID");

export interface PrintLine {
  text: string;
  align: "left" | "center" | "right";
  bold: boolean;
  /// 2 = tinggi dan lebar ganda (judul), batas teksnya LEBAR_JUDUL.
  size: 1 | 2;
}

export interface Perusahaan {
  nama: string;
  alamat?: string | null;
  telepon?: string | null;
}

export interface StrukPenjualanInput {
  perusahaan: Perusahaan;
  boothName: string;
  saleNo: string;
  /// ISO string.
  waktuIso: string;
  barista?: string;
  items: { name: string; qty: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  discount: number;
  total: number;
  /// Label sudah jadi, mis. "Tunai", "QRIS", "Split".
  metode: string;
  /// Tandai salinan (cetak ulang) supaya satu nota tidak dipakai dua kali.
  cetakUlang?: boolean;
}

/// Waktu struk dalam Asia/Jakarta (UTC+7, tanpa DST), format struk client: `29/09/2026 12:00`.
/// Dihitung manual (bukan Intl) supaya tidak bergantung data locale WebView atau zona waktu HP.
export function formatWaktuStruk(iso: string): string {
  const wib = new Date(Date.parse(iso) + 7 * 3600_000);
  const dua = (n: number) => String(n).padStart(2, "0");
  return `${dua(wib.getUTCDate())}/${dua(wib.getUTCMonth() + 1)}/${wib.getUTCFullYear()} ${dua(wib.getUTCHours())}:${dua(wib.getUTCMinutes())}`;
}

/// Bungkus per kata ke `lebar`; kata yang lebih panjang dari satu baris dipotong per huruf.
export function bungkus(teks: string, lebar: number): string[] {
  const hasil: string[] = [];
  let baris = "";
  for (const kata of teks.trim().split(/\s+/).filter(Boolean)) {
    let sisa = kata;
    while (sisa.length > lebar) {
      if (baris) {
        hasil.push(baris);
        baris = "";
      }
      hasil.push(sisa.slice(0, lebar));
      sisa = sisa.slice(lebar);
    }
    if (!baris) baris = sisa;
    else if (baris.length + 1 + sisa.length <= lebar) baris += ` ${sisa}`;
    else {
      hasil.push(baris);
      baris = sisa;
    }
  }
  if (baris) hasil.push(baris);
  return hasil.length ? hasil : [""];
}

/// "Order Number" (12) + satu spasi sebelum titik dua, seperti struk client.
const LEBAR_LABEL = 13;

const kiri = (text: string, bold = false): PrintLine => ({ text, align: "left", bold, size: 1 });
const tengah = (text: string, bold = false): PrintLine => ({ text, align: "center", bold, size: 1 });
const judul = (text: string): PrintLine => ({ text, align: "center", bold: true, size: 2 });
const garis = (karakter: "-" | "="): PrintLine => kiri(karakter.repeat(LEBAR_STRUK));

/// Satu baris label di kiri dan nilai di kanan. Kalau label terlalu panjang, label dibungkus dan nilai
/// ikut di baris terakhir bila muat, kalau tidak di baris sendiri rata kanan (angka tidak pernah terpecah).
function kiriKanan(label: string, nilai: string, tebal = false): PrintLine[] {
  const batasKiri = LEBAR_STRUK - nilai.length - 1;
  if (label.length <= batasKiri) return [kiri(label.padEnd(LEBAR_STRUK - nilai.length) + nilai, tebal)];
  const potongan = bungkus(label, LEBAR_STRUK);
  const terakhir = potongan[potongan.length - 1];
  if (terakhir.length <= batasKiri) {
    potongan[potongan.length - 1] = terakhir.padEnd(LEBAR_STRUK - nilai.length) + nilai;
    return potongan.map((p) => kiri(p, tebal));
  }
  return [...potongan.map((p) => kiri(p, tebal)), kiri(nilai.padStart(LEBAR_STRUK), tebal)];
}

/// `Label        : nilai` dengan titik dua sejajar; nilai panjang dilanjutkan di bawahnya dengan indentasi.
function info(label: string, nilai: string): PrintLine[] {
  const awalan = `${label.padEnd(LEBAR_LABEL)}: `;
  const potongan = bungkus(nilai, LEBAR_STRUK - awalan.length);
  return potongan.map((p, i) => kiri((i === 0 ? awalan : " ".repeat(awalan.length)) + p));
}

/// "Obbel Coffee & Milk" -> OBBEL / COFFEE & MILK: kata pertama jadi merek di baris atas, sisanya di
/// bawah. Judul lebar ganda hanya memuat 16 karakter, jadi satu baris panjang pasti terpotong.
function judulMerek(nama: string): PrintLine[] {
  const kata = nama.trim().split(/\s+/).filter(Boolean);
  if (kata.length === 0) return [];
  const bagian = kata.length >= 2 ? [kata[0], kata.slice(1).join(" ")] : [kata[0]];
  return bagian.flatMap((b) => bungkus(b.toUpperCase(), LEBAR_JUDUL).map(judul));
}

export function buatStrukPenjualan(input: StrukPenjualanInput): PrintLine[] {
  const { perusahaan, items } = input;
  const baris: PrintLine[] = [...judulMerek(perusahaan.nama)];

  if (perusahaan.alamat) baris.push(...bungkus(perusahaan.alamat, LEBAR_STRUK).map((b) => tengah(b)));
  if (perusahaan.telepon) baris.push(tengah(`Phone: ${perusahaan.telepon}`));
  baris.push(tengah(input.boothName, true), garis("="));

  baris.push(...info("Date", formatWaktuStruk(input.waktuIso)), ...info("Order Number", input.saleNo));
  if (input.barista) baris.push(...info("Barista", input.barista));
  baris.push(garis("="));
  if (input.cetakUlang) baris.push(tengah("** REPRINT BILL **", true), garis("="));

  for (const item of items) {
    baris.push(...bungkus(item.name, LEBAR_STRUK).map((b) => kiri(b, true)));
    baris.push(...kiriKanan(`${item.qty} x ${angka(item.unitPrice)}`, angka(item.lineTotal)));
  }

  baris.push(garis("-"), ...kiriKanan("Total Item", `${items.reduce((n, i) => n + i.qty, 0)}`), garis("-"));
  if (input.discount > 0) {
    baris.push(...kiriKanan("Subtotal", angka(input.subtotal)), ...kiriKanan("Discount", `-${angka(input.discount)}`));
  }
  baris.push(...kiriKanan("Total", angka(input.total), true), ...kiriKanan("Payment", input.metode), garis("="));
  baris.push(kiri(""), tengah("Terima kasih"));
  return baris;
}

/// Teks polos dengan lebar yang sama dengan kertas — untuk WhatsApp (dibungkus blok monospace) dan
/// cetak browser. Baris rata tengah dan kanan diberi spasi di depannya.
export function teksStruk(baris: PrintLine[]): string {
  return baris
    .map((b) => {
      if (b.align === "center") return " ".repeat(Math.max(0, Math.floor((LEBAR_STRUK - b.text.length) / 2))) + b.text;
      if (b.align === "right") return b.text.padStart(LEBAR_STRUK);
      return b.text;
    })
    .join("\n");
}
