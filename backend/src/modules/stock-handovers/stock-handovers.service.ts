import { Injectable } from '@nestjs/common';
import { DistributionStatus, Prisma, RestockRequestStatus, ShiftStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { businessDateKeyJakarta, rangeJakarta } from '../../common/jakarta-date';
import { ActivityLogService } from '../../common/activity-log.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { DistributionsService } from '../distributions/distributions.service';
import { RestockRequestsService } from '../restock-requests/restock-requests.service';
import { ShiftsService } from '../shifts/shifts.service';
import { CancelDistributionDto, CorrectReceiptDto, ReviseDistributionDto } from '../distributions/dto/correction.dto';
import { ReceiveDistributionDto } from '../distributions/dto/receive-distribution.dto';
import { ApproveRestockRequestDto } from '../restock-requests/dto/approve-restock-request.dto';
import { RejectRestockRequestDto } from '../restock-requests/dto/reject-restock-request.dto';
import { CreateStockHandoverDto } from './dto/create-stock-handover.dto';

export const REQUEST_PREFIX = 'req_';
export const DISTRIBUTION_PREFIX = 'dist_';

/// "Serah Terima Stok" — 1 transaksi gabungan di layar Admin, dibangun DI
/// ATAS RestockRequest + StockDistribution yang sudah ada apa adanya (lihat
/// docsV2 & plan sesi ini): tidak ada migrasi skema, murni penyatuan
/// tampilan/API supaya Admin cuma lihat 1 daftar dengan status
/// Diajukan → Diproses → Diterima (+ Ditolak/Dibatalkan).
@Injectable()
export class StockHandoversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly distributions: DistributionsService,
    private readonly restockRequests: RestockRequestsService,
    private readonly shifts: ShiftsService,
    private readonly activityLog: ActivityLogService,
  ) {}

  private requestInclude() {
    return { booth: true, items: { include: { product: true } }, requestedBy: true } as const;
  }

  private distributionInclude() {
    return {
      booth: true,
      items: { include: { product: true } },
      restockRequest: { include: { requestedBy: true } },
      receivedBy: true,
    } as const;
  }

  private mapRequestRow(r: Prisma.RestockRequestGetPayload<{ include: ReturnType<StockHandoversService['requestInclude']> }>) {
    return {
      id: `${REQUEST_PREFIX}${r.id}`,
      kind: 'request' as const,
      docNo: r.requestNo,
      status: r.status === RestockRequestStatus.REQUESTED ? ('DIAJUKAN' as const) : ('DITOLAK' as const),
      sumber: 'PETUGAS' as const,
      jenis: null,
      boothId: r.boothId,
      boothName: r.booth.name,
      staffName: r.requestedBy.fullName,
      date: r.createdAt,
      note: r.note,
      rejectReason: r.rejectReason,
      items: r.items.map((i) => ({ productId: i.productId, productName: i.product.name, qty: i.qtyRequested })),
    };
  }

  private mapDistributionRow(
    d: Prisma.StockDistributionGetPayload<{ include: ReturnType<StockHandoversService['distributionInclude']> }>,
    activeStaffByBooth: Map<string, string | null>,
    jenis: 'STOK_AWAL' | 'RE_STOK' | null,
  ) {
    const status =
      d.status === DistributionStatus.CANCELLED
        ? ('DIBATALKAN' as const)
        : d.status === DistributionStatus.SENT || d.status === DistributionStatus.DRAFT
          ? ('DIPROSES' as const)
          : ('DITERIMA' as const);
    return {
      id: `${DISTRIBUTION_PREFIX}${d.id}`,
      kind: 'distribution' as const,
      docNo: d.distributionNo,
      status,
      sumber: d.restockRequest ? ('PETUGAS' as const) : ('ADMIN' as const),
      jenis,
      boothId: d.boothId,
      boothName: d.booth.name,
      staffName:
        d.restockRequest?.requestedBy.fullName ?? d.receivedBy?.fullName ?? activeStaffByBooth.get(d.boothId) ?? null,
      date: d.sentAt ?? d.createdAt,
      note: d.note,
      discrepancy: d.status === DistributionStatus.DISCREPANCY,
      items: d.items.map((i) => ({
        productId: i.productId,
        productName: i.product.name,
        qty: i.qtySent,
        qtyReceived: i.qtyReceived,
      })),
    };
  }

  /// Jenis (Stok Awal/Re-Stok) SATU distribusi — dihitung dari urutan sentAt
  /// di antara sibling-nya di Booth+tanggal bisnis yang sama saja (query
  /// dibatasi ke satu hari satu Booth), BUKAN dari seluruh riwayat distribusi
  /// yang pernah ada. Dipanggil dari findOne() supaya buka 1 dokumen tidak
  /// perlu fetch semua distribusi cuma buat label ini.
  private async computeJenisFor(d: { id: string; boothId: string; sentAt: Date | null; status: DistributionStatus }) {
    if (!d.sentAt || d.status === DistributionStatus.CANCELLED) return null;
    const tanggal = businessDateKeyJakarta(d.sentAt);
    const { awal, akhir } = rangeJakarta(tanggal, tanggal);
    const siblings = await this.prisma.stockDistribution.findMany({
      where: { boothId: d.boothId, sentAt: { gte: awal, lt: akhir }, status: { not: DistributionStatus.CANCELLED } },
      orderBy: { sentAt: 'asc' },
      select: { id: true },
    });
    const index = siblings.findIndex((s) => s.id === d.id);
    return index === 0 ? ('STOK_AWAL' as const) : ('RE_STOK' as const);
  }

  async findOne(id: string) {
    if (id.startsWith(REQUEST_PREFIX)) {
      const realId = this.stripPrefix(id, REQUEST_PREFIX);
      const r = await this.prisma.restockRequest.findUnique({ where: { id: realId }, include: this.requestInclude() });
      if (!r) throw new DomainError('NOT_FOUND', 'Serah Terima Stok tidak ditemukan.');
      return this.mapRequestRow(r);
    }

    const realId = this.stripPrefix(id, DISTRIBUTION_PREFIX);
    const d = await this.prisma.stockDistribution.findUnique({ where: { id: realId }, include: this.distributionInclude() });
    if (!d) throw new DomainError('NOT_FOUND', 'Serah Terima Stok tidak ditemukan.');
    const [activeAssignments, jenis] = await Promise.all([this.shifts.findActiveAssignments(), this.computeJenisFor(d)]);
    const activeStaffByBooth = new Map(activeAssignments.map((a) => [a.boothId, a.staffName]));
    return this.mapDistributionRow(d, activeStaffByBooth, jenis);
  }

  /// Riwayat aktivitas gabungan — kalau dokumen ini asalnya dari pengajuan
  /// Petugas (restockRequest terisi), atau sudah pernah direvisi (rantai
  /// `revisionOfId`), telusuri semua entityId terkait supaya riwayatnya utuh
  /// dari Diajukan sampai Diterima, bukan cuma potongan terakhir.
  async findActivityLog(id: string) {
    const entries: Awaited<ReturnType<ActivityLogService['findForEntity']>> = [];

    if (id.startsWith(REQUEST_PREFIX)) {
      const realId = this.stripPrefix(id, REQUEST_PREFIX);
      entries.push(...(await this.activityLog.findForEntity('restock_request', realId)));
      const request = await this.prisma.restockRequest.findUnique({ where: { id: realId } });
      if (request?.distributionId) {
        entries.push(...(await this.walkDistributionLog(request.distributionId)));
      }
    } else {
      const realId = this.stripPrefix(id, DISTRIBUTION_PREFIX);
      entries.push(...(await this.walkDistributionLog(realId)));
      const request = await this.prisma.restockRequest.findFirst({ where: { distributionId: realId } });
      if (request) {
        entries.push(...(await this.activityLog.findForEntity('restock_request', request.id)));
      }
    }

    return entries.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }

  /// Jalan mundur rantai revisi (`revisionOfId`) supaya riwayat dokumen v2
  /// juga menampilkan aksi yang terjadi di v1-nya.
  private async walkDistributionLog(distributionId: string) {
    const entries: Awaited<ReturnType<ActivityLogService['findForEntity']>> = [];
    let currentId: string | null = distributionId;
    while (currentId) {
      entries.push(...(await this.activityLog.findForEntity('stock_distribution', currentId)));
      const current: { revisionOfId: string | null } | null = await this.prisma.stockDistribution.findUnique({
        where: { id: currentId },
        select: { revisionOfId: true },
      });
      currentId = current?.revisionOfId ?? null;
    }
    return entries;
  }

  /// Rekap stok yang masih "melayang" (status Diproses/SENT — sudah keluar
  /// dari Gudang tapi belum dikonfirmasi diterima Petugas), dikelompokkan
  /// per produk + rincian tujuan Booth-nya, buat panel monitoring Admin.
  async findInTransitSummary() {
    const [distributions, activeAssignments] = await Promise.all([
      this.prisma.stockDistribution.findMany({
        where: { status: DistributionStatus.SENT },
        include: { items: { include: { product: true } }, booth: true, restockRequest: { include: { requestedBy: true } } },
      }),
      this.shifts.findActiveAssignments(),
    ]);
    const activeStaffByBooth = new Map(activeAssignments.map((a) => [a.boothId, a.staffName]));

    const byProduct = new Map<
      string,
      {
        productId: string;
        productName: string;
        totalQty: number;
        destinations: Map<string, { boothId: string; boothName: string; staffName: string | null; qty: number }>;
      }
    >();

    for (const d of distributions) {
      const staffName = d.restockRequest?.requestedBy.fullName ?? activeStaffByBooth.get(d.boothId) ?? null;
      for (const item of d.items) {
        const row = byProduct.get(item.productId) ?? {
          productId: item.productId,
          productName: item.product.name,
          totalQty: 0,
          destinations: new Map<string, { boothId: string; boothName: string; staffName: string | null; qty: number }>(),
        };
        row.totalQty += item.qtySent;
        const dest = row.destinations.get(d.boothId) ?? {
          boothId: d.boothId,
          boothName: d.booth.name,
          staffName,
          qty: 0,
        };
        dest.qty += item.qtySent;
        row.destinations.set(d.boothId, dest);
        byProduct.set(item.productId, row);
      }
    }

    return Array.from(byProduct.values())
      .map((r) => ({
        productId: r.productId,
        productName: r.productName,
        totalQty: r.totalQty,
        destinations: Array.from(r.destinations.values()).sort((a, b) => b.qty - a.qty),
      }))
      .sort((a, b) => b.totalQty - a.totalQty);
  }

  /// Dipakai laporan PDF/Excel (StockHandoverReportService) yang memang
  /// butuh SEMUA dokumen yang cocok filter buat satu dokumen ekspor utuh —
  /// beda tujuan dari findAll() di bawah yang buat daftar interaktif di
  /// layar. SENGAJA masih tanpa batas (unbounded): unduh laporan itu aksi
  /// manual sesekali oleh satu Admin, bukan query yang jalan tiap halaman
  /// dibuka — trade-off yang wajar buat sekarang, dicatat di sini kalau
  /// suatu saat perlu direvisit.
  async findAllForReport() {
    const [requests, distributions, activeAssignments] = await Promise.all([
      this.prisma.restockRequest.findMany({
        where: { status: { in: [RestockRequestStatus.REQUESTED, RestockRequestStatus.REJECTED] } },
        include: this.requestInclude(),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockDistribution.findMany({
        include: this.distributionInclude(),
        orderBy: { createdAt: 'desc' },
      }),
      this.shifts.findActiveAssignments(),
    ]);

    const activeStaffByBooth = new Map(activeAssignments.map((a) => [a.boothId, a.staffName]));
    const jenisById = this.computeJenisBatch(distributions);

    const requestRows = requests.map((r) => this.mapRequestRow(r));
    const distributionRows = distributions.map((d) => this.mapDistributionRow(d, activeStaffByBooth, jenisById.get(d.id) ?? null));

    return [...requestRows, ...distributionRows].sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  /// Jenis (Stok Awal/Re-Stok) untuk SEKUMPULAN distribusi sekaligus — dipakai
  /// findAllForReport() (semua data) dan findAll() (satu window halaman).
  /// Dikelompokkan per Booth+businessDate Jakarta di antara baris yang
  /// diberikan SAJA — lihat catatan di findAll() soal batas keakuratannya
  /// saat dipaginasi.
  private computeJenisBatch(
    distributions: { id: string; boothId: string; sentAt: Date | null; status: DistributionStatus }[],
  ): Map<string, 'STOK_AWAL' | 'RE_STOK'> {
    const sentDistributions = distributions.filter((d) => d.sentAt && d.status !== DistributionStatus.CANCELLED);
    const groups = new Map<string, typeof sentDistributions>();
    for (const d of sentDistributions) {
      const key = `${d.boothId}__${businessDateKeyJakarta(d.sentAt!)}`;
      const group = groups.get(key) ?? [];
      group.push(d);
      groups.set(key, group);
    }
    const jenisById = new Map<string, 'STOK_AWAL' | 'RE_STOK'>();
    for (const group of groups.values()) {
      group.sort((a, b) => a.sentAt!.getTime() - b.sentAt!.getTime());
      group.forEach((d, index) => jenisById.set(d.id, index === 0 ? 'STOK_AWAL' : 'RE_STOK'));
    }
    return jenisById;
  }

  /// List Serah Terima Stok dipaginasi di server (dulu ambil SEMUA
  /// RestockRequest + SEMUA StockDistribution yang pernah ada, tanpa batas
  /// sama sekali — lihat percakapan soal performa). Gabungan dua tabel jadi
  /// tidak bisa langsung skip/take satu query SQL; solusinya di sini: ambil
  /// `page * limit` baris TERBARU dari MASING-MASING sumber (cukup buat
  /// menjamin halaman manapun tetap benar), gabung, urutkan, baru potong ke
  /// window halaman yang diminta. Query per sumber tetap kena index
  /// (status/boothId/createdAt), dan tidak pernah menarik lebih dari yang
  /// benar-benar perlu buat sampai ke halaman yang diminta.
  ///
  /// Known trade-off: label Jenis (Stok Awal/Re-Stok) dihitung dari batch
  /// yang ke-fetch SAJA, bukan seluruh riwayat Booth itu — di baris paling
  /// pinggir sebuah halaman, ada kemungkinan kecil labelnya meleset (mis.
  /// keliru dianggap "Stok Awal" padahal ada distribusi lebih pagi yang
  /// kebetulan jatuh di luar batch). Ini cuma label informasi, tidak
  /// memengaruhi angka stok — dibiarkan demi menghindari query tambahan yang
  /// tidak dibatasi buat tiap baris.
  async findAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'DIAJUKAN' | 'DIPROSES' | 'DITERIMA' | 'DITOLAK' | 'DIBATALKAN';
    boothId?: string;
  }) {
    const page = Math.max(1, params?.page ?? 1);
    const limit = Math.min(100, Math.max(1, params?.limit ?? 20));
    const fetchTake = page * limit;

    const requestOnlyStatus: Record<string, RestockRequestStatus> = {
      DIAJUKAN: RestockRequestStatus.REQUESTED,
      DITOLAK: RestockRequestStatus.REJECTED,
    };
    const distributionOnlyStatus: Record<string, DistributionStatus[]> = {
      DIPROSES: [DistributionStatus.SENT, DistributionStatus.DRAFT],
      DITERIMA: [DistributionStatus.RECEIVED, DistributionStatus.DISCREPANCY],
      DIBATALKAN: [DistributionStatus.CANCELLED],
    };
    const statusFilter = params?.status;
    // Status Diajukan/Ditolak cuma ada di sisi RestockRequest — kalau itu
    // yang dipilih, sisi StockDistribution harus kosong sama sekali (bukan
    // dibiarkan tanpa filter), begitu juga sebaliknya.
    const skipRequests = !!statusFilter && !requestOnlyStatus[statusFilter];
    const skipDistributions = !!statusFilter && !distributionOnlyStatus[statusFilter];

    const requestWhere: Prisma.RestockRequestWhereInput = {
      status: statusFilter
        ? requestOnlyStatus[statusFilter]
        : { in: [RestockRequestStatus.REQUESTED, RestockRequestStatus.REJECTED] },
      ...(params?.boothId ? { boothId: params.boothId } : {}),
      ...(params?.search
        ? {
            OR: [
              { requestNo: { contains: params.search, mode: 'insensitive' } },
              { requestedBy: { fullName: { contains: params.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const distributionWhere: Prisma.StockDistributionWhereInput = {
      ...(statusFilter ? { status: { in: distributionOnlyStatus[statusFilter] ?? [] } } : {}),
      ...(params?.boothId ? { boothId: params.boothId } : {}),
      ...(params?.search
        ? {
            OR: [
              { distributionNo: { contains: params.search, mode: 'insensitive' } },
              { receivedBy: { fullName: { contains: params.search, mode: 'insensitive' } } },
              { restockRequest: { requestedBy: { fullName: { contains: params.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [requestsTotal, distributionsTotal, requests, distributions, activeAssignments] = await Promise.all([
      skipRequests ? 0 : this.prisma.restockRequest.count({ where: requestWhere }),
      skipDistributions ? 0 : this.prisma.stockDistribution.count({ where: distributionWhere }),
      skipRequests
        ? []
        : this.prisma.restockRequest.findMany({
            where: requestWhere,
            include: this.requestInclude(),
            orderBy: { createdAt: 'desc' },
            take: fetchTake,
          }),
      skipDistributions
        ? []
        : this.prisma.stockDistribution.findMany({
            where: distributionWhere,
            include: this.distributionInclude(),
            orderBy: { createdAt: 'desc' },
            take: fetchTake,
          }),
      this.shifts.findActiveAssignments(),
    ]);

    const activeStaffByBooth = new Map(activeAssignments.map((a) => [a.boothId, a.staffName]));
    const jenisById = this.computeJenisBatch(distributions);

    const requestRows = requests.map((r) => this.mapRequestRow(r));
    const distributionRows = distributions.map((d) => this.mapDistributionRow(d, activeStaffByBooth, jenisById.get(d.id) ?? null));

    const merged = [...requestRows, ...distributionRows].sort((a, b) => b.date.getTime() - a.date.getTime());
    const start = (page - 1) * limit;

    return {
      rows: merged.slice(start, start + limit),
      total: requestsTotal + distributionsTotal,
      page,
      limit,
    };
  }

  /// Admin kirim langsung ke Petugas yang sedang Aktif. Booth diturunkan dari
  /// ShiftSession Petugas ybs — TIDAK dipilih manual (2 informasi wajib,
  /// lihat DocsV2, sudah otomatis lewat 1 pilihan Petugas).
  async create(dto: CreateStockHandoverDto, actorId: string, actorName: string) {
    const activeSession = await this.prisma.shiftSession.findFirst({
      where: { staffId: dto.staffId, status: { in: [ShiftStatus.OPEN, ShiftStatus.CLOSING] } },
    });
    if (!activeSession) {
      throw new DomainError(
        'STAFF_NOT_ACTIVE',
        'Petugas ini sedang tidak Aktif (belum Check-In atau sudah Check-Out).',
      );
    }

    return this.distributions.create(
      {
        idempotencyKey: randomUUID(),
        boothId: activeSession.boothId,
        items: dto.items,
        note: dto.note,
      },
      actorId,
      actorName,
    );
  }

  approve(id: string, dto: ApproveRestockRequestDto, actorId: string, actorName: string) {
    return this.restockRequests.approve(this.stripPrefix(id, REQUEST_PREFIX), dto, actorId, actorName);
  }

  reject(id: string, dto: RejectRestockRequestDto, actorId: string, actorName: string) {
    return this.restockRequests.reject(this.stripPrefix(id, REQUEST_PREFIX), dto, actorId, actorName);
  }

  receive(id: string, dto: ReceiveDistributionDto, user: JwtPayload) {
    return this.distributions.receive(this.stripPrefix(id, DISTRIBUTION_PREFIX), dto, user);
  }

  cancel(id: string, dto: CancelDistributionDto, user: JwtPayload) {
    return this.distributions.cancelDistribution(user, this.stripPrefix(id, DISTRIBUTION_PREFIX), dto);
  }

  revise(id: string, dto: ReviseDistributionDto, user: JwtPayload) {
    return this.distributions.reviseDistribution(user, this.stripPrefix(id, DISTRIBUTION_PREFIX), dto);
  }

  correctReceipt(id: string, dto: CorrectReceiptDto, user: JwtPayload) {
    return this.distributions.correctReceipt(user, this.stripPrefix(id, DISTRIBUTION_PREFIX), dto);
  }

  private stripPrefix(id: string, prefix: string): string {
    if (!id.startsWith(prefix)) {
      throw new DomainError('INVALID_ID', `Id "${id}" tidak sesuai untuk aksi ini.`);
    }
    return id.slice(prefix.length);
  }
}
