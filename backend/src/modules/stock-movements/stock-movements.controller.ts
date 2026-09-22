import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StockMovementsService } from './stock-movements.service';
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

  @Get('rekap')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  rekap(
    @Query('bulan') bulan?: string,
    @Query('tahun') tahun?: string,
    @Query('lokasi') lokasi?: string,
  ) {
    return this.service.rekap(this.resolve(bulan, tahun, lokasi));
  }

  @Get('ringkas')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  ringkas(@Query('bulan') bulan?: string, @Query('tahun') tahun?: string) {
    const { lokasi: _abaikan, ...periode } = this.resolve(bulan, tahun);
    return this.service.ringkasPerLokasi(periode);
  }

  @Get('rinci')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  rinci(
    @Query('productId') productId: string,
    @Query('bulan') bulan?: string,
    @Query('tahun') tahun?: string,
    @Query('lokasi') lokasi?: string,
  ) {
    return this.service.rinci({ productId, ...this.resolve(bulan, tahun, lokasi) });
  }
}
