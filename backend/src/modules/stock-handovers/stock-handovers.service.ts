import { Injectable } from '@nestjs/common';
import { DistributionStatus, Prisma, RestockRequestStatus, ShiftStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
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

  /// activeAssignments diurutkan openedAt desc (lihat ShiftsService.findActiveAssignments),
  /// jadi kalau 1 Booth kebetulan punya >1 sesi aktif bertumpuk, insert
  /// pertama (paling baru) yang wajib menang — bukan last-write-wins dari
  /// Map(array) biasa yang malah membiarkan sesi lama menimpa sesi baru.
  private buildActiveStaffByBooth(
    activeAssignments: Awaited<ReturnType<ShiftsService['findActiveAssignments']>>,
  ): Map<string, string | null> {
    const map = new Map<string, string | null>();
    for (const a of activeAssignments) {
      if (!map.has(a.boothId)) map.set(a.boothId, a.staffName);
    }
    return map;
  }

  private requestInclude() {
    return { booth: true, items: { include: { product: true } }, requestedBy: true } as const;
  }

  private distributionInclude() {
    return {
      booth: true,
      items: { include: { product: true } },
      restockRequest: { include: { requestedBy: true } },
      receivedBy: true,
      sentTo: true,
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
        d.restockRequest?.requestedBy.fullName ??
        d.receivedBy?.fullName ??
        d.sentTo?.fullName ??
        activeStaffByBooth.get(d.boothId) ??
        null,
      date: d.sentAt ?? d.createdAt,
      note: d.note,
      discrepancy: d.status === DistributionStatus.DISCREPANCY,
      items: d.items.map((i) => ({
        productId: i.productId,
        productName: i.product.name,
        qty: i.qtySent,
        qtyReceived: i.qtyReceived,
        sellPrice: Number(i.product.sellPrice),
        discrepancyReasonCode: i.discrepancyReasonCode,
        discrepancyNote: i.discrepancyNote,
      })),
    };
  }

  /// Jenis (Kirim Stok Awal/Re-Stok) SATU distribusi — diacu dari sesi
  /// Check-In Petugas yang menaungi Booth ini saat dikirim (ShiftSession
  /// openedAt..closedAt), BUKAN awal hari kalender. Alasannya: shift Malam
  /// yang check-in lewat tengah malam tetap harus dianggap "Awal" untuk
  /// kiriman pertamanya, walau hari kalendernya sama dengan shift
  /// sebelumnya. Dipanggil dari findOne() supaya buka 1 dokumen tidak perlu
  /// fetch semua distribusi cuma buat label ini.
  private async computeJenisFor(d: { id: string; boothId: string; sentAt: Date | null; status: DistributionStatus }) {
    if (!d.sentAt || d.status === DistributionStatus.CANCELLED) return null;

    const sesi = await this.prisma.shiftSession.findFirst({
      where: {
        boothId: d.boothId,
        openedAt: { not: null, lte: d.sentAt },
        OR: [{ closedAt: null }, { closedAt: { gt: d.sentAt } }],
      },
      orderBy: { openedAt: 'desc' },
    });
    if (!sesi?.openedAt) return null;

    const siblings = await this.prisma.stockDistribution.findMany({
      where: {
        boothId: d.boothId,
        sentAt: { gte: sesi.openedAt, ...(sesi.closedAt ? { lt: sesi.closedAt } : {}) },
        status: { not: DistributionStatus.CANCELLED },
      },
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
    const activeStaffByBooth = this.buildActiveStaffByBooth(activeAssignments);
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

  /// Stok yang masih "melayang" (status Diproses/SENT — sudah keluar dari
  /// Gudang tapi belum dikonfirmasi diterima Petugas), SATU baris PER
  /// DOKUMEN/transaksi (bukan lagi digabung per produk) — buat panel
  /// monitoring Admin ditampilkan sebagai card list ringkas per transaksi
  /// (Booth & Petugas tujuan), detail produknya baru dimuat saat di-expand.
  /// Item per dokumen tetap dikelompokkan Kategori (abjad, "Tanpa Kategori"
  /// di akhir) lalu Nama Produk (abjad).
  async findInTransitSummary() {
    const [distributions, activeAssignments] = await Promise.all([
      this.prisma.stockDistribution.findMany({
        where: { status: DistributionStatus.SENT },
        include: {
          items: { include: { product: { include: { category: true } } } },
          booth: true,
          restockRequest: { include: { requestedBy: true } },
          sentTo: true,
        },
        orderBy: { sentAt: 'desc' },
      }),
      this.shifts.findActiveAssignments(),
    ]);
    const activeStaffByBooth = this.buildActiveStaffByBooth(activeAssignments);

    return distributions.map((d) => {
      const staffName =
        d.restockRequest?.requestedBy.fullName ?? d.sentTo?.fullName ?? activeStaffByBooth.get(d.boothId) ?? null;
      const items = d.items
        .map((item) => ({
          productId: item.productId,
          productName: item.product.name,
          productCategory: item.product.category?.name ?? null,
          qty: item.qtySent,
        }))
        .sort((a, b) => {
          const kategoriA = a.productCategory ?? "￿";
          const kategoriB = b.productCategory ?? "￿";
          const kategoriCmp = kategoriA.localeCompare(kategoriB, "id");
          if (kategoriCmp !== 0) return kategoriCmp;
          return a.productName.localeCompare(b.productName, "id");
        });
      return {
        distributionId: d.id,
        distributionNo: d.distributionNo,
        boothId: d.boothId,
        boothName: d.booth.name,
        staffName,
        sentAt: d.sentAt,
        totalQty: items.reduce((sum, i) => sum + i.qty, 0),
        items,
      };
    });
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

    const activeStaffByBooth = this.buildActiveStaffByBooth(activeAssignments);
    const jenisById = await this.computeJenisBatch(distributions);

    const requestRows = requests.map((r) => this.mapRequestRow(r));
    const distributionRows = distributions.map((d) => this.mapDistributionRow(d, activeStaffByBooth, jenisById.get(d.id) ?? null));

    return [...requestRows, ...distributionRows].sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  /// Jenis (Stok Awal/Re-Stok) untuk SEKUMPULAN distribusi sekaligus — dipakai
  /// findAllForReport() (semua data) dan findAll() (satu window halaman).
  /// Dikelompokkan per Booth+ShiftSession yang menaungi `sentAt`, SAMA PERSIS
  /// dengan computeJenisFor() di atas (dulu di sini sempat dikelompokkan per
  /// businessDate kalender Jakarta — SALAH, dan ketauan dari 2 laporan
  /// tester yang saling berkebalikan: kiriman awal ke petugas yang baru
  /// check-in kena label "Re-Stok" kalau boothnya kebetulan sudah dikirimi
  /// di hari kalender yang sama sebelumnya, sementara restok yang jelas
  /// bukan kiriman pertama malah kena label "Awal" kalau jatuh di hari
  /// kalender baru padahal masih 1 sesi shift yang sama, mis. shift Malam
  /// yang nyeberang tengah malam). Lihat catatan di findAll() soal batas
  /// keakuratannya saat dipaginasi.
  private async computeJenisBatch(
    distributions: { id: string; boothId: string; sentAt: Date | null; status: DistributionStatus }[],
  ): Promise<Map<string, 'STOK_AWAL' | 'RE_STOK'>> {
    const sentDistributions = distributions.filter((d) => d.sentAt && d.status !== DistributionStatus.CANCELLED);
    const jenisById = new Map<string, 'STOK_AWAL' | 'RE_STOK'>();
    if (sentDistributions.length === 0) return jenisById;

    const boothIds = [...new Set(sentDistributions.map((d) => d.boothId))];
    const sessions = await this.prisma.shiftSession.findMany({
      where: { boothId: { in: boothIds }, openedAt: { not: null } },
      select: { id: true, boothId: true, openedAt: true, closedAt: true },
    });
    const sessionsByBooth = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const arr = sessionsByBooth.get(s.boothId) ?? [];
      arr.push(s);
      sessionsByBooth.set(s.boothId, arr);
    }

    // Sesi yang menaungi tiap distribusi ditentukan sama seperti
    // computeJenisFor() — openedAt <= sentAt <= closedAt (atau masih OPEN) —
    // ambil yang paling baru dibuka kalau lebih dari satu cocok.
    const groups = new Map<string, typeof sentDistributions>();
    for (const d of sentDistributions) {
      const sesi = (sessionsByBooth.get(d.boothId) ?? [])
        .filter((s) => s.openedAt! <= d.sentAt! && (s.closedAt === null || s.closedAt > d.sentAt!))
        .sort((a, b) => b.openedAt!.getTime() - a.openedAt!.getTime())[0];
      if (!sesi) continue; // tidak ada sesi yang menaungi -> tidak dilabel, sama seperti computeJenisFor
      const key = `${d.boothId}__${sesi.id}`;
      const group = groups.get(key) ?? [];
      group.push(d);
      groups.set(key, group);
    }
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

    const activeStaffByBooth = this.buildActiveStaffByBooth(activeAssignments);
    const jenisById = await this.computeJenisBatch(distributions);

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
        sentToId: dto.staffId,
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
