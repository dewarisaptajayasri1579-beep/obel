import { Injectable } from '@nestjs/common';
import { DistributionStatus, RestockRequestStatus, ReturnStatus, SaleStatus, ShiftStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const LOW_STOCK_THRESHOLD = 25;

/// Awal hari ini menurut Asia/Jakarta, dinyatakan sebagai instant UTC —
/// dipakai karena laporan harian dikelompokkan per tanggal lokal
/// (02-system-architecture.md §7), sementara timestamp di DB tetap UTC.
function startOfTodayJakarta(): Date {
  const now = new Date();
  const jakartaNow = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  const startOfDayJakartaAsUtcWallClock = Date.UTC(
    jakartaNow.getUTCFullYear(),
    jakartaNow.getUTCMonth(),
    jakartaNow.getUTCDate(),
  );
  return new Date(startOfDayJakartaAsUtcWallClock - JAKARTA_OFFSET_MS);
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /// Mirrors get_admin_dashboard(period) dari
  /// docs/obbel-coffee-ai-docs/09-api-rpc-contract.md — untuk sekarang
  /// selalu period "hari ini" (Asia/Jakarta).
  async getAdminDashboard() {
    const todayStart = startOfTodayJakarta();

    const [salesToday, activeBoothsCount, lowStockCount, pendingDistributions, pendingRestock, pendingReturns] =
      await Promise.all([
        this.prisma.sale.findMany({
          where: { status: SaleStatus.PAID, paidAt: { gte: todayStart } },
          include: { items: true },
        }),
        this.prisma.shiftSession.count({ where: { status: ShiftStatus.OPEN } }),
        this.prisma.boothStock.count({ where: { qtyOnHand: { lte: LOW_STOCK_THRESHOLD } } }),
        this.prisma.stockDistribution.count({ where: { status: DistributionStatus.SENT } }),
        this.prisma.restockRequest.count({ where: { status: RestockRequestStatus.REQUESTED } }),
        this.prisma.stockReturn.count({ where: { status: ReturnStatus.SUBMITTED } }),
      ]);

    const omzetToday = salesToday.reduce((sum, s) => sum + Number(s.total), 0);
    const cupSoldToday = salesToday.reduce(
      (sum, s) => sum + s.items.reduce((itemSum, i) => itemSum + i.qty, 0),
      0,
    );

    return {
      omzetToday,
      cupSoldToday,
      transactionCountToday: salesToday.length,
      activeBoothsCount,
      lowStockCount,
      pendingDistributions,
      pendingRestock,
      pendingReturns,
    };
  }
}
