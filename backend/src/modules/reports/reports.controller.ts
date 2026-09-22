import { Controller, Get, Header, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReportsService } from './reports.service';
import { ProductReportService, type FilterLaporanProduk } from './product-report.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly productReport: ProductReportService,
  ) {}

  /// Nama berkas memuat tanggal Asia/Jakarta supaya unduhan berturut-turut
  /// tidak saling menimpa di folder Downloads.
  private namaBerkas(ext: string): string {
    const jakarta = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return `daftar-produk-${jakarta}.${ext}`;
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
      'Content-Disposition': `attachment; filename="${this.namaBerkas('xlsx')}"`,
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
      'Content-Disposition': `inline; filename="${this.namaBerkas('pdf')}"`,
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
