import { Injectable } from '@nestjs/common';
import { DistributionStatus, RestockRequestStatus, ReturnStatus, SaleStatus, ShiftStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { businessDateKeyJakarta, rangeJakarta, startOfDayJakarta, startOfTodayJakarta } from '../../common/jakarta-date';
import { resolveStockStatus, StockStatus } from '../../common/stock-status';
import { effectiveByGroup } from '../../common/effective-version';
import { dampakMutasi } from '../stock-movements/arah.util';
import { ReconciliationCasesService } from '../reconciliation-cases/reconciliation-cases.service';

/// Parameter "Petugas Diam" (getStockNeglectReport) — belum ada aturan resmi
/// di 08-business-rules.md, jadi dua angka ini SENGAJA didokumentasikan di
/// sini sebagai satu-satunya sumber kebenarannya, gampang ditemukan &
/// disesuaikan kalau Admin minta angka lain:
/// - Insiden Menipis/Kritis/Habis baru dianggap "signifikan" (bukan blip
///   sesaat yang otomatis pulih) kalau bertahan >= angka ini.
const NEGLECT_MIN_DURATION_HOURS = 4;
/// - Request dianggap "respons" terhadap satu insiden kalau diajukan kapan
///   saja SELAMA insiden berlangsung, ATAU sampai angka ini SEBELUM insiden
///   mulai (Petugas yang sudah minta duluan sebelum benar-benar menipis
///   tidak boleh ikut ditandai "diam").
const NEGLECT_LOOKBACK_HOURS = 12;

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

    const [booths, openShifts, salesTodayRaw, salesYesterdayRaw, boothStocks, thresholds, pendingDistributions, pendingReturns] = await Promise.all([
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
      // Serah Terima Stok yang sudah dikirim tapi belum dikonfirmasi diterima
      // Booth (status SENT) — dipakai kartu "Kirim Stok (masih proses)" di
      // Booth Aktif, supaya Admin tidak kirim dobel ke Booth yang sama.
      this.prisma.stockDistribution.findMany({
        where: { status: DistributionStatus.SENT },
        select: { boothId: true, distributionNo: true, sentAt: true },
        orderBy: { sentAt: 'asc' },
      }),
      // Sisa Stok Fisik yang otomatis diajukan sebagai Return ke Gudang saat
      // Check-Out, tapi belum di-approve Admin (status SUBMITTED) — dipakai
      // kartu "Proses Kembali" di Booth Aktif, supaya stok 0 pasca Check-Out
      // tidak salah dibaca sebagai "Habis" biasa.
      this.prisma.stockReturn.findMany({
        where: { status: ReturnStatus.SUBMITTED },
        select: { boothId: true, returnNo: true, submittedAt: true, items: { select: { qtySubmitted: true } } },
        orderBy: { submittedAt: 'asc' },
      }),
    ]);

    const shiftByBoothId = new Map(openShifts.map((s) => [s.boothId, s]));
    const thresholdByKey = new Map(thresholds.map((t) => [`${t.boothId}:${t.productId}`, t]));

    const pendingDistributionByBoothId = new Map<string, { distributionNo: string; sentAt: Date | null; count: number }>();
    for (const d of pendingDistributions) {
      const existing = pendingDistributionByBoothId.get(d.boothId);
      if (existing) existing.count += 1;
      else pendingDistributionByBoothId.set(d.boothId, { distributionNo: d.distributionNo, sentAt: d.sentAt, count: 1 });
    }

    const pendingReturnByBoothId = new Map<string, { returnNo: string; submittedAt: Date; count: number; qty: number }>();
    for (const r of pendingReturns) {
      const qty = r.items.reduce((sum, i) => sum + i.qtySubmitted, 0);
      const existing = pendingReturnByBoothId.get(r.boothId);
      if (existing) {
        existing.count += 1;
        existing.qty += qty;
      } else {
        pendingReturnByBoothId.set(r.boothId, { returnNo: r.returnNo, submittedAt: r.submittedAt, count: 1, qty });
      }
    }

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

      const pendingDistribution = pendingDistributionByBoothId.get(booth.id) ?? null;
      const pendingReturn = pendingReturnByBoothId.get(booth.id) ?? null;

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
        pendingDistribution: pendingDistribution
          ? {
              distributionNo: pendingDistribution.distributionNo,
              sentAt: pendingDistribution.sentAt,
              count: pendingDistribution.count,
            }
          : null,
        pendingReturn: pendingReturn
          ? {
              returnNo: pendingReturn.returnNo,
              submittedAt: pendingReturn.submittedAt,
              count: pendingReturn.count,
              qty: pendingReturn.qty,
            }
          : null,
        topStock: boothStockRows.slice(0, TOP_STOCK_PRODUCTS_LIMIT).map((s) => ({
          productName: s.product.name,
          qty: s.qtyOnHand,
        })),
      };
    });
  }

  /// Panel filter periode (Hari Ini/Minggu Ini/Bulan Ini/Custom) di Dashboard
  /// — 3 tabel: penjualan per Booth, produk terlaris, dan penjualan per
  /// Petugas (per shift). `start`/`end` "YYYY-MM-DD" Asia/Jakarta, inklusif.
  async getSalesReport(start: string, end: string) {
    const { awal, akhir } = rangeJakarta(start, end);

    const salesRaw = await this.prisma.sale.findMany({
      where: { status: SaleStatus.PAID, paidAt: { gte: awal, lt: akhir } },
      include: {
        items: true,
        refunds: true,
        booth: true,
        staff: true,
        shiftSession: { include: { shiftTemplate: true } },
      },
    });

    // TX-14 & DC-003: hanya versi efektif yang dihitung, refund menurunkan
    // net omzet tapi tidak menurunkan cup terjual (sama seperti
    // getAdminDashboard/getBoothAktif di atas).
    const sales = effectiveByGroup(salesRaw);

    const byProductMap = new Map<string, { productId: string; productName: string; cupSold: number }>();
    const byBoothMap = new Map<string, { boothId: string; boothName: string; cupSold: number; omzet: number }>();
    const byStaffShiftMap = new Map<
      string,
      { staffId: string; staffName: string; boothId: string; boothName: string; tanggal: string; shift: string; cupSold: number; omzet: number }
    >();

    for (const sale of sales) {
      const netOmzet = Number(sale.total) - sale.refunds.reduce((sum, r) => sum + Number(r.amount), 0);
      const cupSold = sale.items.reduce((sum, i) => sum + i.qty, 0);

      for (const item of sale.items) {
        const cur = byProductMap.get(item.productId) ?? {
          productId: item.productId,
          productName: item.productNameSnapshot,
          cupSold: 0,
        };
        cur.cupSold += item.qty;
        byProductMap.set(item.productId, cur);
      }

      const booth = byBoothMap.get(sale.boothId) ?? {
        boothId: sale.boothId,
        boothName: sale.booth.name,
        cupSold: 0,
        omzet: 0,
      };
      booth.cupSold += cupSold;
      booth.omzet += netOmzet;
      byBoothMap.set(sale.boothId, booth);

      const tanggal = businessDateKeyJakarta(sale.paidAt!);
      const shiftName = sale.shiftSession.shiftTemplate.name;
      const staffShiftKey = `${sale.staffId}__${sale.boothId}__${tanggal}__${shiftName}`;
      const staffShift = byStaffShiftMap.get(staffShiftKey) ?? {
        staffId: sale.staffId,
        staffName: sale.staff.fullName,
        boothId: sale.boothId,
        boothName: sale.booth.name,
        tanggal,
        shift: shiftName,
        cupSold: 0,
        omzet: 0,
      };
      staffShift.cupSold += cupSold;
      staffShift.omzet += netOmzet;
      byStaffShiftMap.set(staffShiftKey, staffShift);
    }

    return {
      byProduct: [...byProductMap.values()].sort((a, b) => b.cupSold - a.cupSold),
      byBooth: [...byBoothMap.values()].sort((a, b) => b.omzet - a.omzet),
      byStaffShift: [...byStaffShiftMap.values()].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.omzet - a.omzet),
    };
  }

  /// "Petugas mana yang sering kehabisan/menipis tapi tidak minta Restock" —
  /// menyusuri ulang ledger `StockMovement` per Booth+Produk untuk menemukan
  /// insiden Menipis/Kritis/Habis, lalu tandai insiden yang TIDAK direspons
  /// RestockRequest selama insiden itu berlangsung (parameter lihat konstanta
  /// NEGLECT_* di atas). Diatribusikan ke Petugas yang shift-nya sedang
  /// terbuka saat insiden mulai.
  async getStockNeglectReport(start: string, end: string) {
    const { awal, akhir } = rangeJakarta(start, end);
    const graceMs = NEGLECT_MIN_DURATION_HOURS * 60 * 60 * 1000;
    const lookbackMs = NEGLECT_LOOKBACK_HOURS * 60 * 60 * 1000;

    const [boothStocks, thresholds, products, booths, movements, shiftSessions, restockRequests] = await Promise.all([
      this.prisma.boothStock.findMany(),
      this.prisma.boothStockThreshold.findMany(),
      this.prisma.product.findMany(),
      this.prisma.booth.findMany(),
      this.prisma.stockMovement.findMany({
        where: {
          occurredAt: { lt: akhir },
          OR: [{ fromBoothId: { not: null } }, { toBoothId: { not: null } }],
        },
        orderBy: { occurredAt: 'asc' },
      }),
      this.prisma.shiftSession.findMany({
        where: { openedAt: { not: null, lt: akhir } },
        include: { staff: true },
        orderBy: { openedAt: 'asc' },
      }),
      this.prisma.restockRequest.findMany({
        where: { createdAt: { lt: akhir } },
        include: { items: true },
      }),
    ]);

    const productById = new Map(products.map((p) => [p.id, p]));
    const boothById = new Map(booths.map((b) => [b.id, b]));
    const thresholdByKey = new Map(thresholds.map((t) => [`${t.boothId}:${t.productId}`, t]));

    // Request diajukan kapan saja per (booth,produk) — dipakai cek "ada
    // respons?" per insiden tanpa query ulang per insiden.
    const requestTimesByPair = new Map<string, Date[]>();
    for (const req of restockRequests) {
      for (const item of req.items) {
        const key = `${req.boothId}:${item.productId}`;
        const arr = requestTimesByPair.get(key) ?? [];
        arr.push(req.createdAt);
        requestTimesByPair.set(key, arr);
      }
    }

    const shiftsByBooth = new Map<string, typeof shiftSessions>();
    for (const s of shiftSessions) {
      const arr = shiftsByBooth.get(s.boothId) ?? [];
      arr.push(s);
      shiftsByBooth.set(s.boothId, arr);
    }
    function shiftPadaWaktu(boothId: string, t: Date) {
      const arr = shiftsByBooth.get(boothId) ?? [];
      // Sudah terurut openedAt asc — ambil kandidat terakhir yang openedAt<=t
      // dan belum ditutup (atau ditutup setelah t).
      let found: (typeof arr)[number] | null = null;
      for (const s of arr) {
        if (!s.openedAt || s.openedAt.getTime() > t.getTime()) continue;
        if (s.closedAt && s.closedAt.getTime() < t.getTime()) continue;
        found = s;
      }
      return found;
    }

    interface PairState {
      boothId: string;
      productId: string;
      minimumQty: number;
      criticalQty: number;
      balance: number;
      status: StockStatus;
      incidentStart: Date | null;
    }

    const pairs = new Map<string, PairState>();
    for (const bs of boothStocks) {
      const key = `${bs.boothId}:${bs.productId}`;
      const threshold = thresholdByKey.get(key);
      const product = productById.get(bs.productId);
      if (!product) continue;
      pairs.set(key, {
        boothId: bs.boothId,
        productId: bs.productId,
        minimumQty: threshold?.minimumQty ?? product.minimumQty,
        criticalQty: threshold?.criticalQty ?? product.criticalQty,
        balance: 0,
        status: 'Aman',
        incidentStart: null,
      });
    }

    interface Insiden {
      boothId: string;
      productId: string;
      start: Date;
      end: Date;
      ongoing: boolean;
    }
    const insidenList: Insiden[] = [];

    for (const m of movements) {
      const kandidat = [m.fromBoothId, m.toBoothId].filter((b): b is string => !!b);
      for (const boothId of kandidat) {
        const key = `${boothId}:${m.productId}`;
        const state = pairs.get(key);
        if (!state) continue;
        const { delta } = dampakMutasi(m, boothId);
        if (delta === 0) continue;

        state.balance += delta;
        const statusBaru = resolveStockStatus(state.balance, state.minimumQty, state.criticalQty);

        if (m.occurredAt.getTime() >= awal.getTime()) {
          if (state.status === 'Aman' && statusBaru !== 'Aman' && !state.incidentStart) {
            state.incidentStart = m.occurredAt;
          } else if (state.status !== 'Aman' && statusBaru === 'Aman' && state.incidentStart) {
            insidenList.push({ boothId, productId: m.productId, start: state.incidentStart, end: m.occurredAt, ongoing: false });
            state.incidentStart = null;
          }
        }
        state.status = statusBaru;
      }
    }
    // Insiden yang masih berlangsung sampai akhir periode filter.
    for (const state of pairs.values()) {
      if (state.incidentStart) {
        insidenList.push({ boothId: state.boothId, productId: state.productId, start: state.incidentStart, end: akhir, ongoing: true });
      }
    }

    interface BarisDiam {
      staffId: string;
      staffName: string;
      boothId: string;
      boothName: string;
      jumlahInsiden: number;
      totalJamDiam: number;
      produk: Map<string, string>;
    }
    const byStaffMap = new Map<string, BarisDiam>();

    for (const insiden of insidenList) {
      const durasiMs = insiden.end.getTime() - insiden.start.getTime();
      if (durasiMs < graceMs) continue; // blip sesaat, bukan "diam"

      const key = `${insiden.boothId}:${insiden.productId}`;
      const requestTimes = requestTimesByPair.get(key) ?? [];
      const direspons = requestTimes.some(
        (t) => t.getTime() >= insiden.start.getTime() - lookbackMs && t.getTime() <= insiden.end.getTime(),
      );
      if (direspons) continue;

      const shift = shiftPadaWaktu(insiden.boothId, insiden.start);
      if (!shift) continue; // tidak ada Petugas yang bisa dikaitkan (tidak ada shift terbuka)

      const booth = boothById.get(insiden.boothId);
      const product = productById.get(insiden.productId);
      const staffKey = `${shift.staffId}:${insiden.boothId}`;
      const row = byStaffMap.get(staffKey) ?? {
        staffId: shift.staffId,
        staffName: shift.staff.fullName,
        boothId: insiden.boothId,
        boothName: booth?.name ?? '-',
        jumlahInsiden: 0,
        totalJamDiam: 0,
        produk: new Map<string, string>(),
      };
      row.jumlahInsiden += 1;
      row.totalJamDiam += durasiMs / (60 * 60 * 1000);
      if (product) row.produk.set(product.id, product.name);
      byStaffMap.set(staffKey, row);
    }

    return [...byStaffMap.values()]
      .map((r) => ({
        staffId: r.staffId,
        staffName: r.staffName,
        boothId: r.boothId,
        boothName: r.boothName,
        jumlahInsiden: r.jumlahInsiden,
        totalJamDiam: Math.round(r.totalJamDiam * 10) / 10,
        produk: [...r.produk.values()],
      }))
      .sort((a, b) => b.jumlahInsiden - a.jumlahInsiden || b.totalJamDiam - a.totalJamDiam);
  }
}
