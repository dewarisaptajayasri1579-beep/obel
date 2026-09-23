import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyProfileService } from '../company-profile/company-profile.service';
import { rangeJakarta } from '../../common/jakarta-date';

export interface FilterLaporanStokRusak {
  dateFrom?: string;
  dateTo?: string;
  boothId?: string;
  dicetakOleh?: string;
}

export interface BarisStokRusak {
  distributionId: string;
  distributionNo: string;
  boothName: string;
  staffName: string | null;
  productName: string;
  qtySent: number;
  qtyReceived: number;
  qtyRusak: number;
  receivedAt: Date;
  reasonNote: string | null;
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

/// Laporan Stok Rusak — agregasi StockDistributionItem yang alasan
/// selisihnya "RUSAK" (dipilih Petugas saat konfirmasi terima, lihat
/// petugas/terima-stok/page.tsx). Beda dari StockHandoverReportService yang
/// melaporkan dokumen Serah Terima Stok secara umum — ini fokus ke qty yang
/// hilang karena rusak saja, per baris item (bukan per dokumen), supaya
/// Admin/Owner bisa lihat produk mana yang paling sering rusak.
@Injectable()
export class StockDamageReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyProfile: CompanyProfileService,
  ) {}

  private async ambilBaris(filter: FilterLaporanStokRusak): Promise<BarisStokRusak[]> {
    const rentang =
      filter.dateFrom && filter.dateTo ? rangeJakarta(filter.dateFrom, filter.dateTo) : null;

    const items = await this.prisma.stockDistributionItem.findMany({
      where: {
        discrepancyReasonCode: 'RUSAK',
        distribution: {
          ...(filter.boothId ? { boothId: filter.boothId } : {}),
          ...(rentang ? { receivedAt: { gte: rentang.awal, lt: rentang.akhir } } : {}),
        },
      },
      include: {
        product: true,
        distribution: { include: { booth: true, receivedBy: true } },
      },
      orderBy: { distribution: { receivedAt: 'desc' } },
    });

    return items
      .filter((i) => i.distribution.receivedAt !== null)
      .map((i) => ({
        distributionId: i.distributionId,
        distributionNo: i.distribution.distributionNo,
        boothName: i.distribution.booth.name,
        staffName: i.distribution.receivedBy?.fullName ?? null,
        productName: i.product.name,
        qtySent: i.qtySent,
        qtyReceived: i.qtyReceived ?? 0,
        qtyRusak: i.qtySent - (i.qtyReceived ?? 0),
        receivedAt: i.distribution.receivedAt!,
        reasonNote: i.discrepancyNote,
      }));
  }

  private labelPenyaring(filter: FilterLaporanStokRusak): string {
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

  async data(filter: FilterLaporanStokRusak) {
    const rows = await this.ambilBaris(filter);
    const byProduct = new Map<string, { productName: string; totalQtyRusak: number; kejadian: number }>();
    for (const r of rows) {
      const acc = byProduct.get(r.productName) ?? { productName: r.productName, totalQtyRusak: 0, kejadian: 0 };
      acc.totalQtyRusak += r.qtyRusak;
      acc.kejadian += 1;
      byProduct.set(r.productName, acc);
    }
    return {
      rows,
      totalQtyRusak: rows.reduce((s, r) => s + r.qtyRusak, 0),
      totalKejadian: rows.length,
      perProduk: Array.from(byProduct.values()).sort((a, b) => b.totalQtyRusak - a.totalQtyRusak),
    };
  }

  // ─────────────────────────────── EXCEL ───────────────────────────────

  async excel(filter: FilterLaporanStokRusak): Promise<Buffer> {
    const rows = await this.ambilBaris(filter);
    const penyaring = this.labelPenyaring(filter);
    const profil = await this.companyProfile.getForPrint();

    const buku = new ExcelJS.Workbook();
    buku.creator = profil.name;
    buku.created = new Date();

    const lembar = buku.addWorksheet('Stok Rusak', {
      views: [{ showGridLines: false }],
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0, footer: 0 },
      },
    });

    lembar.columns = [{ width: 5 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 20 }, { width: 24 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 30 }];

    if (profil.logoPath && profil.logoExt) {
      const imageId = buku.addImage({ filename: profil.logoPath, extension: profil.logoExt });
      lembar.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 32, height: 32 } });
      lembar.getRow(1).height = 26;
    }

    lembar.mergeCells('A1:C1');
    lembar.getCell('A1').value = profil.logoPath ? `        ${profil.name}` : profil.name;
    lembar.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF0F172A' } };

    lembar.mergeCells('D1:J1');
    lembar.getCell('D1').value = profil.address ?? '';
    lembar.getCell('D1').font = { size: 9, color: { argb: 'FF64748B' } };
    lembar.getCell('D1').alignment = { horizontal: 'right' };

    lembar.mergeCells('A4:C4');
    lembar.getCell('A4').value = 'Laporan Stok Rusak';
    lembar.getCell('A4').font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };

    lembar.mergeCells('A5:C5');
    lembar.getCell('A5').value = 'Qty selisih terima yang ditandai Rusak oleh Petugas Booth';
    lembar.getCell('A5').font = { size: 9, italic: true, color: { argb: 'FF64748B' } };

    const metaKiri: [string, string][] = [
      ['Penyaring', penyaring],
      ['Total qty rusak', `${rows.reduce((s, r) => s + r.qtyRusak, 0)} cup`],
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
    kepala.values = ['No.', 'No. Dokumen', 'Tanggal Terima', 'Booth', 'Petugas', 'Produk', 'Qty Kirim', 'Qty Terima', 'Qty Rusak', 'Catatan'];
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
        r.distributionNo,
        this.tanggalJakarta(r.receivedAt),
        r.boothName,
        r.staffName ?? '-',
        r.productName,
        r.qtySent,
        r.qtyReceived,
        r.qtyRusak,
        r.reasonNote ?? '-',
      ];
      baris.eachCell((sel) => {
        sel.border = GARIS;
        sel.font = { size: 10 };
      });
      baris.getCell(2).font = { size: 10, name: 'Consolas' };
      baris.getCell(9).font = { size: 10, bold: true, color: { argb: 'FFB91C1C' } };
    });

    if (rows.length > 0) {
      lembar.autoFilter = { from: { row: barisKepala, column: 1 }, to: { row: barisKepala + rows.length, column: 10 } };
    }

    return Buffer.from(await buku.xlsx.writeBuffer());
  }

  // ──────────────────────────────── PDF ────────────────────────────────

  async pdf(filter: FilterLaporanStokRusak): Promise<Buffer> {
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

      const teksKiri = profil.logoPath ? KIRI + 42 : KIRI;
      if (profil.logoPath) doc.image(profil.logoPath, KIRI, 24, { fit: [36, 36] });
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#0F172A').text(profil.name, teksKiri, 28);
      doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(profil.address ?? '', teksKiri, 45);

      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0F172A')
        .text('Laporan Stok Rusak', KIRI, 28, { width: KANAN - KIRI, align: 'right' });
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748B')
        .text('Qty selisih terima yang ditandai Rusak oleh Petugas Booth', KIRI, 45, { width: KANAN - KIRI, align: 'right' });

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
      tulisMeta('Total qty rusak', `${rows.reduce((s, r) => s + r.qtyRusak, 0)} cup`, metaY + 12, 'left');
      tulisMeta('Dicetak oleh', filter.dicetakOleh ?? '-', metaY + 12, 'right');

      const kolom = [
        { label: 'No.', x: KIRI, w: 26, align: 'center' as const },
        { label: 'No. Dokumen', x: KIRI + 26, w: 90, align: 'left' as const },
        { label: 'Tanggal', x: KIRI + 116, w: 70, align: 'left' as const },
        { label: 'Booth', x: KIRI + 186, w: 90, align: 'left' as const },
        { label: 'Petugas', x: KIRI + 276, w: 100, align: 'left' as const },
        { label: 'Produk', x: KIRI + 376, w: 110, align: 'left' as const },
        { label: 'Qty Kirim', x: KIRI + 486, w: 55, align: 'right' as const },
        { label: 'Qty Terima', x: KIRI + 541, w: 55, align: 'right' as const },
        { label: 'Qty Rusak', x: KIRI + 596, w: 55, align: 'right' as const },
        { label: 'Catatan', x: KIRI + 651, w: 135, align: 'left' as const },
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

        doc.font('Courier').fontSize(7.5).fillColor('#0F172A').text(r.distributionNo, kolom[1].x + 4, y + 4, { width: kolom[1].w - 8 });
        doc.font('Helvetica').text(this.tanggalJakarta(r.receivedAt), kolom[2].x + 4, y + 4, { width: kolom[2].w - 8 });
        doc.text(r.boothName, kolom[3].x + 4, y + 4, { width: kolom[3].w - 8, ellipsis: true });
        doc.text(r.staffName ?? '-', kolom[4].x + 4, y + 4, { width: kolom[4].w - 8, ellipsis: true });
        doc.text(r.productName, kolom[5].x + 4, y + 4, { width: kolom[5].w - 8, ellipsis: true });
        doc.text(String(r.qtySent), kolom[6].x + 4, y + 4, { width: kolom[6].w - 8, align: 'right' });
        doc.text(String(r.qtyReceived), kolom[7].x + 4, y + 4, { width: kolom[7].w - 8, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('#B91C1C').text(String(r.qtyRusak), kolom[8].x + 4, y + 4, { width: kolom[8].w - 8, align: 'right' });
        doc.font('Helvetica').fillColor('#0F172A').text(r.reasonNote ?? '-', kolom[9].x + 4, y + 4, { width: kolom[9].w - 8, ellipsis: true });

        y += 15;
        doc.moveTo(KIRI, y).lineTo(KANAN, y).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
      }

      doc.end();
    });
  }
}
