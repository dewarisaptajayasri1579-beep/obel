import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyProfileService } from '../company-profile/company-profile.service';
import { rangeJakarta } from '../../common/jakarta-date';

export interface FilterLaporanStokSelisih {
  dateFrom?: string;
  dateTo?: string;
  boothId?: string;
  dicetakOleh?: string;
}

export type JenisStokSelisih = 'KIRIM_STOK' | 'PENGEMBALIAN_STOK';
export type TindakLanjutStokSelisih = 'RUSAK' | 'GANTI_RUGI_PETUGAS' | 'LAINNYA';

export interface BarisStokSelisih {
  id: string;
  jenis: JenisStokSelisih;
  docNo: string;
  tanggal: Date;
  boothName: string;
  staffName: string | null;
  productName: string;
  qtyDiajukan: number | null;
  qtyDiterima: number | null;
  selisih: number;
  tindakLanjut: TindakLanjutStokSelisih;
  catatan: string | null;
}

const JENIS_LABEL: Record<JenisStokSelisih, string> = {
  KIRIM_STOK: 'Kirim Stok',
  PENGEMBALIAN_STOK: 'Pengembalian Stok',
};

const TINDAK_LANJUT_LABEL: Record<TindakLanjutStokSelisih, string> = {
  RUSAK: 'Rusak',
  GANTI_RUGI_PETUGAS: 'Ganti Rugi Petugas',
  LAINNYA: 'Lainnya',
};

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

/// Laporan Stok Selisih — gabungan SEMUA selisih stok yang sudah diberi
/// Tindak Lanjut Admin (Rusak/Ganti Rugi Petugas/Lainnya), dari DUA sumber:
/// - Kirim Stok: StockDistributionItem (Koreksi Penerimaan, distributions.
///   service.ts correctReceipt) + StaffLiability berdistributionId.
/// - Pengembalian Stok: StockReturnItem (approve Stok Kembali, returns.
///   service.ts receive) + StaffLiability berstockReturnId.
/// "Salah Hitung" SENGAJA tidak muncul di sini — qty yang sudah dikoreksi
/// itu sendiri representasinya, tidak dianggap kerugian/kejadian yang perlu
/// dilaporkan (lihat komentar di kedua service di atas).
@Injectable()
export class StockDiscrepancyReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyProfile: CompanyProfileService,
  ) {}

  private async ambilBaris(filter: FilterLaporanStokSelisih): Promise<BarisStokSelisih[]> {
    const rentang = filter.dateFrom && filter.dateTo ? rangeJakarta(filter.dateFrom, filter.dateTo) : null;

    const [distItems, distLiabilities, returnItems, returnLiabilities] = await Promise.all([
      this.prisma.stockDistributionItem.findMany({
        where: {
          discrepancyReasonCode: { in: ['RUSAK', 'LAINNYA'] },
          distribution: {
            ...(filter.boothId ? { boothId: filter.boothId } : {}),
            ...(rentang ? { receivedAt: { gte: rentang.awal, lt: rentang.akhir } } : {}),
          },
        },
        include: { product: true, distribution: { include: { booth: true, receivedBy: true } } },
      }),
      this.prisma.staffLiability.findMany({
        where: {
          distributionId: { not: null },
          distribution: {
            ...(filter.boothId ? { boothId: filter.boothId } : {}),
            ...(rentang ? { receivedAt: { gte: rentang.awal, lt: rentang.akhir } } : {}),
          },
        },
        include: { product: true, staff: true, distribution: { include: { booth: true } } },
      }),
      this.prisma.stockReturnItem.findMany({
        where: {
          discrepancyReasonCode: { in: ['RUSAK', 'LAINNYA'] },
          stockReturn: {
            ...(filter.boothId ? { boothId: filter.boothId } : {}),
            ...(rentang ? { receivedAt: { gte: rentang.awal, lt: rentang.akhir } } : {}),
          },
        },
        include: { product: true, stockReturn: { include: { booth: true, submittedBy: true } } },
      }),
      this.prisma.staffLiability.findMany({
        where: {
          stockReturnId: { not: null },
          stockReturn: {
            ...(filter.boothId ? { boothId: filter.boothId } : {}),
            ...(rentang ? { receivedAt: { gte: rentang.awal, lt: rentang.akhir } } : {}),
          },
        },
        include: { product: true, staff: true, stockReturn: { include: { booth: true } } },
      }),
    ]);

    const rows: BarisStokSelisih[] = [];

    for (const i of distItems) {
      if (!i.distribution.receivedAt) continue;
      const qtyReceived = i.qtyReceived ?? 0;
      rows.push({
        id: `dist-item-${i.id}`,
        jenis: 'KIRIM_STOK',
        docNo: i.distribution.distributionNo,
        tanggal: i.distribution.receivedAt,
        boothName: i.distribution.booth.name,
        staffName: i.distribution.receivedBy?.fullName ?? null,
        productName: i.product.name,
        qtyDiajukan: i.qtySent,
        qtyDiterima: qtyReceived,
        selisih: qtyReceived - i.qtySent,
        tindakLanjut: i.discrepancyReasonCode as TindakLanjutStokSelisih,
        catatan: i.discrepancyNote,
      });
    }

    for (const l of distLiabilities) {
      if (!l.distribution?.receivedAt) continue;
      rows.push({
        id: `dist-liability-${l.id}`,
        jenis: 'KIRIM_STOK',
        docNo: l.distribution.distributionNo,
        tanggal: l.distribution.receivedAt,
        boothName: l.distribution.booth.name,
        staffName: l.staff.fullName,
        productName: l.product.name,
        qtyDiajukan: null,
        qtyDiterima: null,
        selisih: -l.qty,
        tindakLanjut: 'GANTI_RUGI_PETUGAS',
        catatan: l.note,
      });
    }

    for (const i of returnItems) {
      if (!i.stockReturn.receivedAt) continue;
      const qtyReceived = i.qtyReceived ?? 0;
      rows.push({
        id: `return-item-${i.id}`,
        jenis: 'PENGEMBALIAN_STOK',
        docNo: i.stockReturn.returnNo,
        tanggal: i.stockReturn.receivedAt,
        boothName: i.stockReturn.booth.name,
        staffName: i.stockReturn.submittedBy.fullName,
        productName: i.product.name,
        qtyDiajukan: i.qtySubmitted,
        qtyDiterima: qtyReceived,
        selisih: qtyReceived - i.qtySubmitted,
        tindakLanjut: i.discrepancyReasonCode as TindakLanjutStokSelisih,
        catatan: i.discrepancyNote,
      });
    }

    for (const l of returnLiabilities) {
      if (!l.stockReturn?.receivedAt) continue;
      rows.push({
        id: `return-liability-${l.id}`,
        jenis: 'PENGEMBALIAN_STOK',
        docNo: l.stockReturn.returnNo,
        tanggal: l.stockReturn.receivedAt,
        boothName: l.stockReturn.booth.name,
        staffName: l.staff.fullName,
        productName: l.product.name,
        qtyDiajukan: null,
        qtyDiterima: null,
        selisih: -l.qty,
        tindakLanjut: 'GANTI_RUGI_PETUGAS',
        catatan: l.note,
      });
    }

    return rows.sort((a, b) => b.tanggal.getTime() - a.tanggal.getTime());
  }

  private labelPenyaring(filter: FilterLaporanStokSelisih): string {
    const bagian: string[] = [];
    if (filter.dateFrom && filter.dateTo) bagian.push(`Periode ${filter.dateFrom} s/d ${filter.dateTo}`);
    if (filter.boothId) bagian.push('Booth terpilih');
    return bagian.length ? bagian.join(' · ') : 'Semua periode & Booth';
  }

  private stempelJakarta(): string {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(
      new Date(),
    );
  }

  private tanggalJakarta(d: Date): string {
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(
      d,
    );
  }

  async data(filter: FilterLaporanStokSelisih) {
    const rows = await this.ambilBaris(filter);
    const byProduct = new Map<string, { productName: string; totalSelisih: number; kejadian: number }>();
    for (const r of rows) {
      const acc = byProduct.get(r.productName) ?? { productName: r.productName, totalSelisih: 0, kejadian: 0 };
      acc.totalSelisih += Math.abs(r.selisih);
      acc.kejadian += 1;
      byProduct.set(r.productName, acc);
    }
    return {
      rows,
      totalSelisih: rows.reduce((s, r) => s + Math.abs(r.selisih), 0),
      totalKejadian: rows.length,
      totalGantiRugi: rows.filter((r) => r.tindakLanjut === 'GANTI_RUGI_PETUGAS').length,
      perProduk: Array.from(byProduct.values()).sort((a, b) => b.totalSelisih - a.totalSelisih),
    };
  }

  // ─────────────────────────────── EXCEL ───────────────────────────────

  async excel(filter: FilterLaporanStokSelisih): Promise<Buffer> {
    const rows = await this.ambilBaris(filter);
    const penyaring = this.labelPenyaring(filter);
    const profil = await this.companyProfile.getForPrint();

    const buku = new ExcelJS.Workbook();
    buku.creator = profil.name;
    buku.created = new Date();

    const lembar = buku.addWorksheet('Stok Selisih', {
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
      { width: 16 },
      { width: 16 },
      { width: 20 },
      { width: 24 },
      { width: 16 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 18 },
      { width: 30 },
    ];

    if (profil.logoImage && profil.logoExt) {
      const imageId = buku.addImage({ buffer: profil.logoImage as any, extension: profil.logoExt });
      lembar.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 32, height: 32 } });
      lembar.getRow(1).height = 26;
    }

    lembar.mergeCells('A1:C1');
    lembar.getCell('A1').value = profil.logoImage ? `        ${profil.name}` : profil.name;
    lembar.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF0F172A' } };

    lembar.mergeCells('D1:L1');
    lembar.getCell('D1').value = profil.address ?? '';
    lembar.getCell('D1').font = { size: 9, color: { argb: 'FF64748B' } };
    lembar.getCell('D1').alignment = { horizontal: 'right' };

    lembar.mergeCells('A4:C4');
    lembar.getCell('A4').value = 'Rekap Stok Selisih';
    lembar.getCell('A4').font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };

    lembar.mergeCells('A5:C5');
    lembar.getCell('A5').value = 'Selisih Kirim Stok & Pengembalian Stok yang sudah diberi Tindak Lanjut Admin';
    lembar.getCell('A5').font = { size: 9, italic: true, color: { argb: 'FF64748B' } };

    const metaKiri: [string, string][] = [
      ['Penyaring', penyaring],
      ['Total kejadian', `${rows.length}`],
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
      lembar.mergeCells(`E${baris}:F${baris}`);
      lembar.getCell(`E${baris}`).value = nilai;
      lembar.getCell(`E${baris}`).font = { size: 10 };
    });

    const barisKepala = 10;
    const kepala = lembar.getRow(barisKepala);
    kepala.values = [
      'No.',
      'No. Dokumen',
      'Tanggal',
      'Jenis',
      'Booth',
      'Petugas',
      'Produk',
      'Qty Diajukan',
      'Qty Diterima',
      'Selisih',
      'Tindak Lanjut',
      'Catatan',
    ];
    kepala.eachCell((sel) => {
      sel.fill = ISI_KEPALA;
      sel.font = HURUF_KEPALA;
      sel.alignment = { vertical: 'middle' };
      sel.border = GARIS;
    });
    kepala.height = 20;

    rows.forEach((r, i) => {
      const baris = lembar.getRow(barisKepala + 1 + i);
      baris.values = [
        i + 1,
        r.docNo,
        this.tanggalJakarta(r.tanggal),
        JENIS_LABEL[r.jenis],
        r.boothName,
        r.staffName ?? '-',
        r.productName,
        r.qtyDiajukan ?? '-',
        r.qtyDiterima ?? '-',
        r.selisih,
        TINDAK_LANJUT_LABEL[r.tindakLanjut],
        r.catatan ?? '-',
      ];
      baris.eachCell((sel) => {
        sel.border = GARIS;
        sel.font = { size: 10 };
      });
      baris.getCell(2).font = { size: 10, name: 'Consolas' };
      baris.getCell(10).font = { size: 10, bold: true, color: { argb: 'FFB91C1C' } };
    });

    if (rows.length > 0) {
      lembar.autoFilter = { from: { row: barisKepala, column: 1 }, to: { row: barisKepala + rows.length, column: 12 } };
    }

    return Buffer.from(await buku.xlsx.writeBuffer());
  }

  // ──────────────────────────────── PDF ────────────────────────────────

  async pdf(filter: FilterLaporanStokSelisih): Promise<Buffer> {
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
        .text('Rekap Stok Selisih', KIRI, 28, { width: KANAN - KIRI, align: 'right' });
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748B')
        .text('Selisih Kirim Stok & Pengembalian Stok yang sudah diberi Tindak Lanjut Admin', KIRI, 45, { width: KANAN - KIRI, align: 'right' });

      doc.moveTo(KIRI, 62).lineTo(KANAN, 62).lineWidth(1.5).strokeColor('#1E293B').stroke();

      const metaY = 70;
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
      tulisMeta('Total kejadian', `${rows.length}`, metaY + 12, 'left');
      tulisMeta('Dicetak oleh', filter.dicetakOleh ?? '-', metaY + 12, 'right');

      const kolom = [
        { label: 'No.', x: KIRI, w: 22, align: 'center' as const },
        { label: 'No. Dokumen', x: KIRI + 22, w: 78, align: 'left' as const },
        { label: 'Tanggal', x: KIRI + 100, w: 55, align: 'left' as const },
        { label: 'Jenis', x: KIRI + 155, w: 80, align: 'left' as const },
        { label: 'Booth', x: KIRI + 235, w: 75, align: 'left' as const },
        { label: 'Petugas', x: KIRI + 310, w: 80, align: 'left' as const },
        { label: 'Produk', x: KIRI + 390, w: 85, align: 'left' as const },
        { label: 'Selisih', x: KIRI + 475, w: 45, align: 'right' as const },
        { label: 'Tindak Lanjut', x: KIRI + 520, w: 90, align: 'left' as const },
        { label: 'Catatan', x: KIRI + 610, w: 176, align: 'left' as const },
      ];

      const tulisKepala = (y: number) => {
        doc.rect(KIRI, y, KANAN - KIRI, 18).fill(HIJAU_HEX);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFFFFF');
        for (const k of kolom) doc.text(k.label, k.x + 4, y + 5, { width: k.w - 8, align: k.align });
        return y + 18;
      };

      let y = tulisKepala(metaY + 34);

      for (const r of rows) {
        if (y > 520) {
          doc.addPage();
          y = tulisKepala(40);
        }

        doc.font('Courier').fontSize(7.5).fillColor('#0F172A').text(r.docNo, kolom[1].x + 4, y + 4, { width: kolom[1].w - 8 });
        doc.font('Helvetica').text(this.tanggalJakarta(r.tanggal), kolom[2].x + 4, y + 4, { width: kolom[2].w - 8 });
        doc.text(JENIS_LABEL[r.jenis], kolom[3].x + 4, y + 4, { width: kolom[3].w - 8, ellipsis: true });
        doc.text(r.boothName, kolom[4].x + 4, y + 4, { width: kolom[4].w - 8, ellipsis: true });
        doc.text(r.staffName ?? '-', kolom[5].x + 4, y + 4, { width: kolom[5].w - 8, ellipsis: true });
        doc.text(r.productName, kolom[6].x + 4, y + 4, { width: kolom[6].w - 8, ellipsis: true });
        doc.font('Helvetica-Bold').fillColor('#B91C1C').text(String(r.selisih), kolom[7].x + 4, y + 4, { width: kolom[7].w - 8, align: 'right' });
        doc.font('Helvetica').fillColor('#0F172A').text(TINDAK_LANJUT_LABEL[r.tindakLanjut], kolom[8].x + 4, y + 4, { width: kolom[8].w - 8, ellipsis: true });
        doc.text(r.catatan ?? '-', kolom[9].x + 4, y + 4, { width: kolom[9].w - 8, ellipsis: true });

        y += 15;
        doc.moveTo(KIRI, y).lineTo(KANAN, y).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
      }

      doc.end();
    });
  }
}
