import { Injectable } from '@nestjs/common';
import {
  BoothStatus,
  DistributionStatus,
  ReturnStatus,
  SaleStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfDayJakarta, startOfTodayJakarta } from '../../common/jakarta-date';
import { DEFAULT_CRITICAL_QTY, DEFAULT_MINIMUM_QTY, resolveStockStatus } from '../../common/stock-status';
import { effectiveByGroup } from '../../common/effective-version';
import { ReconciliationCasesService } from '../reconciliation-cases/reconciliation-cases.service';

function rangeStartFor(period: 'today' | '7d' | 'month'): Date {
  const now = new Date();
  if (period === 'today') return startOfTodayJakarta();
  if (period === '7d') return startOfDayJakarta(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
  return startOfDayJakarta(new Date(now.getFullYear(), now.getMonth(), 1));
}

/// Read-only aggregation untuk Flutter Owner app (05-feature-specification.md
/// §C). Owner tidak boleh melakukan koreksi (24-...md §4) — modul ini
/// hanya query, tidak ada mutation.
@Injectable()
export class OwnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliationCases: ReconciliationCasesService,
  ) {}

  /// C2 — Executive Home.
  async getExecutiveHome() {
    const todayStart = startOfTodayJakarta();
    const yesterdayStart = startOfDayJakarta(new Date(todayStart.getTime() - 24 * 60 * 60 * 1000));

    const [salesTodayRaw, salesYesterdayRaw, activeBoothsCount, boothStocks, thresholds, pendingDistributions, pendingRestock, pendingReturns, reconciliationCasesOpen] =
      await Promise.all([
        this.prisma.sale.findMany({ where: { status: SaleStatus.PAID, paidAt: { gte: todayStart } }, include: { items: true, booth: true } }),
        this.prisma.sale.findMany({ where: { status: SaleStatus.PAID, paidAt: { gte: yesterdayStart, lt: todayStart } }, include: { items: true } }),
        this.prisma.booth.count({ where: { status: BoothStatus.ACTIVE } }),
        this.prisma.boothStock.findMany(),
        this.prisma.boothStockThreshold.findMany(),
        this.prisma.stockDistribution.count({ where: { status: DistributionStatus.SENT } }),
        this.prisma.restockRequest.count({ where: { status: 'REQUESTED' } }),
        this.prisma.stockReturn.count({ where: { status: ReturnStatus.SUBMITTED } }),
        this.reconciliationCases.countOpen(),
      ]);

    const salesToday = effectiveByGroup(salesTodayRaw);
    const salesYesterday = effectiveByGroup(salesYesterdayRaw);

    const omzetToday = salesToday.reduce((sum, s) => sum + Number(s.total), 0);
    const omzetYesterday = salesYesterday.reduce((sum, s) => sum + Number(s.total), 0);
    const cupSoldToday = salesToday.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.qty, 0), 0);

    const thresholdByKey = new Map(thresholds.map((t) => [`${t.boothId}:${t.productId}`, t]));
    const lowStockCount = boothStocks.filter((s) => {
      const th = thresholdByKey.get(`${s.boothId}:${s.productId}`);
      return resolveStockStatus(s.qtyOnHand, th?.minimumQty ?? DEFAULT_MINIMUM_QTY, th?.criticalQty ?? DEFAULT_CRITICAL_QTY) !== 'Aman';
    }).length;

    const boothTotals = new Map<string, { boothName: string; omzet: number }>();
    for (const sale of salesToday) {
      const entry = boothTotals.get(sale.boothId) ?? { boothName: sale.booth.name, omzet: 0 };
      entry.omzet += Number(sale.total);
      boothTotals.set(sale.boothId, entry);
    }
    const bestBooth = [...boothTotals.values()].sort((a, b) => b.omzet - a.omzet)[0] ?? null;

    return {
      omzetToday,
      omzetDeltaPct: omzetYesterday > 0 ? Math.round(((omzetToday - omzetYesterday) / omzetYesterday) * 100) : null,
      cupSoldToday,
      activeBoothsCount,
      attentionCount: lowStockCount + pendingDistributions + pendingRestock + pendingReturns + reconciliationCasesOpen,
      lowStockCount,
      pendingDistributions,
      pendingRestock,
      pendingReturns,
      reconciliationCasesOpen,
      bestBooth,
    };
  }

  /// C3 — Booth Ranking.
  async getBoothRanking(period: 'today' | '7d' | 'month') {
    const rangeStart = rangeStartFor(period);
    const salesRaw = await this.prisma.sale.findMany({
      where: { status: SaleStatus.PAID, paidAt: { gte: rangeStart } },
      include: { booth: true, items: true },
    });
    const sales = effectiveByGroup(salesRaw);

    const totals = new Map<string, { boothId: string; boothName: string; omzet: number; cup: number }>();
    for (const sale of sales) {
      const entry = totals.get(sale.boothId) ?? { boothId: sale.boothId, boothName: sale.booth.name, omzet: 0, cup: 0 };
      entry.omzet += Number(sale.total);
      entry.cup += sale.items.reduce((sum, i) => sum + i.qty, 0);
      totals.set(sale.boothId, entry);
    }

    return [...totals.values()].sort((a, b) => b.omzet - a.omzet);
  }

  /// C4 — Booth Detail.
  async getBoothDetail(boothId: string) {
    const todayStart = startOfTodayJakarta();
    const [booth, salesTodayRaw, boothStocks, recentShifts] = await Promise.all([
      this.prisma.booth.findUnique({ where: { id: boothId } }),
      this.prisma.sale.findMany({
        where: { boothId, status: SaleStatus.PAID, paidAt: { gte: todayStart } },
        include: { items: { include: { product: true } } },
      }),
      this.prisma.boothStock.findMany({ where: { boothId }, include: { product: true } }),
      this.prisma.shiftSession.findMany({
        where: { boothId },
        include: { shiftTemplate: true, staff: true },
        orderBy: { scheduledStartAt: 'desc' },
        take: 5,
      }),
    ]);

    const salesToday = effectiveByGroup(salesTodayRaw);
    const omzetToday = salesToday.reduce((sum, s) => sum + Number(s.total), 0);
    const cupSoldToday = salesToday.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.qty, 0), 0);

    const productTotals = new Map<string, { productName: string; qty: number }>();
    for (const sale of salesToday) {
      for (const item of sale.items) {
        const entry = productTotals.get(item.productId) ?? { productName: item.product.name, qty: 0 };
        entry.qty += item.qty;
        productTotals.set(item.productId, entry);
      }
    }

    return {
      booth,
      omzetToday,
      cupSoldToday,
      transactionCountToday: salesToday.length,
      stockRemaining: boothStocks.map((s) => ({ productId: s.productId, productName: s.product.name, qtyOnHand: s.qtyOnHand })),
      topProducts: [...productTotals.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
      recentShifts: recentShifts.map((s) => ({
        id: s.id,
        shiftName: s.shiftTemplate.name,
        staffName: s.staff.fullName,
        status: s.status,
        scheduledStartAt: s.scheduledStartAt,
        scheduledEndAt: s.scheduledEndAt,
      })),
    };
  }

  /// C6 — Stock Condition.
  async getStockCondition() {
    const [boothStocks, thresholds] = await Promise.all([
      this.prisma.boothStock.findMany({ include: { booth: true, product: true } }),
      this.prisma.boothStockThreshold.findMany(),
    ]);
    const thresholdByKey = new Map(thresholds.map((t) => [`${t.boothId}:${t.productId}`, t]));

    const rows = boothStocks.map((s) => {
      const th = thresholdByKey.get(`${s.boothId}:${s.productId}`);
      const status = resolveStockStatus(s.qtyOnHand, th?.minimumQty ?? DEFAULT_MINIMUM_QTY, th?.criticalQty ?? DEFAULT_CRITICAL_QTY);
      return { boothName: s.booth.name, productName: s.product.name, qtyOnHand: s.qtyOnHand, status };
    });

    const safeCount = rows.filter((r) => r.status === 'Aman').length;
    const lowCount = rows.filter((r) => r.status === 'Menipis' || r.status === 'Kritis').length;
    const outCount = rows.filter((r) => r.status === 'Habis').length;

    return {
      totalCount: rows.length,
      safeCount,
      safePct: rows.length > 0 ? Math.round((safeCount / rows.length) * 100) : 100,
      lowCount,
      outCount,
      problemItems: rows.filter((r) => r.status !== 'Aman').sort((a, b) => (a.status === 'Habis' ? -1 : 1)),
    };
  }

  /// C7 — Discrepancy.
  async getDiscrepancy() {
    const [distributions, returns] = await Promise.all([
      this.prisma.stockDistribution.findMany({
        where: { status: DistributionStatus.DISCREPANCY },
        include: { booth: true, items: { include: { product: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      this.prisma.stockReturn.findMany({
        where: { status: ReturnStatus.DISCREPANCY },
        include: { booth: true, items: { include: { product: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
    ]);

    const rows: { boothName: string; source: string; productName: string; qtyDiscrepancy: number; estimatedValue: number }[] = [];
    for (const d of distributions) {
      for (const item of d.items) {
        const diff = (item.qtyReceived ?? item.qtySent) - item.qtySent;
        if (diff !== 0) {
          rows.push({
            boothName: d.booth.name,
            source: 'Distribusi',
            productName: item.product.name,
            qtyDiscrepancy: diff,
            estimatedValue: Math.abs(diff) * Number(item.product.sellPrice),
          });
        }
      }
    }
    for (const r of returns) {
      for (const item of r.items) {
        const diff = (item.qtyReceived ?? item.qtySubmitted) - item.qtySubmitted;
        if (diff !== 0) {
          rows.push({
            boothName: r.booth.name,
            source: 'Return',
            productName: item.product.name,
            qtyDiscrepancy: diff,
            estimatedValue: Math.abs(diff) * Number(item.product.sellPrice),
          });
        }
      }
    }

    return rows.sort((a, b) => b.estimatedValue - a.estimatedValue);
  }
}
