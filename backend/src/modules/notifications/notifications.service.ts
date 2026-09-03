import { Injectable } from '@nestjs/common';
import { DistributionStatus, ReturnStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_CRITICAL_QTY, DEFAULT_MINIMUM_QTY, resolveStockStatus } from '../../common/stock-status';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  readAt: null;
  createdAt: string;
}

/// Notifikasi diturunkan langsung dari kondisi real-time (stok kritis,
/// antrian pending, reconciliation case terbuka) — bukan log event
/// tersendiri, jadi tidak ada state "read" persisten di server; bell UI
/// menyimpan status dibaca secara lokal di client.
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<NotificationItem[]> {
    const now = new Date().toISOString();
    const items: NotificationItem[] = [];

    const [boothStocks, thresholds, pendingDistributions, pendingRestock, pendingReturns, openCases] =
      await Promise.all([
        this.prisma.boothStock.findMany({ include: { booth: true, product: true } }),
        this.prisma.boothStockThreshold.findMany(),
        this.prisma.stockDistribution.count({ where: { status: DistributionStatus.SENT } }),
        this.prisma.restockRequest.count({ where: { status: 'REQUESTED' } }),
        this.prisma.stockReturn.count({ where: { status: ReturnStatus.SUBMITTED } }),
        this.prisma.reconciliationCase.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'desc' } }),
      ]);

    const thresholdByKey = new Map(thresholds.map((t) => [`${t.boothId}:${t.productId}`, t]));
    for (const s of boothStocks) {
      const th = thresholdByKey.get(`${s.boothId}:${s.productId}`);
      const status = resolveStockStatus(s.qtyOnHand, th?.minimumQty ?? DEFAULT_MINIMUM_QTY, th?.criticalQty ?? DEFAULT_CRITICAL_QTY);
      if (status === 'Kritis' || status === 'Habis') {
        items.push({
          id: `lowstock:${s.boothId}:${s.productId}`,
          title: status === 'Habis' ? 'Stok Habis' : 'Stok Kritis',
          message: `${s.product.name} di ${s.booth.name} tersisa ${s.qtyOnHand}.`,
          type: status === 'Habis' ? 'error' : 'warning',
          readAt: null,
          createdAt: now,
        });
      }
    }

    if (pendingDistributions > 0) {
      items.push({
        id: 'pending:distributions',
        title: 'Distribusi Menunggu Diterima',
        message: `${pendingDistributions} distribusi sedang dalam perjalanan ke Booth.`,
        type: 'info',
        readAt: null,
        createdAt: now,
      });
    }
    if (pendingRestock > 0) {
      items.push({
        id: 'pending:restock',
        title: 'Restock Menunggu Persetujuan',
        message: `${pendingRestock} permintaan restock belum diproses.`,
        type: 'info',
        readAt: null,
        createdAt: now,
      });
    }
    if (pendingReturns > 0) {
      items.push({
        id: 'pending:returns',
        title: 'Return Menunggu Diterima Gudang',
        message: `${pendingReturns} return Booth belum dikonfirmasi Gudang.`,
        type: 'info',
        readAt: null,
        createdAt: now,
      });
    }

    for (const c of openCases) {
      items.push({
        id: `reconciliation:${c.id}`,
        title: 'Perlu Rekonsiliasi',
        message: `Kasus ${c.caseNo} memerlukan tinjauan Admin.`,
        type: 'error',
        readAt: null,
        createdAt: c.createdAt.toISOString(),
      });
    }

    return items;
  }
}
