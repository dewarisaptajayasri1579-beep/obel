import { Injectable } from '@nestjs/common';
import { SaleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { businessDateKeyJakarta, startOfDayJakarta } from '../../common/jakarta-date';
import { effectiveByGroup } from '../../common/effective-version';

const TREND_DAYS = 7;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /// Mirrors 12-reporting-dashboard.md — sales trend 7 hari, Booth ranking,
  /// dan Product ranking, semua dari sale PAID (BR-020/BR-021: exclude VOIDED).
  async getSummary() {
    const rangeStart = startOfDayJakarta(new Date(Date.now() - (TREND_DAYS - 1) * 24 * 60 * 60 * 1000));

    const salesRaw = await this.prisma.sale.findMany({
      where: { status: SaleStatus.PAID, paidAt: { gte: rangeStart } },
      include: { booth: true, items: { include: { product: true } } },
    });
    // Effective versions only — revisi lama tidak boleh dihitung dua kali
    // (docs/24-data-consistency-correction-reversal.md §14).
    const sales = effectiveByGroup(salesRaw);

    const trendByDate = new Map<string, { omzet: number; cup: number }>();
    for (let i = 0; i < TREND_DAYS; i++) {
      const day = new Date(rangeStart.getTime() + i * 24 * 60 * 60 * 1000);
      trendByDate.set(businessDateKeyJakarta(day), { omzet: 0, cup: 0 });
    }

    const boothTotals = new Map<string, { boothName: string; omzet: number; cup: number }>();
    const productTotals = new Map<string, { productName: string; qty: number }>();

    for (const sale of sales) {
      const cupCount = sale.items.reduce((sum, i) => sum + i.qty, 0);
      const total = Number(sale.total);

      if (sale.paidAt) {
        const key = businessDateKeyJakarta(sale.paidAt);
        const bucket = trendByDate.get(key);
        if (bucket) {
          bucket.omzet += total;
          bucket.cup += cupCount;
        }
      }

      const boothEntry = boothTotals.get(sale.boothId) ?? { boothName: sale.booth.name, omzet: 0, cup: 0 };
      boothEntry.omzet += total;
      boothEntry.cup += cupCount;
      boothTotals.set(sale.boothId, boothEntry);

      for (const item of sale.items) {
        const productEntry = productTotals.get(item.productId) ?? { productName: item.product.name, qty: 0 };
        productEntry.qty += item.qty;
        productTotals.set(item.productId, productEntry);
      }
    }

    return {
      salesTrend: Array.from(trendByDate, ([date, v]) => ({ date, ...v })),
      boothRanking: Array.from(boothTotals.values())
        .sort((a, b) => b.omzet - a.omzet)
        .slice(0, 10),
      productRanking: Array.from(productTotals.values())
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10),
    };
  }

  /// Export CSV untuk tombol "Download/Export Laporan" (Admin Web & Owner
  /// app). Satu file berisi tiga section: tren penjualan, ranking Booth,
  /// ranking produk — sama persis dengan data /reports/summary.
  async exportCsv(): Promise<string> {
    const summary = await this.getSummary();
    const lines: string[] = [];

    lines.push('Tren Penjualan (7 Hari Terakhir)');
    lines.push('Tanggal,Omzet,Cup Terjual');
    for (const row of summary.salesTrend) {
      lines.push(`${row.date},${row.omzet},${row.cup}`);
    }
    lines.push('');

    lines.push('Booth Ranking');
    lines.push('Booth,Omzet,Cup Terjual');
    for (const row of summary.boothRanking) {
      lines.push(`${csvEscape(row.boothName)},${row.omzet},${row.cup}`);
    }
    lines.push('');

    lines.push('Produk Ranking');
    lines.push('Produk,Qty Terjual');
    for (const row of summary.productRanking) {
      lines.push(`${csvEscape(row.productName)},${row.qty}`);
    }

    return lines.join('\n');
  }
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
