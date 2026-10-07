import { Injectable } from '@nestjs/common';
import { CashDepositStatus, DistributionStatus, ReturnStatus, ShiftStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveStockStatus } from '../../common/stock-status';
import { startOfTodayJakarta } from '../../common/jakarta-date';
import { BOOTH_STOCK_TERLIHAT } from '../booth-stock/booth-stock.service';

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

  /// Bel Admin/Owner. Peringatan stok hanya untuk Booth yang shift-nya sedang OPEN (Booth tanpa shift
  /// stoknya memang 0 setelah Check-Out) dan digabung satu item per Booth. Antrian hanya berisi yang
  /// masih perlu ditindak, jadi item hilang sendiri setelah diurus. Tiap item memakai waktu kejadian
  /// aslinya dan daftar diurutkan terbaru di atas.
  async getAll(): Promise<NotificationItem[]> {
    const items: NotificationItem[] = [];

    const [boothStocks, thresholds, pendingDistributions, pendingRestock, openCases, menungguApprove] =
      await Promise.all([
        this.prisma.boothStock.findMany({
          where: { ...BOOTH_STOCK_TERLIHAT, booth: { shiftSessions: { some: { status: ShiftStatus.OPEN } } } },
          include: { booth: true, product: true },
          orderBy: { product: { name: 'asc' } },
        }),
        this.prisma.boothStockThreshold.findMany(),
        this.prisma.stockDistribution.findMany({
          where: { status: DistributionStatus.SENT },
          select: { sentAt: true, createdAt: true },
        }),
        this.prisma.restockRequest.findMany({ where: { status: 'REQUESTED' }, select: { createdAt: true } }),
        this.prisma.reconciliationCase.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'desc' } }),
        // Return Booth hanya lahir dari Check-Out, dan Approve Stok Kembali & Setor Uang baru terbuka
        // setelah Barista absen Kembali: yang bisa ditindak = shift CLOSED, sudah Kembali, dan return-nya
        // masih SUBMITTED atau setorannya masih PENDING.
        this.prisma.shiftSession.findMany({
          where: {
            status: ShiftStatus.CLOSED,
            returnedAt: { not: null },
            OR: [{ stockReturns: { some: { status: ReturnStatus.SUBMITTED } } }, { cashDeposit: { status: CashDepositStatus.PENDING } }],
          },
          include: { booth: true, staff: { select: { fullName: true } } },
          orderBy: { returnedAt: 'desc' },
        }),
      ]);

    type StokBooth = { boothName: string; habis: string[]; kritis: string[]; terakhir: Date };
    const perBooth = new Map<string, StokBooth>();
    const thresholdByKey = new Map(thresholds.map((t) => [`${t.boothId}:${t.productId}`, t]));
    for (const s of boothStocks) {
      const th = thresholdByKey.get(`${s.boothId}:${s.productId}`);
      const status = resolveStockStatus(s.qtyOnHand, th?.minimumQty ?? s.product.minimumQty, th?.criticalQty ?? s.product.criticalQty);
      if (status !== 'Kritis' && status !== 'Habis') continue;
      const booth = perBooth.get(s.boothId) ?? { boothName: s.booth.name, habis: [], kritis: [], terakhir: s.updatedAt };
      (status === 'Habis' ? booth.habis : booth.kritis).push(s.product.name);
      if (s.updatedAt > booth.terakhir) booth.terakhir = s.updatedAt;
      perBooth.set(s.boothId, booth);
    }
    const daftar = (nama: string[]) => (nama.length > 3 ? `${nama.slice(0, 3).join(', ')} +${nama.length - 3} lainnya` : nama.join(', '));
    for (const [boothId, b] of perBooth) {
      const bagian = [
        ...(b.habis.length ? [`${b.habis.length} produk habis (${daftar(b.habis)})`] : []),
        ...(b.kritis.length ? [`${b.kritis.length} produk kritis (${daftar(b.kritis)})`] : []),
      ];
      items.push({
        id: `lowstock:${boothId}`,
        title: b.habis.length ? 'Stok Habis' : 'Stok Kritis',
        message: `${b.boothName}: ${bagian.join(' dan ')}.`,
        type: b.habis.length ? 'error' : 'warning',
        readAt: null,
        createdAt: b.terakhir.toISOString(),
      });
    }

    const terbaru = (waktu: Date[]) => new Date(Math.max(...waktu.map((w) => w.getTime()))).toISOString();
    if (pendingDistributions.length > 0) {
      items.push({
        id: 'pending:distributions',
        title: 'Distribusi Menunggu Diterima',
        message: `${pendingDistributions.length} distribusi sedang dalam perjalanan ke Booth.`,
        type: 'info',
        readAt: null,
        createdAt: terbaru(pendingDistributions.map((d) => d.sentAt ?? d.createdAt)),
      });
    }
    if (pendingRestock.length > 0) {
      items.push({
        id: 'pending:restock',
        title: 'Restock Menunggu Persetujuan',
        message: `${pendingRestock.length} permintaan restock belum diproses.`,
        type: 'info',
        readAt: null,
        createdAt: terbaru(pendingRestock.map((r) => r.createdAt)),
      });
    }
    if (menungguApprove.length > 0) {
      const [baru] = menungguApprove;
      items.push({
        id: 'pending:approve',
        title: 'Menunggu Approve Stok Kembali & Setor Uang',
        message:
          menungguApprove.length === 1
            ? `${baru.staff.fullName} (${baru.booth.name}) sudah Kembali di Gudang.`
            : `${menungguApprove.length} shift sudah Kembali di Gudang, terbaru ${baru.staff.fullName} (${baru.booth.name}).`,
        type: 'warning',
        readAt: null,
        createdAt: baru.returnedAt!.toISOString(),
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

    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /// Notifikasi khusus Petugas Booth — hanya kondisi yang relevan untuk
  /// Booth-nya sendiri (stok kritis di booth-nya, distribusi/restock yang
  /// menunggu tindakan dia), bukan feed lintas Booth milik Admin.
  /// Diurutkan terbaru di atas menurut waktu kejadian aslinya (bukan waktu dibaca):
  /// stok = terakhir stoknya berubah, kiriman = dikirim, restock = disetujui/ditolak.
  async getForBooth(boothId: string): Promise<NotificationItem[]> {
    const items: NotificationItem[] = [];

    const [boothStocks, thresholds, pendingDistributions, myRestockRequests, restockDitolakHariIni] = await Promise.all([
      this.prisma.boothStock.findMany({ where: { boothId, ...BOOTH_STOCK_TERLIHAT }, include: { product: true } }),
      this.prisma.boothStockThreshold.findMany({ where: { boothId } }),
      this.prisma.stockDistribution.findMany({
        where: { boothId, status: DistributionStatus.SENT },
        select: { id: true, distributionNo: true, sentAt: true, createdAt: true },
      }),
      this.prisma.restockRequest.findMany({
        where: { boothId, status: { in: ['APPROVED'] } },
        select: { id: true, requestNo: true, updatedAt: true },
      }),
      // REJECTED itu status terminal — tanpa batas hari ini, notifnya nongol
      // selamanya (feed ini diturunkan dari state, bukan log event).
      this.prisma.restockRequest.findMany({
        where: { boothId, status: 'REJECTED', updatedAt: { gte: startOfTodayJakarta() } },
        select: { id: true, requestNo: true, rejectReason: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const thresholdByProduct = new Map(thresholds.map((t) => [t.productId, t]));
    for (const s of boothStocks) {
      const th = thresholdByProduct.get(s.productId);
      const status = resolveStockStatus(s.qtyOnHand, th?.minimumQty ?? s.product.minimumQty, th?.criticalQty ?? s.product.criticalQty);
      // Menipis IKUT disertakan (dulu cuma Kritis/Habis) — dipakai badge
      // realtime di kartu "Stok" Beranda Petugas (app/petugas/page.tsx),
      // status-nya disisipkan di `id` (`lowstock:<status>:...`) supaya
      // frontend tidak perlu menebak dari teks `title`.
      if (status === 'Menipis' || status === 'Kritis' || status === 'Habis') {
        items.push({
          id: `lowstock:${status}:${boothId}:${s.productId}`,
          title: `Stok ${status}`,
          message:
            status === 'Menipis'
              ? `${s.product.name} tersisa ${s.qtyOnHand}. Perlu dipantau.`
              : `${s.product.name} tersisa ${s.qtyOnHand}. Segera ajukan restock.`,
          type: status === 'Habis' ? 'error' : status === 'Kritis' ? 'warning' : 'info',
          readAt: null,
          createdAt: s.updatedAt.toISOString(),
        });
      }
    }

    for (const d of pendingDistributions) {
      items.push({
        id: `distribution:${d.id}`,
        title: 'Ada Stok Masuk',
        message: `Distribusi ${d.distributionNo} sudah dikirim, silakan diterima.`,
        type: 'info',
        readAt: null,
        createdAt: (d.sentAt ?? d.createdAt).toISOString(),
      });
    }

    for (const r of myRestockRequests) {
      items.push({
        id: `restock:${r.id}`,
        title: 'Restock Disetujui',
        message: `Permintaan restock ${r.requestNo} disetujui dan sedang dikirim.`,
        type: 'success',
        readAt: null,
        createdAt: r.updatedAt.toISOString(),
      });
    }

    for (const r of restockDitolakHariIni) {
      items.push({
        id: `restock-rejected:${r.id}`,
        title: 'Restock Ditolak',
        message: `Permintaan restock ${r.requestNo} ditolak${r.rejectReason ? `: ${r.rejectReason}` : '.'}`,
        type: 'error',
        readAt: null,
        createdAt: r.updatedAt.toISOString(),
      });
    }

    // ISO UTC dengan panjang sama -> urutan string = urutan waktu.
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
