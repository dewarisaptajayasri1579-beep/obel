import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { StockReceiptStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { CompanyProfileService } from '../company-profile/company-profile.service';

export interface FilterLaporanPenerimaan {
  q?: string;
  status?: StockReceiptStatus;
  dicetakOleh?: string;
}

interface BarisLaporan {
  receiptNo: string;
  tanggal: Date;
  keterangan: string;
  jenisProduk: number;
  totalQty: number;
  status: StockReceiptStatus;
  versionNo: number;
}

const HIJAU = '0B5D34';
const HIJAU_HEX = '#0B5D34';

const ISI_KEPALA: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${HIJAU}` } };
const HURUF_KEPALA: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } };

const GARIS: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

const STATUS_LABEL: Record<StockReceiptStatus, string> = {
  DRAFT: 'Draft',
  POSTED: 'Posted',
  REVISED: 'Revised',
};

/// Laporan Tambah Stok Gudang — daftar (PDF & Excel) mengikuti pola
/// ProductReportService (kop, judul, metadata dua kolom, tabel berkepala
/// warna), plus nota PDF per dokumen untuk dicetak satu transaksi.
@Injectable()
export class StockReceiptReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyProfile: CompanyProfileService,
  ) {}

  private async ambilBaris(filter: FilterLaporanPenerimaan): Promise<BarisLaporan[]> {
    const receipts = await this.prisma.stockReceipt.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.q
          ? {
              OR: [
                { receiptNo: { contains: filter.q, mode: 'insensitive' as const } },
                { note: { contains: filter.q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: { items: true },
      orderBy: { receiptDate: 'desc' },
    });

    return receipts.map((r) => ({
      receiptNo: r.receiptNo,
      tanggal: r.receiptDate,
      keterangan: r.note ?? '-',
      jenisProduk: r.items.length,
      totalQty: r.items.reduce((s, i) => s + i.qtyReceived, 0),
      status: r.status,
      versionNo: r.versionNo,
    }));
  }

  private labelPenyaring(filter: FilterLaporanPenerimaan): string {
    const bagian: string[] = [];
    if (filter.q) bagian.push(`Pencarian "${filter.q}"`);
    if (filter.status) bagian.push(`Status ${STATUS_LABEL[filter.status]}`);
    return bagian.length ? bagian.join(' · ') : 'Semua dokumen';
  }

  private stempelJakarta(): string {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(new Date());
  }

  private tanggalJakarta(d: Date): string {
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d);
  }

  // ─────────────────────────────── EXCEL (daftar) ───────────────────────────────

  async excel(filter: FilterLaporanPenerimaan): Promise<Buffer> {
    const rows = await this.ambilBaris(filter);
    const penyaring = this.labelPenyaring(filter);
    const profil = await this.companyProfile.getForPrint();

    const buku = new ExcelJS.Workbook();
    buku.creator = profil.name;
    buku.created = new Date();

    const lembar = buku.addWorksheet('Tambah Stok Gudang', {
      views: [{ showGridLines: false }],
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0, footer: 0 },
      },
    });

    lembar.columns = [{ width: 5 }, { width: 16 }, { width: 16 }, { width: 34 }, { width: 14 }, { width: 12 }, { width: 12 }];

    if (profil.logoImage && profil.logoExt) {
      const imageId = buku.addImage({ buffer: profil.logoImage as any, extension: profil.logoExt });
      lembar.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 32, height: 32 } });
      lembar.getRow(1).height = 26;
    }

    lembar.mergeCells('A1:C1');
    lembar.getCell('A1').value = profil.logoImage ? `        ${profil.name}` : profil.name;
    lembar.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF0F172A' } };

    lembar.mergeCells('D1:G1');
    lembar.getCell('D1').value = profil.address ?? '';
    lembar.getCell('D1').font = { size: 9, color: { argb: 'FF64748B' } };
    lembar.getCell('D1').alignment = { horizontal: 'right' };

    lembar.mergeCells('A4:C4');
    lembar.getCell('A4').value = 'Daftar Tambah Stok Gudang';
    lembar.getCell('A4').font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };

    lembar.mergeCells('A5:C5');
    lembar.getCell('A5').value = 'Riwayat penerimaan barang masuk ke Gudang Pusat';
    lembar.getCell('A5').font = { size: 9, italic: true, color: { argb: 'FF64748B' } };

    const metaKiri: [string, string][] = [
      ['Penyaring', penyaring],
      ['Jumlah dokumen', `${rows.length} dokumen`],
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

    const barisKepala = 10;
    const kepala = lembar.getRow(barisKepala);
    kepala.values = ['No.', 'No. Bukti', 'Tanggal', 'Keterangan', 'Jenis Produk', 'Total Qty', 'Status'];
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

    rows.forEach((r, i) => {
      const baris = lembar.getRow(barisKepala + 1 + i);
      baris.values = [
        i + 1,
        r.versionNo > 1 ? `${r.receiptNo} (v${r.versionNo})` : r.receiptNo,
        this.tanggalJakarta(r.tanggal),
        r.keterangan,
        r.jenisProduk,
        r.totalQty,
        STATUS_LABEL[r.status],
      ];
      baris.eachCell((sel) => {
        sel.border = GARIS;
        sel.font = { size: 10 };
      });
      baris.getCell(2).font = { size: 10, name: 'Consolas' };
      baris.getCell(5).alignment = { horizontal: 'right' };
      baris.getCell(6).alignment = { horizontal: 'right' };
      baris.getCell(6).font = { size: 10, bold: true };
      baris.getCell(7).alignment = { horizontal: 'center' };
    });

    if (rows.length > 0) {
      lembar.autoFilter = { from: { row: barisKepala, column: 1 }, to: { row: barisKepala + rows.length, column: 7 } };
    }

    return Buffer.from(await buku.xlsx.writeBuffer());
  }

  // ──────────────────────────────── PDF (daftar) ────────────────────────────────

  async pdf(filter: FilterLaporanPenerimaan): Promise<Buffer> {
    const rows = await this.ambilBaris(filter);
    const penyaring = this.labelPenyaring(filter);
    const dicetakPada = this.stempelJakarta();
    const profil = await this.companyProfile.getForPrint();

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const KIRI = 28;
      const KANAN = 814;

      const teksKiri = profil.logoImage ? KIRI + 42 : KIRI;
      if (profil.logoImage) doc.image(profil.logoImage, KIRI, 24, { fit: [36, 36] });
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#0F172A').text(profil.name, teksKiri, 28);
      doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(profil.address ?? '', teksKiri, 45);

      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0F172A')
        .text('Daftar Tambah Stok Gudang', KIRI, 28, { width: KANAN - KIRI, align: 'right' });
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748B')
        .text('Riwayat penerimaan barang masuk ke Gudang Pusat', KIRI, 45, { width: KANAN - KIRI, align: 'right' });

      doc.moveTo(KIRI, 62).lineTo(KANAN, 62).lineWidth(1.5).strokeColor('#1E293B').stroke();

      const metaY = 70;
      // `align: 'right'` + `continued: true` tidak boleh digabung di pdfkit: label dan
      // nilai sama-sama diposisikan ke ujung kanan lebar penuh lalu saling menimpa.
      // Untuk rata kanan, hitung lebar gabungan (label bold + nilai reguler) lebih
      // dulu supaya titik mulainya pas, baru tulis berurutan tanpa opsi align.
      const tulisMeta = (label: string, nilai: string, y: number, align: 'left' | 'right') => {
        const labelText = `${label}: `;
        doc.font('Helvetica-Bold').fontSize(8);
        const labelW = doc.widthOfString(labelText);
        doc.font('Helvetica').fontSize(8);
        const nilaiW = doc.widthOfString(nilai);
        const x = align === 'right' ? KANAN - labelW - nilaiW : KIRI;

        doc.font('Helvetica-Bold').fillColor('#0F172A').text(labelText, x, y, { continued: true });
        doc.font('Helvetica').text(nilai);
      };
      tulisMeta('Penyaring', penyaring, metaY, 'left');
      tulisMeta('Dicetak pada', dicetakPada, metaY, 'right');
      tulisMeta('Jumlah dokumen', `${rows.length} dokumen`, metaY + 12, 'left');
      tulisMeta('Dicetak oleh', filter.dicetakOleh ?? '-', metaY + 12, 'right');

      const kolom = [
        { label: 'No.', x: KIRI, w: 30, align: 'center' as const },
        { label: 'No. Bukti', x: KIRI + 30, w: 110, align: 'left' as const },
        { label: 'Tanggal', x: KIRI + 140, w: 90, align: 'left' as const },
        { label: 'Keterangan', x: KIRI + 230, w: 300, align: 'left' as const },
        { label: 'Jenis Produk', x: KIRI + 530, w: 90, align: 'right' as const },
        { label: 'Total Qty', x: KIRI + 620, w: 80, align: 'right' as const },
        { label: 'Status', x: KIRI + 700, w: 86, align: 'center' as const },
      ];

      const tulisKepala = (y: number) => {
        doc.rect(KIRI, y, KANAN - KIRI, 18).fill(HIJAU_HEX);
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
        for (const k of kolom) doc.text(k.label, k.x + 4, y + 5, { width: k.w - 8, align: k.align });
        return y + 18;
      };

      let y = tulisKepala(metaY + 34);

      const STATUS_WARNA: Record<StockReceiptStatus, string> = { DRAFT: '#64748B', POSTED: '#15803D', REVISED: '#B45309' };

      for (const [i, r] of rows.entries()) {
        if (y > 520) {
          doc.addPage();
          y = tulisKepala(40);
        }

        doc.font('Helvetica').fontSize(8).fillColor('#0F172A');
        doc.text(String(i + 1), kolom[0].x + 4, y + 4, { width: kolom[0].w - 8, align: 'center' });
        doc.font('Courier').text(r.versionNo > 1 ? `${r.receiptNo} (v${r.versionNo})` : r.receiptNo, kolom[1].x + 4, y + 4, { width: kolom[1].w - 8 });
        doc.font('Helvetica').text(this.tanggalJakarta(r.tanggal), kolom[2].x + 4, y + 4, { width: kolom[2].w - 8 });
        doc.text(r.keterangan, kolom[3].x + 4, y + 4, { width: kolom[3].w - 8, ellipsis: true });
        doc.text(String(r.jenisProduk), kolom[4].x + 4, y + 4, { width: kolom[4].w - 8, align: 'right' });
        doc.font('Helvetica-Bold').text(r.totalQty.toLocaleString('id-ID'), kolom[5].x + 4, y + 4, { width: kolom[5].w - 8, align: 'right' });
        doc.font('Helvetica').fillColor(STATUS_WARNA[r.status]).text(STATUS_LABEL[r.status], kolom[6].x + 4, y + 4, { width: kolom[6].w - 8, align: 'center' });

        y += 15;
        doc.moveTo(KIRI, y).lineTo(KANAN, y).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
      }

      doc.rect(KIRI, y, KANAN - KIRI, 16).fill('#F8FAFC');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A');
      doc.text('TOTAL', kolom[1].x + 4, y + 4, { width: kolom[3].w });
      doc.text(rows.reduce((s, r) => s + r.totalQty, 0).toLocaleString('id-ID'), kolom[5].x + 4, y + 4, { width: kolom[5].w - 8, align: 'right' });

      doc.end();
    });
  }

  // ──────────────────────────────── PDF (nota per-dokumen) ────────────────────────────────

  async nota(id: string): Promise<Buffer> {
    const r = await this.prisma.stockReceipt.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { sku: true, name: true } } }, orderBy: { product: { name: 'asc' } } },
        createdBy: { select: { fullName: true } },
        postedBy: { select: { fullName: true } },
      },
    });
    if (!r) throw new DomainError('NOT_FOUND', 'Dokumen Tambah Stok Gudang tidak ditemukan.');

    const totalQty = r.items.reduce((s, i) => s + i.qtyReceived, 0);
    const dicetakPada = this.stempelJakarta();
    const profil = await this.companyProfile.getForPrint();

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const KIRI = 40;
      const KANAN = 555;

      // --- KEPALA: logo + perusahaan SENDIRIAN di barisnya (bukan berbagi baris
      // dengan judul dokumen) — pola nota transaksi jsBerkah (STB/Opname), bukan
      // gaya letterhead surat formal yang dipakai sebelumnya di sini. ---
      const teksKiri = profil.logoImage ? KIRI + 38 : KIRI;
      if (profil.logoImage) {
        doc.roundedRect(KIRI, 38, 30, 30, 6).lineWidth(1).strokeColor('#E2E8F0').stroke();
        doc.image(profil.logoImage, KIRI + 3, 41, { fit: [24, 24] });
      }
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#0F172A').text(profil.name, teksKiri, 41);
      doc.font('Helvetica').fontSize(8.5).fillColor('#64748B').text(profil.address ?? '', teksKiri, 57);

      // --- JUDUL (kiri) & KARTU METADATA (kanan) — baris kedua, sejajar satu sama
      // lain seperti "PURCHASE ORDER" + kartu No. Dokumen/Tanggal/Status jsBerkah. ---
      const judulY = 86;
      const renggang = (s: string) => s.split('').join(' ');
      doc.font('Helvetica-Bold').fontSize(15).fillColor('#0F172A').text('BUKTI TAMBAH STOK GUDANG', KIRI, judulY, { width: 280 });
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#94A3B8').text(renggang('BARANG MASUK KE GUDANG'), KIRI, judulY + 20);
      doc.font('Helvetica').fontSize(8.5).fillColor('#64748B')
        .text('Stok Gudang bertambah otomatis setelah dokumen ini diposting.', KIRI, judulY + 32, { width: 280 });

      const STATUS_LABEL_NOTA: Record<StockReceiptStatus, string> = { DRAFT: 'Draft', POSTED: 'Posted', REVISED: 'Sudah Direvisi' };
      const STATUS_WARNA_BADGE: Record<StockReceiptStatus, { bg: string; fg: string }> = {
        DRAFT: { bg: '#F1F5F9', fg: '#64748B' },
        POSTED: { bg: '#E6F4EC', fg: HIJAU_HEX },
        REVISED: { bg: '#FEF3C7', fg: '#B45309' },
      };

      const kartuX = 345;
      const kartuW = KANAN - kartuX;
      const kartuY = judulY - 2;
      const kartuH = 74;
      doc.roundedRect(kartuX, kartuY, kartuW, kartuH, 8).fillAndStroke('#EAF6EF', '#BFE3CE');

      const tulisBarisKartu = (label: string, y: number) => {
        doc.font('Helvetica').fontSize(7.5).fillColor('#64748B').text(label, kartuX + 10, y, { width: 70 });
      };
      tulisBarisKartu('No. Dokumen', kartuY + 10);
      doc.font('Courier-Bold').fontSize(9).fillColor('#0F172A')
        .text(r.versionNo > 1 ? `${r.receiptNo} (v${r.versionNo})` : r.receiptNo, kartuX + 10, kartuY + 20, { width: kartuW - 20, align: 'right' });

      tulisBarisKartu('Tanggal', kartuY + 34);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0F172A')
        .text(this.tanggalJakarta(r.receiptDate), kartuX + 10, kartuY + 34, { width: kartuW - 20, align: 'right' });

      tulisBarisKartu('Status', kartuY + 50);
      const badge = STATUS_WARNA_BADGE[r.status];
      const badgeLabel = STATUS_LABEL_NOTA[r.status];
      const badgeW = doc.font('Helvetica-Bold').fontSize(8).widthOfString(badgeLabel) + 14;
      doc.roundedRect(kartuX + kartuW - 10 - badgeW, kartuY + 47, badgeW, 14, 7).fill(badge.bg);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(badge.fg)
        .text(badgeLabel, kartuX + kartuW - 10 - badgeW, kartuY + 51, { width: badgeW, align: 'center' });

      // --- KETERANGAN — baris penuh di bawah kop, kalau diisi ---
      let y = judulY + 54;
      if (r.note) {
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748B').text('KETERANGAN', KIRI, y);
        doc.font('Helvetica').fontSize(9).fillColor('#0F172A').text(r.note, KIRI, y + 11, { width: KANAN - KIRI });
        y += 30;
      } else {
        y += 6;
      }
      doc.font('Helvetica').fontSize(7).fillColor('#94A3B8').text(`Dicetak pada ${dicetakPada}`, KIRI, y);
      y += 14;
      const kolom = [
        { label: 'No.', x: KIRI, w: 28, align: 'center' as const },
        { label: 'Kode', x: KIRI + 28, w: 90, align: 'left' as const },
        { label: 'Nama Barang', x: KIRI + 118, w: 297, align: 'left' as const },
        { label: 'Qty Terima', x: KIRI + 415, w: 100, align: 'right' as const },
      ];
      doc.rect(KIRI, y, KANAN - KIRI, 18).fill(HIJAU_HEX);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF');
      for (const k of kolom) doc.text(k.label, k.x + 4, y + 5, { width: k.w - 8, align: k.align });
      y += 18;

      for (const [i, item] of r.items.entries()) {
        if (y > 720) {
          doc.addPage();
          y = 40;
          doc.rect(KIRI, y, KANAN - KIRI, 18).fill(HIJAU_HEX);
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF');
          for (const k of kolom) doc.text(k.label, k.x + 4, y + 5, { width: k.w - 8, align: k.align });
          y += 18;
        }
        doc.font('Helvetica').fontSize(9).fillColor('#0F172A');
        doc.text(String(i + 1), kolom[0].x + 4, y + 5, { width: kolom[0].w - 8, align: 'center' });
        doc.font('Courier').text(item.product.sku, kolom[1].x + 4, y + 5, { width: kolom[1].w - 8 });
        doc.font('Helvetica').text(item.product.name, kolom[2].x + 4, y + 5, { width: kolom[2].w - 8, ellipsis: true });
        doc.font('Helvetica-Bold').text(item.qtyReceived.toLocaleString('id-ID'), kolom[3].x + 4, y + 5, { width: kolom[3].w - 8, align: 'right' });
        y += 17;
        doc.moveTo(KIRI, y).lineTo(KANAN, y).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
      }

      doc.rect(KIRI, y, KANAN - KIRI, 18).fill('#F8FAFC');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0F172A');
      doc.text('TOTAL', kolom[1].x + 4, y + 5, { width: kolom[2].w });
      doc.text(totalQty.toLocaleString('id-ID'), kolom[3].x + 4, y + 5, { width: kolom[3].w - 8, align: 'right' });
      y += 40;

      // Blok tanda tangan gaya nota jsBerkah (OpnamePrintable "Dihitung Oleh"/
      // "Diketahui Toko"): label tebal, garis kosong untuk tanda tangan, lalu
      // baris "Nama :" / "Tanggal :" — bukan cuma nama polos di bawah garis.
      const tandaTangan = (label: string, nama: string, tanggal: string, x: number) => {
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0F172A').text(label, x, y, { width: 180 });
        doc.moveTo(x, y + 28).lineTo(x + 180, y + 28).lineWidth(0.75).strokeColor('#CBD5E1').stroke();
        doc.font('Helvetica').fontSize(8).fillColor('#475569');
        // SATU pemanggilan .text() per baris (bukan continued) — versi
        // sebelumnya memakai `continued: true` lintas dua .text() dengan `width`
        // per segmen, yang di pdfkit malah membungkus/menumpuk baris berikutnya.
        doc.text(`Nama    : ${nama || '....................................'}`, x, y + 34, { width: 180 });
        doc.text(`Tanggal : ${tanggal}`, x, y + 46, { width: 180 });
      };
      const titik = '....................................';
      tandaTangan('Dibuat Oleh', r.createdBy.fullName, this.tanggalJakarta(r.createdAt), KIRI);
      tandaTangan('Diposting Oleh', r.postedBy?.fullName ?? '', r.postedAt ? this.tanggalJakarta(r.postedAt) : titik, KIRI + 220);

      doc.end();
    });
  }
}
