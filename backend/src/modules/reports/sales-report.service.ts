import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { SaleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyProfileService } from '../company-profile/company-profile.service';
import { effectiveByGroup } from '../../common/effective-version';

export interface FilterLaporanKasir {
  q?: string;
  status?: SaleStatus;
  boothName?: string;
  staffName?: string;
  periodeAwal?: string;
  dicetakOleh?: string;
}

interface BarisLaporan {
  saleNo: string;
  tanggal: Date;
  shift: string;
  staffName: string;
  boothName: string;
  cupCount: number;
  total: number;
  metode: string;
  status: SaleStatus;
  isRevised: boolean;
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

const STATUS_LABEL: Record<SaleStatus, string> = { PENDING: 'Pending', PAID: 'Lunas', VOIDED: 'Dibatalkan' };
const METODE_LABEL: Record<string, string> = { CASH: 'Tunai', QRIS: 'QRIS', SPLIT: 'Split' };

/// Laporan Transaksi Booth - Kasir — daftar (PDF & Excel), mengikuti pola
/// StockHandoverReportService (kop, judul, metadata dua kolom, tabel
/// berkepala warna) supaya konsisten dengan standar tampilan menu Transaksi.
/// Sumber datanya query Prisma langsung + effectiveByGroup, sama seperti
/// SalesService.findAll(), supaya versi lama yang sudah direvisi tidak ikut
/// terhitung dobel di laporan.
@Injectable()
export class SalesReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyProfile: CompanyProfileService,
  ) {}

  private async ambilBaris(filter: FilterLaporanKasir): Promise<BarisLaporan[]> {
    const sales = await this.prisma.sale.findMany({
      where: {
        status: filter.status ?? { in: [SaleStatus.PAID, SaleStatus.VOIDED] },
      },
      include: { booth: true, staff: true, items: true, shiftSession: { include: { shiftTemplate: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const effective = effectiveByGroup(sales).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const q = filter.q?.toLowerCase();
    const awal = filter.periodeAwal ? new Date(filter.periodeAwal) : null;

    return effective
      .filter((s) => {
        const cocokTeks = !q || s.saleNo.toLowerCase().includes(q) || s.staff.fullName.toLowerCase().includes(q);
        const cocokBooth = !filter.boothName || s.booth.name === filter.boothName;
        const cocokStaff = !filter.staffName || s.staff.fullName === filter.staffName;
        const cocokPeriode = !awal || (s.paidAt ?? s.createdAt) >= awal;
        return cocokTeks && cocokBooth && cocokStaff && cocokPeriode;
      })
      .map((s) => ({
        saleNo: s.saleNo,
        tanggal: s.paidAt ?? s.createdAt,
        shift: s.shiftSession.shiftTemplate.name,
        staffName: s.staff.fullName,
        boothName: s.booth.name,
        cupCount: s.items.reduce((sum, i) => sum + i.qty, 0),
        total: Number(s.total),
        metode: s.paymentMethod ? METODE_LABEL[s.paymentMethod] : '-',
        status: s.status,
        isRevised: s.versionNo > 1,
      }));
  }

  private labelPenyaring(filter: FilterLaporanKasir): string {
    const bagian: string[] = [];
    if (filter.q) bagian.push(`Pencarian "${filter.q}"`);
    if (filter.status) bagian.push(`Status ${STATUS_LABEL[filter.status]}`);
    if (filter.boothName) bagian.push(`Booth ${filter.boothName}`);
    if (filter.staffName) bagian.push(`Petugas ${filter.staffName}`);
    return bagian.length ? bagian.join(' · ') : 'Semua transaksi';
  }

  private stempelJakarta(): string {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(
      new Date(),
    );
  }

  private waktuJakarta(d: Date): string {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(d);
  }

  // ─────────────────────────────── EXCEL (daftar) ───────────────────────────────

  async excel(filter: FilterLaporanKasir): Promise<Buffer> {
    const rows = await this.ambilBaris(filter);
    const penyaring = this.labelPenyaring(filter);
    const profil = await this.companyProfile.getForPrint();

    const buku = new ExcelJS.Workbook();
    buku.creator = profil.name;
    buku.created = new Date();

    const lembar = buku.addWorksheet('Transaksi Kasir', {
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
      { width: 18 },
      { width: 12 },
      { width: 18 },
      { width: 16 },
      { width: 10 },
      { width: 14 },
      { width: 10 },
      { width: 12 },
    ];

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
    lembar.getCell('A4').value = 'Daftar Transaksi Booth - Kasir';
    lembar.getCell('A4').font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };

    lembar.mergeCells('A5:C5');
    lembar.getCell('A5').value = 'Seluruh transaksi kasir dari semua Booth';
    lembar.getCell('A5').font = { size: 9, italic: true, color: { argb: 'FF64748B' } };

    const metaKiri: [string, string][] = [
      ['Penyaring', penyaring],
      ['Jumlah transaksi', `${rows.length} transaksi`],
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
    kepala.values = ['No.', 'No. Sale', 'Tanggal', 'Shift', 'Petugas', 'Booth', 'Cup', 'Total', 'Metode', 'Status'];
    kepala.eachCell((sel) => {
      sel.fill = ISI_KEPALA;
      sel.font = HURUF_KEPALA;
      sel.alignment = { vertical: 'middle' };
      sel.border = GARIS;
    });
    kepala.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    kepala.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    kepala.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' };
    kepala.height = 20;

    rows.forEach((r, i) => {
      const baris = lembar.getRow(barisKepala + 1 + i);
      baris.values = [
        i + 1,
        r.isRevised ? `${r.saleNo} (revisi)` : r.saleNo,
        this.waktuJakarta(r.tanggal),
        r.shift,
        r.staffName,
        r.boothName,
        r.cupCount,
        r.total,
        r.metode,
        STATUS_LABEL[r.status],
      ];
      baris.eachCell((sel) => {
        sel.border = GARIS;
        sel.font = { size: 10 };
      });
      baris.getCell(2).font = { size: 10, name: 'Consolas' };
      baris.getCell(7).alignment = { horizontal: 'right' };
      baris.getCell(8).alignment = { horizontal: 'right' };
      baris.getCell(8).numFmt = '#,##0';
      baris.getCell(8).font = { size: 10, bold: true };
      baris.getCell(10).alignment = { horizontal: 'center' };
    });

    if (rows.length > 0) {
      lembar.autoFilter = { from: { row: barisKepala, column: 1 }, to: { row: barisKepala + rows.length, column: 10 } };
    }

    return Buffer.from(await buku.xlsx.writeBuffer());
  }

  // ──────────────────────────────── PDF (daftar) ────────────────────────────────

  async pdf(filter: FilterLaporanKasir): Promise<Buffer> {
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
        .text('Daftar Transaksi Booth - Kasir', KIRI, 28, { width: KANAN - KIRI, align: 'right' });
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748B')
        .text('Seluruh transaksi kasir dari semua Booth', KIRI, 45, { width: KANAN - KIRI, align: 'right' });

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
      tulisMeta('Jumlah transaksi', `${rows.length} transaksi`, metaY + 12, 'left');
      tulisMeta('Dicetak oleh', filter.dicetakOleh ?? '-', metaY + 12, 'right');

      const kolom = [
        { label: 'No.', x: KIRI, w: 24, align: 'center' as const },
        { label: 'No. Sale', x: KIRI + 24, w: 84, align: 'left' as const },
        { label: 'Tanggal', x: KIRI + 108, w: 100, align: 'left' as const },
        { label: 'Shift', x: KIRI + 208, w: 66, align: 'left' as const },
        { label: 'Petugas', x: KIRI + 274, w: 110, align: 'left' as const },
        { label: 'Booth', x: KIRI + 384, w: 90, align: 'left' as const },
        { label: 'Cup', x: KIRI + 474, w: 40, align: 'right' as const },
        { label: 'Total', x: KIRI + 514, w: 80, align: 'right' as const },
        { label: 'Metode', x: KIRI + 594, w: 64, align: 'left' as const },
        { label: 'Status', x: KIRI + 658, w: 80, align: 'center' as const },
      ];

      const tulisKepala = (y: number) => {
        doc.rect(KIRI, y, KANAN - KIRI, 18).fill(HIJAU_HEX);
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
        for (const k of kolom) doc.text(k.label, k.x + 4, y + 5, { width: k.w - 8, align: k.align });
        return y + 18;
      };

      let y = tulisKepala(metaY + 34);

      const STATUS_WARNA: Record<SaleStatus, string> = { PENDING: '#64748B', PAID: '#15803D', VOIDED: '#B91C1C' };

      for (const r of rows) {
        if (y > 520) {
          doc.addPage();
          y = tulisKepala(40);
        }

        doc.font('Courier').fontSize(8).fillColor('#0F172A')
          .text(r.isRevised ? `${r.saleNo} (rev)` : r.saleNo, kolom[1].x + 4, y + 4, { width: kolom[1].w - 8 });
        doc.font('Helvetica').text(this.waktuJakarta(r.tanggal), kolom[2].x + 4, y + 4, { width: kolom[2].w - 8 });
        doc.text(r.shift, kolom[3].x + 4, y + 4, { width: kolom[3].w - 8, ellipsis: true });
        doc.text(r.staffName, kolom[4].x + 4, y + 4, { width: kolom[4].w - 8, ellipsis: true });
        doc.text(r.boothName, kolom[5].x + 4, y + 4, { width: kolom[5].w - 8, ellipsis: true });
        doc.text(String(r.cupCount), kolom[6].x + 4, y + 4, { width: kolom[6].w - 8, align: 'right' });
        doc.font('Helvetica-Bold').text(`Rp${r.total.toLocaleString('id-ID')}`, kolom[7].x + 4, y + 4, { width: kolom[7].w - 8, align: 'right' });
        doc.font('Helvetica').text(r.metode, kolom[8].x + 4, y + 4, { width: kolom[8].w - 8 });
        doc.fillColor(STATUS_WARNA[r.status]).text(STATUS_LABEL[r.status], kolom[9].x + 4, y + 4, { width: kolom[9].w - 8, align: 'center' });

        y += 15;
        doc.moveTo(KIRI, y).lineTo(KANAN, y).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
      }

      doc.end();
    });
  }
}
