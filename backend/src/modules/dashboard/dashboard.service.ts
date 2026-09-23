import { Injectable } from '@nestjs/common';
import { DistributionStatus, RestockRequestStatus, ReturnStatus, SaleStatus, ShiftStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfDayJakarta, startOfTodayJakarta } from '../../common/jakarta-date';
import { resolveStockStatus, StockStatus } from '../../common/stock-status';
import { effectiveByGroup } from '../../common/effective-version';
import { ReconciliationCasesService } from '../reconciliation-cases/reconciliation-cases.service';

const TOP_STOCK_PRODUCTS_LIMIT = 5;

const STOCK_STATUS_SEVERITY: Record<StockStatus, number> = {
  Aman: 0,
  Menipis: 1,
  Kritis: 2,
  Habis: 3,
};

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
        include: { items: true, refunds: true },
      }),
      this.prisma.shiftSession.count({ where: { status: ShiftStatus.OPEN } }),
      this.prisma.boothStock.findMany({ include: { product: true } }),
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
      const minimumQty = threshold?.minimumQty ?? s.product.minimumQty;
      const criticalQty = threshold?.criticalQty ?? s.product.criticalQty;
      return resolveStockStatus(s.qtyOnHand, minimumQty, criticalQty) !== 'Aman';
    }).length;

    // TX-14: refund menurunkan net omzet meski sale asli tetap PAID — cup
    // sold TIDAK ikut dikurangi (minuman tetap dibuat/dikonsumsi).
    const omzetToday = salesToday.reduce(
      (sum, s) => sum + Number(s.total) - s.refunds.reduce((r, ref) => r + Number(ref.amount), 0),
      0,
    );
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

  /// Kartu "Booth Aktif" — satu kartu per Booth master ACTIVE, dengan status
  /// shift, petugas, penjualan hari ini, dan status stok saat ini. Definisi
  /// "aktif" mengikuti 12-reporting-dashboard.md: shift session OPEN/CLOSING
  /// pada saat ini (bukan hanya OPEN seperti activeBoothsCount di atas).
  async getBoothAktif() {
    const todayStart = startOfTodayJakarta();
    const yesterdayStart = startOfDayJakarta(new Date(todayStart.getTime() - 1));

    const [booths, openShifts, salesTodayRaw, salesYesterdayRaw, boothStocks, thresholds] = await Promise.all([
      this.prisma.booth.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.shiftSession.findMany({
        where: { status: { in: [ShiftStatus.OPEN, ShiftStatus.CLOSING] } },
        include: { staff: true, shiftTemplate: true },
      }),
      this.prisma.sale.findMany({
        where: { status: SaleStatus.PAID, paidAt: { gte: todayStart } },
        include: { items: true, refunds: true },
      }),
      // Cuma buat trend "cup terjual vs kemarin" di kartu detail — tidak perlu
      // dedup refund (omzet kemarin tidak dipakai), tapi tetap dedup versi
      // efektif supaya sale yang sudah direvisi tidak dihitung dobel (DC-003).
      this.prisma.sale.findMany({
        where: { status: SaleStatus.PAID, paidAt: { gte: yesterdayStart, lt: todayStart } },
        include: { items: true },
      }),
      this.prisma.boothStock.findMany({ include: { product: true }, orderBy: { qtyOnHand: 'desc' } }),
      this.prisma.boothStockThreshold.findMany(),
    ]);

    const shiftByBoothId = new Map(openShifts.map((s) => [s.boothId, s]));
    const thresholdByKey = new Map(thresholds.map((t) => [`${t.boothId}:${t.productId}`, t]));

    // TX-14 & DC-003: hanya versi efektif per transaction_group_id yang
    // dihitung, refund menurunkan net omzet tapi bukan cup terjual.
    const salesToday = effectiveByGroup(salesTodayRaw);
    const salesByBoothId = new Map<string, typeof salesToday>();
    for (const sale of salesToday) {
      const bucket = salesByBoothId.get(sale.boothId);
      if (bucket) bucket.push(sale);
      else salesByBoothId.set(sale.boothId, [sale]);
    }

    const salesYesterday = effectiveByGroup(salesYesterdayRaw);
    const cupYesterdayByBoothId = new Map<string, number>();
    for (const sale of salesYesterday) {
      const cup = sale.items.reduce((sum, i) => sum + i.qty, 0);
      cupYesterdayByBoothId.set(sale.boothId, (cupYesterdayByBoothId.get(sale.boothId) ?? 0) + cup);
    }

    // Sudah diurutkan qtyOnHand desc dari query — tiap grup per booth otomatis
    // siap dipotong TOP_STOCK_PRODUCTS_LIMIT tanpa sort ulang di sini.
    const stocksByBoothId = new Map<string, typeof boothStocks>();
    for (const stock of boothStocks) {
      const bucket = stocksByBoothId.get(stock.boothId);
      if (bucket) bucket.push(stock);
      else stocksByBoothId.set(stock.boothId, [stock]);
    }

    return booths.map((booth) => {
      const shift = shiftByBoothId.get(booth.id) ?? null;
      const boothSales = salesByBoothId.get(booth.id) ?? [];
      const omzetToday = boothSales.reduce(
        (sum, s) => sum + Number(s.total) - s.refunds.reduce((r, ref) => r + Number(ref.amount), 0),
        0,
      );
      const cupSoldToday = boothSales.reduce(
        (sum, s) => sum + s.items.reduce((itemSum, i) => itemSum + i.qty, 0),
        0,
      );

      const boothStockRows = stocksByBoothId.get(booth.id) ?? [];
      const stockQty = boothStockRows.reduce((sum, s) => sum + s.qtyOnHand, 0);
      const stockStatus = boothStockRows.reduce<StockStatus>((worst, s) => {
        const threshold = thresholdByKey.get(`${booth.id}:${s.productId}`);
        const minimumQty = threshold?.minimumQty ?? s.product.minimumQty;
        const criticalQty = threshold?.criticalQty ?? s.product.criticalQty;
        const status = resolveStockStatus(s.qtyOnHand, minimumQty, criticalQty);
        return STOCK_STATUS_SEVERITY[status] > STOCK_STATUS_SEVERITY[worst] ? status : worst;
      }, 'Aman');

      return {
        boothId: booth.id,
        boothCode: booth.code,
        boothName: booth.name,
        locationName: booth.locationName,
        latitude: booth.latitude === null ? null : Number(booth.latitude),
        longitude: booth.longitude === null ? null : Number(booth.longitude),
        isActive: shift !== null,
        staffName: shift?.staff.fullName ?? null,
        shiftLabel: shift?.shiftTemplate.name ?? null,
        shiftStartAt: shift?.openedAt ?? null,
        cupSoldToday,
        cupSoldYesterday: cupYesterdayByBoothId.get(booth.id) ?? 0,
        omzetToday,
        stockQty,
        stockStatus,
        topStock: boothStockRows.slice(0, TOP_STOCK_PRODUCTS_LIMIT).map((s) => ({
          productName: s.product.name,
          qty: s.qtyOnHand,
        })),
      };
    });
  }
}
