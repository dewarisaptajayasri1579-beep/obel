import { Injectable } from '@nestjs/common';
import { DistributionStatus, RestockRequestStatus, ReturnStatus, SaleStatus, ShiftStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfTodayJakarta } from '../../common/jakarta-date';
import { DEFAULT_CRITICAL_QTY, DEFAULT_MINIMUM_QTY, resolveStockStatus } from '../../common/stock-status';
import { effectiveByGroup } from '../../common/effective-version';
import { ReconciliationCasesService } from '../reconciliation-cases/reconciliation-cases.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliationCases: ReconciliationCasesService,
  ) {}

  /// Mirrors get_admin_dashboard(period) dari
  /// docs/obbel-coffee-ai-docs/09-api-rpc-contract.md — untuk sekarang
  /// selalu period "hari ini" (Asia/Jakarta).
  async getAdminDashboard() {
    const todayStart = startOfTodayJakarta();

    const [
      salesTodayRaw,
      activeBoothsCount,
      boothStocks,
      thresholds,
      pendingDistributions,
      pendingRestock,
      pendingReturns,
      reconciliationCasesOpen,
    ] = await Promise.all([
      this.prisma.sale.findMany({
        where: { status: SaleStatus.PAID, paidAt: { gte: todayStart } },
        include: { items: true },
      }),
      this.prisma.shiftSession.count({ where: { status: ShiftStatus.OPEN } }),
      this.prisma.boothStock.findMany(),
      this.prisma.boothStockThreshold.findMany(),
      this.prisma.stockDistribution.count({ where: { status: DistributionStatus.SENT } }),
      this.prisma.restockRequest.count({ where: { status: RestockRequestStatus.REQUESTED } }),
      this.prisma.stockReturn.count({ where: { status: ReturnStatus.SUBMITTED } }),
      this.reconciliationCases.countOpen(),
    ]);

    // Hanya versi efektif (terbaru) per transaction_group_id yang dihitung —
    // versi lama yang sudah direvisi tidak boleh ikut menyumbang omzet/cup
    // (docs/24-data-consistency-correction-reversal.md §14).
    const salesToday = effectiveByGroup(salesTodayRaw);

    const thresholdByKey = new Map(thresholds.map((t) => [`${t.boothId}:${t.productId}`, t]));
    const lowStockCount = boothStocks.filter((s) => {
      const threshold = thresholdByKey.get(`${s.boothId}:${s.productId}`);
      const minimumQty = threshold?.minimumQty ?? DEFAULT_MINIMUM_QTY;
      const criticalQty = threshold?.criticalQty ?? DEFAULT_CRITICAL_QTY;
      return resolveStockStatus(s.qtyOnHand, minimumQty, criticalQty) !== 'Aman';
    }).length;

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
      reconciliationCasesOpen,
    };
  }
}
