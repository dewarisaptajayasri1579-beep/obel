import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { CompanyProfileService } from '../company-profile/company-profile.service';
import { StockHandoversService } from '../stock-handovers/stock-handovers.service';

export type StockHandoverStatus = 'DIAJUKAN' | 'DIPROSES' | 'DITERIMA' | 'DITOLAK' | 'DIBATALKAN';

export interface FilterLaporanSerahTerima {
  q?: string;
  status?: StockHandoverStatus;
  dicetakOleh?: string;
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

const STATUS_LABEL: Record<StockHandoverStatus, string> = {
  DIAJUKAN: 'Diajukan',
  DIPROSES: 'Diproses',
  DITERIMA: 'Diterima',
  DITOLAK: 'Ditolak',
  DIBATALKAN: 'Dibatalkan',
};

const JENIS_LABEL: Record<string, string> = { STOK_AWAL: 'Stok Awal', RE_STOK: 'Re-Stok' };
const SUMBER_LABEL: Record<string, string> = { PETUGAS: 'Petugas', ADMIN: 'Admin' };

/// Laporan Serah Terima Stok — daftar (PDF & Excel) + nota per dokumen,
/// mengikuti pola StockReceiptReportService (kop, judul, metadata dua kolom,
/// tabel berkepala warna) supaya konsisten dengan standar tampilan menu
/// Transaksi. Sumber datanya `StockHandoversService.findAll()`/`findOne()`
/// (gabungan RestockRequest+StockDistribution) — bukan query Prisma langsung
/// — supaya logika jenis/sumber/status tidak dobel ditulis di sini.
@Injectable()
export class StockHandoverReportService {
  constructor(
    private readonly stockHandovers: StockHandoversService,
    private readonly companyProfile: CompanyProfileService,
  ) {}

  private async ambilBaris(filter: FilterLaporanSerahTerima) {
    const rows = await this.stockHandovers.findAllForReport();
    const q = filter.q?.toLowerCase();
    return rows.filter((r) => {
      const cocokTeks = !q || r.docNo.toLowerCase().includes(q) || (r.staffName ?? '').toLowerCase().includes(q);
      const cocokStatus = !filter.status || r.status === filter.status;
      return cocokTeks && cocokStatus;
    });
  }

  private labelPenyaring(filter: FilterLaporanSerahTerima): string {
    const bagian: string[] = [];
    if (filter.q) bagian.push(`Pencarian "${filter.q}"`);
    if (filter.status) bagian.push(`Status ${STATUS_LABEL[filter.status]}`);
    return bagian.length ? bagian.join(' · ') : 'Semua dokumen';
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

  // ─────────────────────────────── EXCEL (daftar) ───────────────────────────────

  async excel(filter: FilterLaporanSerahTerima): Promise<Buffer> {
    const rows = await this.ambilBaris(filter);
    const penyaring = this.labelPenyaring(filter);
    const profil = await this.companyProfile.getForPrint();

    const buku = new ExcelJS.Workbook();
    buku.creator = profil.name;
    buku.created = new Date();

    const lembar = buku.addWorksheet('Serah Terima Stok', {
      views: [{ showGridLines: false }],
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0, footer: 0 },
      },
    });

    lembar.columns = [{ width: 5 }, { width: 16 }, { width: 16 }, { width: 20 }, { width: 16 }, { width: 34 }, { width: 12 }, { width: 12 }, { width: 12 }];

    if (profil.logoPath && profil.logoExt) {
      const imageId = buku.addImage({ filename: profil.logoPath, extension: profil.logoExt });
      lembar.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 32, height: 32 } });
      lembar.getRow(1).height = 26;
    }

    lembar.mergeCells('A1:C1');
    lembar.getCell('A1').value = profil.logoPath ? `        ${profil.name}` : profil.name;
    lembar.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF0F172A' } };

    lembar.mergeCells('D1:I1');
    lembar.getCell('D1').value = profil.address ?? '';
    lembar.getCell('D1').font = { size: 9, color: { argb: 'FF64748B' } };
    lembar.getCell('D1').alignment = { horizontal: 'right' };

    lembar.mergeCells('A4:C4');
    lembar.getCell('A4').value = 'Daftar Serah Terima Stok';
    lembar.getCell('A4').font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };

    lembar.mergeCells('A5:C5');
    lembar.getCell('A5').value = 'Serah terima stok Admin ke Petugas Booth';
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
      lembar.mergeCells(`E${baris}:F${baris}`);
      lembar.getCell(`E${baris}`).value = nilai;
      lembar.getCell(`E${baris}`).font = { size: 10 };
    });

    const barisKepala = 10;
    const kepala = lembar.getRow(barisKepala);
    kepala.values = ['No.', 'No. Dokumen', 'Tanggal', 'Petugas', 'Booth', 'Item', 'Jenis', 'Sumber', 'Status'];
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
        this.tanggalJakarta(new Date(r.date)),
        r.staffName ?? '-',
        r.boothName,
        r.items.map((it) => `${it.productName} x${it.qty}`).join(', '),
        r.jenis ? JENIS_LABEL[r.jenis] : '-',
        SUMBER_LABEL[r.sumber],
        STATUS_LABEL[r.status],
      ];
      baris.eachCell((sel) => {
        sel.border = GARIS;
        sel.font = { size: 10 };
      });
      baris.getCell(2).font = { size: 10, name: 'Consolas' };
    });

    if (rows.length > 0) {
      lembar.autoFilter = { from: { row: barisKepala, column: 1 }, to: { row: barisKepala + rows.length, column: 9 } };
    }

    return Buffer.from(await buku.xlsx.writeBuffer());
  }

  // ──────────────────────────────── PDF (daftar) ────────────────────────────────

  async pdf(filter: FilterLaporanSerahTerima): Promise<Buffer> {
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
        .text('Daftar Serah Terima Stok', KIRI, 28, { width: KANAN - KIRI, align: 'right' });
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748B')
        .text('Serah terima stok Admin ke Petugas Booth', KIRI, 45, { width: KANAN - KIRI, align: 'right' });

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
      tulisMeta('Jumlah dokumen', `${rows.length} dokumen`, metaY + 12, 'left');
      tulisMeta('Dicetak oleh', filter.dicetakOleh ?? '-', metaY + 12, 'right');

      const kolom = [
        { label: 'No.', x: KIRI, w: 26, align: 'center' as const },
        { label: 'No. Dokumen', x: KIRI + 26, w: 100, align: 'left' as const },
        { label: 'Tanggal', x: KIRI + 126, w: 80, align: 'left' as const },
        { label: 'Petugas', x: KIRI + 206, w: 110, align: 'left' as const },
        { label: 'Booth', x: KIRI + 316, w: 90, align: 'left' as const },
        { label: 'Jenis', x: KIRI + 406, w: 80, align: 'left' as const },
        { label: 'Sumber', x: KIRI + 486, w: 70, align: 'left' as const },
        { label: 'Status', x: KIRI + 556, w: 90, align: 'center' as const },
      ];

      const tulisKepala = (y: number) => {
        doc.rect(KIRI, y, KANAN - KIRI, 18).fill(HIJAU_HEX);
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
        for (const k of kolom) doc.text(k.label, k.x + 4, y + 5, { width: k.w - 8, align: k.align });
        return y + 18;
      };

      let y = tulisKepala(metaY + 34);

      const STATUS_WARNA: Record<StockHandoverStatus, string> = {
        DIAJUKAN: '#B45309',
        DIPROSES: '#B45309',
        DITERIMA: '#15803D',
        DITOLAK: '#B91C1C',
        DIBATALKAN: '#64748B',
      };

      for (const r of rows) {
        if (y > 520) {
          doc.addPage();
          y = tulisKepala(40);
        }

        doc.font('Courier').fontSize(8).fillColor('#0F172A').text(r.docNo, kolom[1].x + 4, y + 4, { width: kolom[1].w - 8 });
        doc.font('Helvetica').text(this.tanggalJakarta(new Date(r.date)), kolom[2].x + 4, y + 4, { width: kolom[2].w - 8 });
        doc.text(r.staffName ?? '-', kolom[3].x + 4, y + 4, { width: kolom[3].w - 8, ellipsis: true });
        doc.text(r.boothName, kolom[4].x + 4, y + 4, { width: kolom[4].w - 8, ellipsis: true });
        doc.text(r.jenis ? JENIS_LABEL[r.jenis] : '-', kolom[5].x + 4, y + 4, { width: kolom[5].w - 8 });
        doc.text(SUMBER_LABEL[r.sumber], kolom[6].x + 4, y + 4, { width: kolom[6].w - 8 });
        doc.fillColor(STATUS_WARNA[r.status]).text(STATUS_LABEL[r.status], kolom[7].x + 4, y + 4, { width: kolom[7].w - 8, align: 'center' });

        y += 15;
        doc.moveTo(KIRI, y).lineTo(KANAN, y).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
      }

      doc.end();
    });
  }

  // ──────────────────────────────── PDF (nota per-dokumen) ────────────────────────────────

  async nota(id: string): Promise<Buffer> {
    const r = await this.stockHandovers.findOne(id);
    const totalQty = r.items.reduce((s, i) => s + i.qty, 0);
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

      const teksKiri = profil.logoPath ? KIRI + 38 : KIRI;
      if (profil.logoPath) {
        doc.roundedRect(KIRI, 38, 30, 30, 6).lineWidth(1).strokeColor('#E2E8F0').stroke();
        doc.image(profil.logoPath, KIRI + 3, 41, { fit: [24, 24] });
      }
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#0F172A').text(profil.name, teksKiri, 41);
      doc.font('Helvetica').fontSize(8.5).fillColor('#64748B').text(profil.address ?? '', teksKiri, 57);

      const judulY = 86;
      const renggang = (s: string) => s.split('').join(' ');
      doc.font('Helvetica-Bold').fontSize(15).fillColor('#0F172A').text('BUKTI SERAH TERIMA STOK', KIRI, judulY, { width: 280 });
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#94A3B8').text(renggang('ADMIN KE PETUGAS BOOTH'), KIRI, judulY + 20);
      doc.font('Helvetica').fontSize(8.5).fillColor('#64748B')
        .text('Stok Booth bertambah otomatis setelah Petugas konfirmasi terima.', KIRI, judulY + 32, { width: 280 });

      const STATUS_LABEL_NOTA: Record<StockHandoverStatus, string> = {
        DIAJUKAN: 'Diajukan',
        DIPROSES: 'Diproses',
        DITERIMA: 'Diterima',
        DITOLAK: 'Ditolak',
        DIBATALKAN: 'Dibatalkan',
      };
      const STATUS_WARNA_BADGE: Record<StockHandoverStatus, { bg: string; fg: string }> = {
        DIAJUKAN: { bg: '#FEF3C7', fg: '#B45309' },
        DIPROSES: { bg: '#FEF3C7', fg: '#B45309' },
        DITERIMA: { bg: '#E6F4EC', fg: HIJAU_HEX },
        DITOLAK: { bg: '#FEE2E2', fg: '#B91C1C' },
        DIBATALKAN: { bg: '#F1F5F9', fg: '#64748B' },
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
        .text(r.docNo, kartuX + 10, kartuY + 20, { width: kartuW - 20, align: 'right' });

      tulisBarisKartu('Tanggal', kartuY + 34);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0F172A')
        .text(this.tanggalJakarta(new Date(r.date)), kartuX + 10, kartuY + 34, { width: kartuW - 20, align: 'right' });

      tulisBarisKartu('Status', kartuY + 50);
      const badge = STATUS_WARNA_BADGE[r.status];
      const badgeLabel = STATUS_LABEL_NOTA[r.status];
      const badgeW = doc.font('Helvetica-Bold').fontSize(8).widthOfString(badgeLabel) + 14;
      doc.roundedRect(kartuX + kartuW - 10 - badgeW, kartuY + 47, badgeW, 14, 7).fill(badge.bg);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(badge.fg)
        .text(badgeLabel, kartuX + kartuW - 10 - badgeW, kartuY + 51, { width: badgeW, align: 'center' });

      let y = judulY + 54;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748B').text('PETUGAS / BOOTH', KIRI, y);
      doc.font('Helvetica').fontSize(9).fillColor('#0F172A')
        .text(`${r.staffName ?? '-'} — ${r.boothName}`, KIRI, y + 11, { width: KANAN - KIRI });
      y += 30;
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
        { label: 'Nama Barang', x: KIRI + 28, w: 387, align: 'left' as const },
        { label: 'Qty', x: KIRI + 415, w: 100, align: 'right' as const },
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
        doc.text(item.productName, kolom[1].x + 4, y + 5, { width: kolom[1].w - 8, ellipsis: true });
        doc.font('Helvetica-Bold').text(item.qty.toLocaleString('id-ID'), kolom[2].x + 4, y + 5, { width: kolom[2].w - 8, align: 'right' });
        y += 17;
        doc.moveTo(KIRI, y).lineTo(KANAN, y).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
      }

      doc.rect(KIRI, y, KANAN - KIRI, 18).fill('#F8FAFC');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0F172A');
      doc.text('TOTAL', kolom[1].x + 4, y + 5, { width: kolom[1].w });
      doc.text(totalQty.toLocaleString('id-ID'), kolom[2].x + 4, y + 5, { width: kolom[2].w - 8, align: 'right' });
      y += 40;

      const tandaTangan = (label: string, nama: string, x: number) => {
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0F172A').text(label, x, y, { width: 220 });
        doc.moveTo(x, y + 28).lineTo(x + 220, y + 28).lineWidth(0.75).strokeColor('#CBD5E1').stroke();
        doc.font('Helvetica').fontSize(8).fillColor('#475569');
        doc.text(`Nama : ${nama || '....................................'}`, x, y + 34, { width: 220 });
      };
      tandaTangan('Dikirim/Disetujui Oleh', profil.name, KIRI);
      tandaTangan('Diterima Oleh Petugas', r.staffName ?? '', KIRI + 250);

      doc.end();
    });
  }
}
