import { Controller, Get, Header, Param, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { SaleStatus, StockReceiptStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReportsService } from './reports.service';
import { ProductReportService, type FilterLaporanProduk } from './product-report.service';
import { StockReceiptReportService, type FilterLaporanPenerimaan } from './stock-receipt-report.service';
import { StockHandoverReportService, type FilterLaporanSerahTerima, type StockHandoverStatus } from './stock-handover-report.service';
import { StockDiscrepancyReportService, type FilterLaporanStokSelisih } from './stock-discrepancy-report.service';
import { SalesReportService, type FilterLaporanKasir } from './sales-report.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly productReport: ProductReportService,
    private readonly stockReceiptReport: StockReceiptReportService,
    private readonly stockHandoverReport: StockHandoverReportService,
    private readonly stockDiscrepancyReport: StockDiscrepancyReportService,
    private readonly salesReport: SalesReportService,
  ) {}

  /// Nama berkas memuat tanggal Asia/Jakarta supaya unduhan berturut-turut
  /// tidak saling menimpa di folder Downloads.
  private namaBerkas(dasar: string, ext: string): string {
    const jakarta = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return `${dasar}-${jakarta}.${ext}`;
  }

  private filterDari(q?: string, kategoriId?: string, status?: string, dicetakOleh?: string): FilterLaporanProduk {
    return {
      q: q || undefined,
      kategoriId: kategoriId || undefined,
      status: status === 'active' || status === 'inactive' ? status : undefined,
      dicetakOleh,
    };
  }

  @Get('products/excel')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async produkExcel(
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: JwtPayload,
    @Query('q') q?: string,
    @Query('kategoriId') kategoriId?: string,
    @Query('status') status?: string,
  ) {
    const buffer = await this.productReport.excel(this.filterDari(q, kategoriId, status, user.username));
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${this.namaBerkas('daftar-produk', 'xlsx')}"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('products/pdf')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async produkPdf(
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: JwtPayload,
    @Query('q') q?: string,
    @Query('kategoriId') kategoriId?: string,
    @Query('status') status?: string,
  ) {
    const buffer = await this.productReport.pdf(this.filterDari(q, kategoriId, status, user.username));
    res.set({
      'Content-Type': 'application/pdf',
      // inline, bukan attachment — berkasnya dipratinjau dulu di modal sebelum
      // dicetak, sama seperti alur PDF di jsBerkah.
      'Content-Disposition': `inline; filename="${this.namaBerkas('daftar-produk', 'pdf')}"`,
    });
    return new StreamableFile(buffer);
  }

  private filterPenerimaanDari(q?: string, status?: string, dicetakOleh?: string): FilterLaporanPenerimaan {
    return {
      q: q || undefined,
      status: status === 'DRAFT' || status === 'POSTED' || status === 'REVISED' ? (status as StockReceiptStatus) : undefined,
      dicetakOleh,
    };
  }

  @Get('stock-receipts/excel')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async penerimaanExcel(
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: JwtPayload,
    @Query('q') q?: string,
    @Query('status') status?: string,
  ) {
    const buffer = await this.stockReceiptReport.excel(this.filterPenerimaanDari(q, status, user.username));
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${this.namaBerkas('terima-stok-gudang', 'xlsx')}"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('stock-receipts/pdf')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async penerimaanPdf(
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: JwtPayload,
    @Query('q') q?: string,
    @Query('status') status?: string,
  ) {
    const buffer = await this.stockReceiptReport.pdf(this.filterPenerimaanDari(q, status, user.username));
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${this.namaBerkas('terima-stok-gudang', 'pdf')}"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('stock-receipts/:id/pdf')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async penerimaanNotaPdf(@Res({ passthrough: true }) res: Response, @Param('id') id: string) {
    const buffer = await this.stockReceiptReport.nota(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${this.namaBerkas('nota-terima-stok', 'pdf')}"`,
    });
    return new StreamableFile(buffer);
  }

  private filterSerahTerimaDari(q?: string, status?: string, dicetakOleh?: string): FilterLaporanSerahTerima {
    const validStatus: StockHandoverStatus[] = ['DIAJUKAN', 'DIPROSES', 'DITERIMA', 'DITOLAK', 'DIBATALKAN'];
    return {
      q: q || undefined,
      status: validStatus.includes(status as StockHandoverStatus) ? (status as StockHandoverStatus) : undefined,
      dicetakOleh,
    };
  }

  @Get('stock-handovers/excel')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async serahTerimaExcel(
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: JwtPayload,
    @Query('q') q?: string,
    @Query('status') status?: string,
  ) {
    const buffer = await this.stockHandoverReport.excel(this.filterSerahTerimaDari(q, status, user.username));
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${this.namaBerkas('serah-terima-stok', 'xlsx')}"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('stock-handovers/pdf')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async serahTerimaPdf(
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: JwtPayload,
    @Query('q') q?: string,
    @Query('status') status?: string,
  ) {
    const buffer = await this.stockHandoverReport.pdf(this.filterSerahTerimaDari(q, status, user.username));
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${this.namaBerkas('serah-terima-stok', 'pdf')}"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('stock-handovers/:id/pdf')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async serahTerimaNotaPdf(@Res({ passthrough: true }) res: Response, @Param('id') id: string) {
    const buffer = await this.stockHandoverReport.nota(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${this.namaBerkas('nota-serah-terima', 'pdf')}"`,
    });
    return new StreamableFile(buffer);
  }

  private filterStokSelisihDari(
    dateFrom?: string,
    dateTo?: string,
    boothId?: string,
    jenis?: string,
    dicetakOleh?: string,
  ): FilterLaporanStokSelisih {
    return {
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      boothId: boothId || undefined,
      jenis: jenis === 'KIRIM_STOK' || jenis === 'PENGEMBALIAN_STOK' ? jenis : undefined,
      dicetakOleh,
    };
  }

  @Get('stock-discrepancy')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async stokSelisihData(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('boothId') boothId?: string,
    @Query('jenis') jenis?: string,
  ) {
    return this.stockDiscrepancyReport.data(this.filterStokSelisihDari(dateFrom, dateTo, boothId, jenis));
  }

  @Get('stock-discrepancy/excel')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async stokSelisihExcel(
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: JwtPayload,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('boothId') boothId?: string,
    @Query('jenis') jenis?: string,
  ) {
    const buffer = await this.stockDiscrepancyReport.excel(
      this.filterStokSelisihDari(dateFrom, dateTo, boothId, jenis, user.username),
    );
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${this.namaBerkas('stok-selisih', 'xlsx')}"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('stock-discrepancy/pdf')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async stokSelisihPdf(
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: JwtPayload,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('boothId') boothId?: string,
    @Query('jenis') jenis?: string,
  ) {
    const buffer = await this.stockDiscrepancyReport.pdf(
      this.filterStokSelisihDari(dateFrom, dateTo, boothId, jenis, user.username),
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${this.namaBerkas('stok-selisih', 'pdf')}"`,
    });
    return new StreamableFile(buffer);
  }

  private filterKasirDari(
    q?: string,
    status?: string,
    boothName?: string,
    staffName?: string,
    periodeAwal?: string,
    dicetakOleh?: string,
  ): FilterLaporanKasir {
    const validStatus: SaleStatus[] = ['PENDING', 'PAID', 'VOIDED'];
    return {
      q: q || undefined,
      status: validStatus.includes(status as SaleStatus) ? (status as SaleStatus) : undefined,
      boothName: boothName || undefined,
      staffName: staffName || undefined,
      periodeAwal: periodeAwal || undefined,
      dicetakOleh,
    };
  }

  @Get('sales/excel')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async kasirExcel(
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: JwtPayload,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('boothName') boothName?: string,
    @Query('staffName') staffName?: string,
    @Query('periodeAwal') periodeAwal?: string,
  ) {
    const buffer = await this.salesReport.excel(this.filterKasirDari(q, status, boothName, staffName, periodeAwal, user.username));
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${this.namaBerkas('transaksi-kasir', 'xlsx')}"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('sales/pdf')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async kasirPdf(
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: JwtPayload,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('boothName') boothName?: string,
    @Query('staffName') staffName?: string,
    @Query('periodeAwal') periodeAwal?: string,
  ) {
    const buffer = await this.salesReport.pdf(this.filterKasirDari(q, status, boothName, staffName, periodeAwal, user.username));
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${this.namaBerkas('transaksi-kasir', 'pdf')}"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  getSummary() {
    return this.reportsService.getSummary();
  }

  @Get('export')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="laporan-obbel.csv"')
  exportCsv() {
    return this.reportsService.exportCsv();
  }
}
