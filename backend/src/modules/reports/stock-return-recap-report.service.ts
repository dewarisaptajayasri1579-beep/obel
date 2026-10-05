import { Injectable } from '@nestjs/common';
import { Prisma, ReturnStatus } from '@prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyProfileService } from '../company-profile/company-profile.service';
import { CorrectionsService } from '../corrections/corrections.service';
import { rangeJakarta } from '../../common/jakarta-date';

export interface FilterRekapPengembalian {
  dateFrom?: string;
  dateTo?: string;
  boothId?: string;
  productId?: string;
  dicetakOleh?: string;
}

/// Angka satu baris rekap (per Booth × Produk), subtotal Booth, atau grand total.
/// Diajukan/Diterima/Selisih hanya dari Return yang SUDAH diterima Gudang;
/// Return yang masih menunggu approve masuk `menunggu` saja.
export interface AngkaRekapPengembalian {
  jumlahDokumen: number;
  qtyDiajukan: number;
  qtyDiterima: number;
  selisih: number;
  rusak: number;
  gantiRugi: number;
  lainnya: number;
  menunggu: number;
}

export interface BarisRekapPengembalian extends AngkaRekapPengembalian {
  productId: string;
  productName: string;
}

export interface BoothRekapPengembalian {
  boothId: string;
  boothName: string;
  rows: BarisRekapPengembalian[];
  subtotal: AngkaRekapPengembalian;
}

const DITERIMA: ReturnStatus[] = [ReturnStatus.RECEIVED, ReturnStatus.DISCREPANCY];

const HIJAU = '0B5D34';
const HIJAU_HEX = '#0B5D34';

const ISI_KEPALA: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${HIJAU}` } };
const HURUF_KEPALA: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } };
const ISI_SUBTOTAL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

const GARIS: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

const KOLOM_ANGKA: { label: string; key: keyof AngkaRekapPengembalian }[] = [
  { label: 'Dokumen', key: 'jumlahDokumen' },
  { label: 'Diajukan', key: 'qtyDiajukan' },
  { label: 'Diterima', key: 'qtyDiterima' },
  { label: 'Selisih', key: 'selisih' },
  { label: 'Rusak', key: 'rusak' },
  { label: 'Ganti Rugi', key: 'gantiRugi' },
  { label: 'Lainnya', key: 'lainnya' },
  { label: 'Menunggu', key: 'menunggu' },
];

const angkaKosong = (): AngkaRekapPengembalian => ({
  jumlahDokumen: 0,
  qtyDiajukan: 0,
  qtyDiterima: 0,
  selisih: 0,
  rusak: 0,
  gantiRugi: 0,
  lainnya: 0,
  menunggu: 0,
});

function tambahkan(ke: AngkaRekapPengembalian, dari: AngkaRekapPengembalian) {
  for (const { key } of KOLOM_ANGKA) ke[key] += dari[key];
}

const urutNama = (a: string, b: string) => a.localeCompare(b, 'id', { numeric: true });

/// Rekap Pengembalian Stok (C5) — total stok yang dikembalikan Booth ke Gudang
/// per Booth × Produk dalam satu periode. Periode memakai TANGGAL SHIFT
/// (ShiftSession.businessDate) supaya sejalan dengan laporan penjualan dan
/// angka bulan lalu tidak bergeser walau Admin telat approve; Return tanpa
/// shift memakai tanggal diajukan. Return yang dibatalkan/direvisi (CANCELLED)
/// tidak dihitung — versi penggantinya yang dihitung. Diterima = angka efektif
/// setelah Koreksi Penerimaan; Rusak/Lainnya/Ganti Rugi = Tindak Lanjut Admin
/// saat approve. Rincian per kejadian ada di Rekap Stok Selisih.
@Injectable()
export class StockReturnRecapReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyProfile: CompanyProfileService,
    private readonly corrections: CorrectionsService,
  ) {}

  private filterPeriode(filter: FilterRekapPengembalian): Prisma.StockReturnWhereInput {
    if (!filter.dateFrom || !filter.dateTo) return {};
    const rentang = rangeJakarta(filter.dateFrom, filter.dateTo);
    // businessDate kolom DATE polos: bandingkan dengan tanggal kalender apa adanya (UTC).
    const tanggal = (s: string) => new Date(`${s}T00:00:00.000Z`);
    return {
      OR: [
        { shiftSession: { businessDate: { gte: tanggal(filter.dateFrom), lte: tanggal(filter.dateTo) } } },
        { shiftSessionId: null, submittedAt: { gte: rentang.awal, lt: rentang.akhir } },
      ],
    };
  }

  async data(filter: FilterRekapPengembalian) {
    const items = await this.prisma.stockReturnItem.findMany({
      where: {
        ...(filter.productId ? { productId: filter.productId } : {}),
        stockReturn: {
          status: { in: [ReturnStatus.SUBMITTED, ...DITERIMA] },
          ...(filter.boothId ? { boothId: filter.boothId } : {}),
          ...this.filterPeriode(filter),
        },
      },
      include: { product: true, stockReturn: { include: { booth: true } } },
    });

    const returnIds = [...new Set(items.map((i) => i.stockReturnId))];
    const [koreksi, liabilities] = await Promise.all([
      this.corrections.deltaKoreksiPenerimaan('stock_return', returnIds),
      this.prisma.staffLiability.findMany({ where: { stockReturnId: { in: returnIds } } }),
    ]);
    const gantiRugi = new Map<string, number>();
    for (const l of liabilities) {
      const key = `${l.stockReturnId}:${l.productId}`;
      gantiRugi.set(key, (gantiRugi.get(key) ?? 0) + l.qty);
    }

    const perBooth = new Map<string, BoothRekapPengembalian>();
    const perBaris = new Map<string, BarisRekapPengembalian>();
    // Satu dokumen bisa berisi beberapa produk: subtotal & total menghitung dokumen unik.
    const dokumenPerBooth = new Map<string, Set<string>>();
    for (const i of items) {
      const r = i.stockReturn;
      let booth = perBooth.get(r.boothId);
      if (!booth) {
        booth = { boothId: r.boothId, boothName: r.booth.name, rows: [], subtotal: angkaKosong() };
        perBooth.set(r.boothId, booth);
      }
      const kunciBaris = `${r.boothId}:${i.productId}`;
      let baris = perBaris.get(kunciBaris);
      if (!baris) {
        baris = { productId: i.productId, productName: i.product.name, ...angkaKosong() };
        perBaris.set(kunciBaris, baris);
        booth.rows.push(baris);
      }

      if (!DITERIMA.includes(r.status)) {
        baris.menunggu += i.qtySubmitted;
        continue;
      }
      const kunci = `${r.id}:${i.productId}`;
      const diterimaAwal = i.qtyReceived ?? i.qtySubmitted;
      const diterima = diterimaAwal + (koreksi.get(kunci) ?? 0);
      const selisihTindakLanjut = Math.abs(diterimaAwal - i.qtySubmitted);
      baris.jumlahDokumen += 1;
      dokumenPerBooth.set(r.boothId, (dokumenPerBooth.get(r.boothId) ?? new Set<string>()).add(r.id));
      baris.qtyDiajukan += i.qtySubmitted;
      baris.qtyDiterima += diterima;
      baris.selisih += diterima - i.qtySubmitted;
      if (i.discrepancyReasonCode === 'RUSAK') baris.rusak += selisihTindakLanjut;
      if (i.discrepancyReasonCode === 'LAINNYA') baris.lainnya += selisihTindakLanjut;
      baris.gantiRugi += gantiRugi.get(kunci) ?? 0;
    }

    const booths = [...perBooth.values()].sort((a, b) => urutNama(a.boothName, b.boothName));
    const total = angkaKosong();
    for (const booth of booths) {
      booth.rows.sort((a, b) => urutNama(a.productName, b.productName));
      for (const baris of booth.rows) tambahkan(booth.subtotal, baris);
      booth.subtotal.jumlahDokumen = dokumenPerBooth.get(booth.boothId)?.size ?? 0;
      tambahkan(total, booth.subtotal);
    }
    return { booths, total };
  }

  private async labelPenyaring(filter: FilterRekapPengembalian): Promise<string> {
    const bagian: string[] = [];
    if (filter.dateFrom && filter.dateTo) bagian.push(`Periode ${filter.dateFrom} s/d ${filter.dateTo}`);
    if (filter.boothId) {
      const booth = await this.prisma.booth.findUnique({ where: { id: filter.boothId } });
      bagian.push(`Booth ${booth?.name ?? '-'}`);
    }
    if (filter.productId) {
      const produk = await this.prisma.product.findUnique({ where: { id: filter.productId } });
      bagian.push(`Produk ${produk?.name ?? '-'}`);
    }
    return bagian.length ? bagian.join(' · ') : 'Semua periode, Booth & Produk';
  }

  private stempelJakarta(): string {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(
      new Date(),
    );
  }

  // ─────────────────────────────── EXCEL ───────────────────────────────

  async excel(filter: FilterRekapPengembalian): Promise<Buffer> {
    const { booths, total } = await this.data(filter);
    const penyaring = await this.labelPenyaring(filter);
    const profil = await this.companyProfile.getForPrint();

    const buku = new ExcelJS.Workbook();
    buku.creator = profil.name;
    buku.created = new Date();

    const lembar = buku.addWorksheet('Rekap Pengembalian', {
      views: [{ showGridLines: false }],
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0, footer: 0 },
      },
    });

    lembar.columns = [{ width: 5 }, { width: 24 }, { width: 26 }, ...KOLOM_ANGKA.map(() => ({ width: 11 }))];

    if (profil.logoPath && profil.logoExt) {
      const imageId = buku.addImage({ filename: profil.logoPath, extension: profil.logoExt });
      lembar.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 32, height: 32 } });
      lembar.getRow(1).height = 26;
    }

    lembar.mergeCells('A1:C1');
    lembar.getCell('A1').value = profil.logoPath ? `        ${profil.name}` : profil.name;
    lembar.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF0F172A' } };

    lembar.mergeCells('D1:K1');
    lembar.getCell('D1').value = profil.address ?? '';
    lembar.getCell('D1').font = { size: 9, color: { argb: 'FF64748B' } };
    lembar.getCell('D1').alignment = { horizontal: 'right' };

    lembar.mergeCells('A4:C4');
    lembar.getCell('A4').value = 'Rekap Pengembalian Stok';
    lembar.getCell('A4').font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };

    lembar.mergeCells('A5:F5');
    lembar.getCell('A5').value = 'Stok yang dikembalikan Booth ke Gudang per Booth & Produk (periode = tanggal shift)';
    lembar.getCell('A5').font = { size: 9, italic: true, color: { argb: 'FF64748B' } };

    const meta: [string, string, string, string][] = [
      ['Penyaring', penyaring, 'Dicetak pada', this.stempelJakarta()],
      ['Total diterima', `${total.qtyDiterima} cup`, 'Dicetak oleh', filter.dicetakOleh ?? '-'],
    ];
    meta.forEach(([labelKiri, nilaiKiri, labelKanan, nilaiKanan], i) => {
      const baris = 7 + i;
      lembar.getCell(`A${baris}`).value = labelKiri;
      lembar.getCell(`A${baris}`).font = { bold: true, size: 10 };
      lembar.mergeCells(`B${baris}:C${baris}`);
      lembar.getCell(`B${baris}`).value = nilaiKiri;
      lembar.getCell(`B${baris}`).font = { size: 10 };
      lembar.mergeCells(`D${baris}:E${baris}`);
      lembar.getCell(`D${baris}`).value = labelKanan;
      lembar.getCell(`D${baris}`).font = { bold: true, size: 10 };
      lembar.mergeCells(`F${baris}:H${baris}`);
      lembar.getCell(`F${baris}`).value = nilaiKanan;
      lembar.getCell(`F${baris}`).font = { size: 10 };
    });

    const barisKepala = 10;
    const kepala = lembar.getRow(barisKepala);
    kepala.values = ['No.', 'Booth', 'Produk', ...KOLOM_ANGKA.map((k) => k.label)];
    kepala.eachCell((sel) => {
      sel.fill = ISI_KEPALA;
      sel.font = HURUF_KEPALA;
      sel.alignment = { vertical: 'middle' };
      sel.border = GARIS;
    });
    kepala.height = 20;

    let nomor = barisKepala;
    const tulisBaris = (nilai: (string | number)[], tebal: boolean) => {
      nomor += 1;
      const baris = lembar.getRow(nomor);
      baris.values = nilai;
      for (let kol = 1; kol <= 3 + KOLOM_ANGKA.length; kol += 1) {
        const sel = baris.getCell(kol);
        sel.border = GARIS;
        sel.font = { size: 10, bold: tebal };
        if (tebal) sel.fill = ISI_SUBTOTAL;
      }
    };

    let no = 0;
    for (const booth of booths) {
      for (const r of booth.rows) {
        no += 1;
        tulisBaris([no, booth.boothName, r.productName, ...KOLOM_ANGKA.map((k) => r[k.key])], false);
      }
      tulisBaris(['', `Subtotal ${booth.boothName}`, '', ...KOLOM_ANGKA.map((k) => booth.subtotal[k.key])], true);
    }
    tulisBaris(['', 'GRAND TOTAL', '', ...KOLOM_ANGKA.map((k) => total[k.key])], true);

    return Buffer.from(await buku.xlsx.writeBuffer());
  }

  // ──────────────────────────────── PDF ────────────────────────────────

  async pdf(filter: FilterRekapPengembalian): Promise<Buffer> {
    const { booths, total } = await this.data(filter);
    const penyaring = await this.labelPenyaring(filter);
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
        .text('Rekap Pengembalian Stok', KIRI, 28, { width: KANAN - KIRI, align: 'right' });
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748B')
        .text('Stok yang dikembalikan Booth ke Gudang per Booth & Produk (periode = tanggal shift)', KIRI, 45, {
          width: KANAN - KIRI,
          align: 'right',
        });

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
      tulisMeta('Total diterima', `${total.qtyDiterima} cup`, metaY + 12, 'left');
      tulisMeta('Dicetak oleh', filter.dicetakOleh ?? '-', metaY + 12, 'right');

      const LEBAR_ANGKA = 58;
      const kolomTeks = [
        { label: 'No.', x: KIRI, w: 26 },
        { label: 'Booth', x: KIRI + 26, w: 150 },
        { label: 'Produk', x: KIRI + 176, w: 146 },
      ];
      const xAngka = (i: number) => KIRI + 322 + i * LEBAR_ANGKA;

      const tulisKepala = (y: number) => {
        doc.rect(KIRI, y, KANAN - KIRI, 18).fill(HIJAU_HEX);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFFFFF');
        for (const k of kolomTeks) doc.text(k.label, k.x + 4, y + 5, { width: k.w - 8 });
        KOLOM_ANGKA.forEach((k, i) => doc.text(k.label, xAngka(i) + 4, y + 5, { width: LEBAR_ANGKA - 8, align: 'right' }));
        return y + 18;
      };

      let y = tulisKepala(metaY + 34);
      const tulisBaris = (no: string, booth: string, produk: string, angka: AngkaRekapPengembalian, tebal: boolean) => {
        if (y > 520) {
          doc.addPage();
          y = tulisKepala(40);
        }
        if (tebal) doc.rect(KIRI, y, KANAN - KIRI, 15).fill('#F1F5F9');
        doc.font(tebal ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5).fillColor('#0F172A');
        doc.text(no, kolomTeks[0].x + 4, y + 4, { width: kolomTeks[0].w - 8 });
        doc.text(booth, kolomTeks[1].x + 4, y + 4, { width: kolomTeks[1].w - 8, ellipsis: true });
        doc.text(produk, kolomTeks[2].x + 4, y + 4, { width: kolomTeks[2].w - 8, ellipsis: true });
        KOLOM_ANGKA.forEach((k, i) =>
          doc.text(String(angka[k.key]), xAngka(i) + 4, y + 4, { width: LEBAR_ANGKA - 8, align: 'right' }),
        );
        y += 15;
        doc.moveTo(KIRI, y).lineTo(KANAN, y).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
      };

      let no = 0;
      for (const booth of booths) {
        for (const r of booth.rows) {
          no += 1;
          tulisBaris(String(no), booth.boothName, r.productName, r, false);
        }
        tulisBaris('', `Subtotal ${booth.boothName}`, '', booth.subtotal, true);
      }
      tulisBaris('', 'GRAND TOTAL', '', total, true);

      doc.end();
    });
  }
}
