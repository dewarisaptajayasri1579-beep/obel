import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyProfileService } from '../company-profile/company-profile.service';

export interface FilterLaporanProduk {
  q?: string;
  kategoriId?: string;
  status?: 'active' | 'inactive';
  /// Nama pencetak, diambil dari token — dipajang di metadata berkas.
  dicetakOleh?: string;
}

interface BarisLaporan {
  sku: string;
  name: string;
  kategori: string;
  sellPrice: number;
  totalStok: number;
  active: boolean;
}

/// Hijau Obbel — sama dengan `AppTheme.primaryDark` di aplikasi Android
/// (apps/booth_flutter/lib/theme.dart). Berkas cetak dan aplikasinya harus
/// bicara dengan satu bahasa warna.
const HIJAU = '0B5D34';
const HIJAU_HEX = '#0B5D34';

const ISI_KEPALA: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${HIJAU}` } };
const HURUF_KEPALA: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } };

/// Warna status mengikuti lencana di layar supaya berkas dan aplikasinya tidak
/// bicara dengan dua bahasa warna yang berbeda.
const ISI_AKTIF: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
const ISI_NONAKTIF: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

const GARIS: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

/// Laporan daftar produk dalam PDF & Excel.
///
/// Susunannya — kop, judul, metadata dua kolom, tabel berkepala warna, autofilter
/// — disamakan dengan ekspor Master Produk jsBerkah supaya kedua berkas terbaca
/// sebagai satu keluarga dokumen.
///
/// Penyaringnya sama persis dengan yang dipakai layar, jadi berkas yang terunduh
/// berisi persis apa yang sedang dilihat pemakai.
@Injectable()
export class ProductReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyProfile: CompanyProfileService,
  ) {}

  private async ambilBaris(filter: FilterLaporanProduk): Promise<BarisLaporan[]> {
    const products = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        ...(filter.kategoriId ? { categoryId: filter.kategoriId } : {}),
        ...(filter.status ? { active: filter.status === 'active' } : {}),
        // Sinkron dengan pencarian di layar (TabMain.tsx: `${sku} ${name}
        // ${category}`.includes(q)) — dulu kategori tidak ikut dicari di sini,
        // jadi cari lewat nama kategori di layar menampilkan baris yang
        // TIDAK ikut ke berkas PDF/Excel-nya (file jadi tidak sesuai filter
        // yang lagi aktif di layar).
        ...(filter.q
          ? {
              OR: [
                { sku: { contains: filter.q, mode: 'insensitive' as const } },
                { name: { contains: filter.q, mode: 'insensitive' as const } },
                { category: { name: { contains: filter.q, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      },
      include: { category: true },
      orderBy: { sku: 'asc' },
    });

    // Total stok = gudang + seluruh booth. Dibaca dari proyeksi, bukan ledger:
    // kolom ini menjawab "ada berapa sekarang", dan proyeksi memang angka yang
    // dipakai bekerja sehari-hari.
    const ids = products.map((p) => p.id);
    const [gudang, booth] = await Promise.all([
      this.prisma.warehouseStock.findMany({ where: { productId: { in: ids } } }),
      this.prisma.boothStock.groupBy({
        by: ['productId'],
        where: { productId: { in: ids } },
        _sum: { qtyOnHand: true },
      }),
    ]);
    const stokGudang = new Map(gudang.map((g) => [g.productId, g.qtyOnHand]));
    const stokBooth = new Map(booth.map((b) => [b.productId, b._sum.qtyOnHand ?? 0]));

    return products.map((p) => ({
      sku: p.sku,
      name: p.name,
      kategori: p.category?.name ?? '-',
      sellPrice: Number(p.sellPrice),
      totalStok: (stokGudang.get(p.id) ?? 0) + (stokBooth.get(p.id) ?? 0),
      active: p.active,
    }));
  }

  /// Label penyaring yang sedang aktif, ditulis apa adanya di metadata berkas.
  /// Tanpa ini, "12 produk" di berkas tidak pernah jelas 12 dari apa.
  private async labelPenyaring(filter: FilterLaporanProduk): Promise<string> {
    const bagian: string[] = [];
    if (filter.q) bagian.push(`Pencarian "${filter.q}"`);
    if (filter.kategoriId) {
      const k = await this.prisma.productCategory.findUnique({ where: { id: filter.kategoriId } });
      bagian.push(`Kategori ${k?.name ?? filter.kategoriId}`);
    }
    if (filter.status) bagian.push(`Status ${filter.status === 'active' ? 'Aktif' : 'Nonaktif'}`);
    return bagian.length ? bagian.join(' · ') : 'Semua produk';
  }

  /// Waktu cetak dalam Asia/Jakarta, sama dengan seluruh tampilan UI — berkas
  /// yang dicetak jam 9 pagi WIB tidak boleh tertulis jam 2 pagi.
  private stempelJakarta(): string {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(new Date());
  }

  private rupiah(n: number): string {
    return `Rp${n.toLocaleString('id-ID')}`;
  }

  // ─────────────────────────────── EXCEL ───────────────────────────────

  async excel(filter: FilterLaporanProduk): Promise<Buffer> {
    const rows = await this.ambilBaris(filter);
    const penyaring = await this.labelPenyaring(filter);
    const jumlahAktif = rows.filter((r) => r.active).length;
    const profil = await this.companyProfile.getForPrint();

    const buku = new ExcelJS.Workbook();
    buku.creator = profil.name;
    buku.created = new Date();

    const lembar = buku.addWorksheet('Master Produk', {
      views: [{ showGridLines: false }],
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0, footer: 0 },
      },
    });

    lembar.columns = [
      { width: 5 },
      { width: 16 },
      { width: 38 },
      { width: 22 },
      { width: 18 },
      { width: 14 },
      { width: 12 },
    ];

    // --- KOP PERUSAHAAN ---
    if (profil.logoPath && profil.logoExt) {
      const imageId = buku.addImage({ filename: profil.logoPath, extension: profil.logoExt });
      lembar.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 32, height: 32 } });
      lembar.getRow(1).height = 26;
    }

    lembar.mergeCells('A1:C1');
    lembar.getCell('A1').value = profil.logoPath ? `        ${profil.name}` : profil.name;
    lembar.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF0F172A' } };

    lembar.mergeCells('D1:G1');
    lembar.getCell('D1').value = profil.address ?? '';
    lembar.getCell('D1').font = { size: 9, color: { argb: 'FF64748B' } };
    lembar.getCell('D1').alignment = { horizontal: 'right' };

    // --- JUDUL ---
    lembar.mergeCells('A4:C4');
    lembar.getCell('A4').value = 'Daftar Master Produk';
    lembar.getCell('A4').font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };

    lembar.mergeCells('A5:C5');
    lembar.getCell('A5').value = 'Harga jual dan total stok gudang + seluruh booth';
    lembar.getCell('A5').font = { size: 9, italic: true, color: { argb: 'FF64748B' } };

    // --- METADATA ---
    const metaKiri: [string, string][] = [
      ['Penyaring', penyaring],
      ['Jumlah produk', `${rows.length} item (${jumlahAktif} aktif)`],
    ];
    const metaKanan: [string, string][] = [
      ['Dicetak pada', this.stempelJakarta()],
      ['Dicetak oleh', filter.dicetakOleh ?? '-'],
    ];
    metaKiri.forEach(([label, nilai], i) => {
      const baris = 7 + i;
      lembar.getCell(`A${baris}`).value = label;
      lembar.getCell(`A${baris}`).font = { bold: true, size: 10 };
      lembar.mergeCells(`B${baris}:C${baris}`);
      lembar.getCell(`B${baris}`).value = nilai;
      lembar.getCell(`B${baris}`).font = { size: 10 };
    });
    metaKanan.forEach(([label, nilai], i) => {
      const baris = 7 + i;
      lembar.getCell(`D${baris}`).value = label;
      lembar.getCell(`D${baris}`).font = { bold: true, size: 10 };
      lembar.mergeCells(`E${baris}:G${baris}`);
      lembar.getCell(`E${baris}`).value = nilai;
      lembar.getCell(`E${baris}`).font = { size: 10 };
    });

    // --- TABEL ---
    const barisKepala = 10;
    const kepala = lembar.getRow(barisKepala);
    kepala.values = ['No.', 'Kode Barang', 'Nama Barang', 'Kategori', 'Harga Jual', 'Total Stok', 'Status'];
    kepala.eachCell((sel) => {
      sel.fill = ISI_KEPALA;
      sel.font = HURUF_KEPALA;
      sel.alignment = { vertical: 'middle' };
      sel.border = GARIS;
    });
    kepala.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
    kepala.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    kepala.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
    kepala.height = 20;

    rows.forEach((satu, i) => {
      const baris = lembar.getRow(barisKepala + 1 + i);
      baris.values = [
        i + 1,
        satu.sku,
        satu.name,
        satu.kategori,
        satu.sellPrice,
        satu.totalStok,
        satu.active ? 'Aktif' : 'Nonaktif',
      ];
      baris.eachCell((sel) => {
        sel.border = GARIS;
        sel.font = { size: 10 };
      });
      baris.getCell(2).font = { size: 10, name: 'Consolas' };
      // Rupiah & qty sebagai ANGKA berformat, bukan teks — supaya masih bisa
      // dijumlah di aplikasi lembar sebar.
      baris.getCell(5).numFmt = '"Rp"#,##0;[Red]-"Rp"#,##0';
      baris.getCell(5).alignment = { horizontal: 'right' };
      baris.getCell(6).numFmt = '#,##0';
      baris.getCell(6).alignment = { horizontal: 'right' };
      baris.getCell(7).alignment = { horizontal: 'center' };
      baris.getCell(7).fill = satu.active ? ISI_AKTIF : ISI_NONAKTIF;
    });

    if (rows.length > 0) {
      lembar.autoFilter = {
        from: { row: barisKepala, column: 1 },
        to: { row: barisKepala + rows.length, column: 7 },
      };
    }

    // ExcelJS mengembalikan ArrayBuffer-nya sendiri; dibungkus ulang jadi Buffer
    // Node supaya cocok dengan StreamableFile.
    return Buffer.from(await buku.xlsx.writeBuffer());
  }

  // ──────────────────────────────── PDF ────────────────────────────────

  async pdf(filter: FilterLaporanProduk): Promise<Buffer> {
    const rows = await this.ambilBaris(filter);
    const penyaring = await this.labelPenyaring(filter);
    const jumlahAktif = rows.filter((r) => r.active).length;
    const dicetakPada = this.stempelJakarta();
    const profil = await this.companyProfile.getForPrint();

    return new Promise((resolve, reject) => {
      // A4 landscape, sama dengan laporan produk jsBerkah.
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const KIRI = 28;
      const KANAN = 814; // 842pt lebar A4 landscape − margin kanan

      // --- KOP: logo (kalau ada) + perusahaan di kiri, judul di kanan, garis tebal di bawahnya ---
      const teksKiri = profil.logoPath ? KIRI + 42 : KIRI;
      if (profil.logoPath) doc.image(profil.logoPath, KIRI, 24, { fit: [36, 36] });
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#0F172A').text(profil.name, teksKiri, 28);
      doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(profil.address ?? '', teksKiri, 45);

      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0F172A')
        .text('Daftar Master Produk', KIRI, 28, { width: KANAN - KIRI, align: 'right' });
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748B')
        .text('Harga jual dan total stok gudang + seluruh booth', KIRI, 45, { width: KANAN - KIRI, align: 'right' });

      doc.moveTo(KIRI, 62).lineTo(KANAN, 62).lineWidth(1.5).strokeColor('#1E293B').stroke();

      // --- METADATA: dua kolom, kiri rata kiri & kanan rata kanan ---
      const metaY = 70;
      const tulisMeta = (label: string, nilai: string, y: number, align: 'left' | 'right') => {
        doc.fontSize(8).fillColor('#0F172A');
        const teks = `${label}: ${nilai}`;
        doc.font('Helvetica-Bold').text(`${label}: `, KIRI, y, {
          width: KANAN - KIRI,
          align,
          continued: true,
        });
        doc.font('Helvetica').text(nilai);
        void teks;
      };
      tulisMeta('Penyaring', penyaring, metaY, 'left');
      tulisMeta('Dicetak pada', dicetakPada, metaY, 'right');
      tulisMeta('Jumlah produk', `${rows.length} item (${jumlahAktif} aktif)`, metaY + 12, 'left');
      tulisMeta('Dicetak oleh', filter.dicetakOleh ?? '-', metaY + 12, 'right');

      // --- TABEL ---
      const kolom = [
        { label: 'No.', x: KIRI, w: 32, align: 'center' as const },
        { label: 'Kode Barang', x: KIRI + 32, w: 90, align: 'left' as const },
        { label: 'Nama Barang', x: KIRI + 122, w: 260, align: 'left' as const },
        { label: 'Kategori', x: KIRI + 382, w: 150, align: 'left' as const },
        { label: 'Harga Jual', x: KIRI + 532, w: 110, align: 'right' as const },
        { label: 'Total Stok', x: KIRI + 642, w: 74, align: 'right' as const },
        { label: 'Status', x: KIRI + 716, w: 70, align: 'center' as const },
      ];

      const tulisKepala = (y: number) => {
        doc.rect(KIRI, y, KANAN - KIRI, 18).fill(HIJAU_HEX);
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
        for (const k of kolom) doc.text(k.label, k.x + 4, y + 5, { width: k.w - 8, align: k.align });
        return y + 18;
      };

      let y = tulisKepala(metaY + 34);

      for (const [i, r] of rows.entries()) {
        // Ganti halaman sebelum baris terpotong di kaki halaman, lalu ulangi
        // kepalanya — tabel tanpa kepala di halaman kedua tidak terbaca.
        if (y > 520) {
          doc.addPage();
          y = tulisKepala(40);
        }

        if (!r.active) {
          doc.rect(KIRI, y, KANAN - KIRI, 15).fill('#F1F5F9');
        }

        doc.font('Helvetica').fontSize(8).fillColor('#0F172A');
        doc.text(String(i + 1), kolom[0].x + 4, y + 4, { width: kolom[0].w - 8, align: 'center' });
        doc.font('Courier').text(r.sku, kolom[1].x + 4, y + 4, { width: kolom[1].w - 8 });
        doc.font('Helvetica').text(r.name, kolom[2].x + 4, y + 4, { width: kolom[2].w - 8, ellipsis: true });
        doc.text(r.kategori, kolom[3].x + 4, y + 4, { width: kolom[3].w - 8, ellipsis: true });
        doc.text(this.rupiah(r.sellPrice), kolom[4].x + 4, y + 4, { width: kolom[4].w - 8, align: 'right' });
        doc.text(r.totalStok.toLocaleString('id-ID'), kolom[5].x + 4, y + 4, { width: kolom[5].w - 8, align: 'right' });
        doc.fillColor(r.active ? '#15803D' : '#64748B')
          .text(r.active ? 'Aktif' : 'Nonaktif', kolom[6].x + 4, y + 4, { width: kolom[6].w - 8, align: 'center' });

        y += 15;
        doc.moveTo(KIRI, y).lineTo(KANAN, y).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
      }

      // --- KAKI: total ---
      doc.rect(KIRI, y, KANAN - KIRI, 16).fill('#F8FAFC');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A');
      doc.text('TOTAL', kolom[1].x + 4, y + 4, { width: kolom[2].w });
      doc.text(
        rows.reduce((s, r) => s + r.totalStok, 0).toLocaleString('id-ID'),
        kolom[5].x + 4,
        y + 4,
        { width: kolom[5].w - 8, align: 'right' },
      );

      doc.end();
    });
  }
}
