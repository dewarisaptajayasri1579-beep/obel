import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { DomainError } from '../../common/domain-error';
import { StockMovementsService, type JenisMutasi } from './stock-movements.service';
import { WAREHOUSE, type LokasiStok } from './arah.util';

/// Riwayat & rekap mutasi stok. READ-ONLY — tidak ada endpoint yang menulis.
/// Stok hanya berubah lewat domain service transaksinya masing-masing (AGENTS.md).
@Controller('stock-movements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockMovementsController {
  constructor(private readonly service: StockMovementsService) {}

  /// Bulan & tahun default ke periode berjalan menurut Asia/Jakarta, bukan UTC —
  /// kalau memakai UTC, tujuh jam pertama tiap tanggal 1 akan membuka bulan
  /// sebelumnya bagi pengguna di Indonesia.
  private periodeBerjalan() {
    const jakarta = new Date(Date.now() + 7 * 60 * 60 * 1000);
    return { bulan: jakarta.getUTCMonth() + 1, tahun: jakarta.getUTCFullYear() };
  }

  private resolve(bulan?: string, tahun?: string, lokasi?: string) {
    const kini = this.periodeBerjalan();
    return {
      bulan: bulan ? Number(bulan) : kini.bulan,
      tahun: tahun ? Number(tahun) : kini.tahun,
      lokasi: (lokasi ?? WAREHOUSE) as LokasiStok,
    };
  }

  private resolveJenis(jenis?: string): JenisMutasi {
    return jenis === 'PENJUALAN' ? 'PENJUALAN' : 'SEMUA';
  }

  @Get('mine')
  @Roles(UserRole.BOOTH_STAFF)
  mine(@CurrentUser() user: JwtPayload, @Query('from') from?: string, @Query('to') to?: string) {
    if (!user.boothId) {
      throw new DomainError('NOT_CHECKED_IN', 'Anda belum check-in ke Booth manapun.');
    }
    return this.service.mutasiUntukBooth(user.boothId, {
      dari: from ? new Date(from) : undefined,
      sampai: to ? new Date(to) : undefined,
    });
  }

  @Get('rinci-mine')
  @Roles(UserRole.BOOTH_STAFF)
  rinciMine(
    @CurrentUser() user: JwtPayload,
    @Query('productId') productId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!user.boothId) {
      throw new DomainError('NOT_CHECKED_IN', 'Anda belum check-in ke Booth manapun.');
    }
    return this.service.rinciUntukBooth({ boothId: user.boothId, productId, dari: new Date(from), sampai: new Date(to) });
  }

  @Get('rekap')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  rekap(
    @Query('bulan') bulan?: string,
    @Query('tahun') tahun?: string,
    @Query('lokasi') lokasi?: string,
    @Query('jenis') jenis?: string,
  ) {
    return this.service.rekap({ ...this.resolve(bulan, tahun, lokasi), jenis: this.resolveJenis(jenis) });
  }

  @Get('rekap-booth')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  rekapBooth(
    @Query('bulan') bulan?: string,
    @Query('tahun') tahun?: string,
    @Query('jenis') jenis?: string,
  ) {
    const { lokasi: _abaikan, ...periode } = this.resolve(bulan, tahun);
    return this.service.rekapPerBooth({ ...periode, jenis: this.resolveJenis(jenis) });
  }

  @Get('ringkas')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  ringkas(@Query('bulan') bulan?: string, @Query('tahun') tahun?: string) {
    const { lokasi: _abaikan, ...periode } = this.resolve(bulan, tahun);
    return this.service.ringkasPerLokasi(periode);
  }

  @Get('sebaran')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  sebaran(@Query('tanggal') tanggal?: string) {
    const jakarta = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const hariIni = jakarta.toISOString().slice(0, 10);
    return this.service.sebaranHarian(tanggal || hariIni);
  }

  @Get('rinci')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  rinci(
    @Query('productId') productId: string,
    @Query('bulan') bulan?: string,
    @Query('tahun') tahun?: string,
    @Query('lokasi') lokasi?: string,
    @Query('jenis') jenis?: string,
  ) {
    return this.service.rinci({ productId, ...this.resolve(bulan, tahun, lokasi), jenis: this.resolveJenis(jenis) });
  }
}
