import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, ShiftStatus, StockCountStatus, StockMovementType, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { generateDocNo } from '../../common/doc-no';
import { SAFE_PROFILE_SELECT } from '../../common/safe-profile';
import { combineJakartaDateAndTime, startOfTodayJakarta, batasBulanJakarta } from '../../common/jakarta-date';
import { CorrectionsService } from '../corrections/corrections.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CheckInDto } from './dto/check-in.dto';
import { ConfirmClosingDto } from './dto/confirm-closing.dto';
import { CorrectShiftDto } from './dto/correct-shift.dto';

const UNIQUE_VIOLATION = 'P2002';

function businessDateOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

const LOCATION_WARNING_RADIUS_METERS = 300;
const EARTH_RADIUS_METERS = 6_371_000;

/// Jarak antara dua koordinat (haversine), dipakai murni utk peringatan
/// non-blocking — akurasi GPS device tidak bisa dipercaya utk hard block
/// (lihat komentar checkInLatitude/dst di schema.prisma).
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly corrections: CorrectionsService,
    private readonly jwtService: JwtService,
  ) {}

  /// Mirrors get_my_active_shift() from
  /// docs/obbel-coffee-ai-docs/09-api-rpc-contract.md.
  async getMyActiveShift(user: JwtPayload) {
    const shift = await this.prisma.shiftSession.findFirst({
      where: {
        staffId: user.sub,
        status: { in: [ShiftStatus.OPEN, ShiftStatus.CLOSING] },
      },
      include: { booth: true, shiftTemplate: true },
      orderBy: { scheduledStartAt: 'desc' },
    });

    if (!shift) {
      throw new NotFoundException('Belum ada shift aktif untuk user ini.');
    }

    // Token yang sedang dipakai bisa saja masih dari login SEBELUM Check-In
    // (boothId null, lihat `checkIn()` di atas) — reissue supaya endpoint
    // booth-scoped lain langsung jalan tanpa staff harus login ulang.
    const accessToken = user.boothId !== shift.boothId ? await this.reissueToken(user, shift.boothId) : undefined;
    return this.toActiveShiftResponse(shift, accessToken);
  }

  /// Daftar Petugas yang sedang Aktif (sudah Check-In, belum Check-Out) —
  /// dipakai picker "Petugas" di Serah Terima Stok (Admin pilih Petugas,
  /// Booth ikut otomatis dari sini, bukan dipilih manual).
  async findActiveAssignments() {
    const sessions = await this.prisma.shiftSession.findMany({
      where: { status: { in: [ShiftStatus.OPEN, ShiftStatus.CLOSING] } },
      include: { booth: true, staff: { select: SAFE_PROFILE_SELECT } },
      orderBy: { openedAt: 'desc' },
    });
    return sessions.map((s) => ({
      shiftSessionId: s.id,
      staffId: s.staffId,
      staffName: s.staff.fullName,
      boothId: s.boothId,
      boothName: s.booth.name,
    }));
  }

  /// Absen Berangkat — membuka ShiftSession (SCHEDULED tidak pernah dibuat
  /// duluan, jadi langsung create berstatus OPEN). Booth default diambil dari
  /// BoothShiftAssignment staff ybs (roster tetap Booth+Shift per staff),
  /// `dto.boothId` boleh override manual. Idempotent terhadap double-tap:
  /// kalau staff SUDAH aktif di Booth yang sama, kembalikan session yang
  /// sudah ada apa adanya alih-alih membuat baris baru. Guard ini sudah
  /// dijamin race-safe di level DB juga lewat partial unique index
  /// (shift_sessions_one_active_per_staff, migration
  /// 20260922165212_shift_session_checkin) — kalau dua request check-in
  /// beneran race lolos dari cek `existing` di atas, insert-nya sendiri yang
  /// bakal gagal kena constraint itu, ditangkap di bawah.
  async checkIn(user: JwtPayload, dto: CheckInDto) {
    const existing = await this.prisma.shiftSession.findFirst({
      where: { staffId: user.sub, status: { in: [ShiftStatus.OPEN, ShiftStatus.CLOSING] } },
      include: { booth: true, shiftTemplate: true },
    });
    if (existing) {
      if (dto.boothId && dto.boothId !== existing.boothId) {
        throw new DomainError(
          'ALREADY_CHECKED_IN_ELSEWHERE',
          `Anda masih aktif di Booth "${existing.booth.name}". Checkout dulu sebelum check-in ke Booth lain.`,
        );
      }
      return this.toActiveShiftResponse(existing, await this.reissueToken(user, existing.boothId));
    }

    const assignment = await this.prisma.boothShiftAssignment.findUnique({
      where: { staffId: user.sub },
      include: { shiftTemplate: true },
    });
    if (!assignment) {
      throw new DomainError(
        'NO_BOOTH_ASSIGNMENT',
        'Anda belum ditugaskan ke Booth manapun. Hubungi Admin untuk mengatur penugasan Booth/Shift.',
      );
    }

    const boothId = dto.boothId ?? assignment.boothId;
    const booth = await this.prisma.booth.findUnique({ where: { id: boothId } });
    if (!booth || booth.status !== 'ACTIVE') {
      throw new DomainError('BOOTH_INACTIVE', 'Booth tidak ditemukan atau sudah nonaktif.');
    }

    const businessDate = startOfTodayJakarta();
    const openedAt = new Date();
    const scheduledStartAt = combineJakartaDateAndTime(businessDate, assignment.shiftTemplate.startTime);
    const scheduledEndAt = combineJakartaDateAndTime(businessDate, assignment.shiftTemplate.endTime);

    let created;
    try {
      created = await this.prisma.shiftSession.create({
        data: {
          businessDate,
          boothId,
          shiftTemplateId: assignment.shiftTemplateId,
          staffId: user.sub,
          status: ShiftStatus.OPEN,
          scheduledStartAt,
          scheduledEndAt,
          openedAt,
          checkInLatitude: dto.latitude,
          checkInLongitude: dto.longitude,
          checkInPhotoUrl: dto.photoUrl,
        },
        include: { booth: true, shiftTemplate: true },
      });
    } catch (err) {
      const raced = err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_VIOLATION;
      if (!raced) throw err;
      const winner = await this.prisma.shiftSession.findFirstOrThrow({
        where: { staffId: user.sub, status: { in: [ShiftStatus.OPEN, ShiftStatus.CLOSING] } },
        include: { booth: true, shiftTemplate: true },
      });
      return this.toActiveShiftResponse(winner, await this.reissueToken(user, winner.boothId));
    }

    const locationWarning = this.computeLocationWarning(dto.latitude, dto.longitude, booth);
    return this.toActiveShiftResponse(created, await this.reissueToken(user, boothId), locationWarning);
  }

  /// Soft-check lokasi Check-In/Check-Out terhadap Booth.latitude/longitude —
  /// TIDAK memblokir absen (akurasi GPS device tidak bisa dipercaya utk hard
  /// block), cuma dikembalikan sebagai peringatan non-blocking di response.
  private computeLocationWarning(
    latitude: number,
    longitude: number,
    booth: { name: string; latitude: unknown; longitude: unknown },
  ): string | undefined {
    if (booth.latitude == null || booth.longitude == null) return undefined;
    const distance = distanceMeters(
      { lat: latitude, lng: longitude },
      { lat: Number(booth.latitude), lng: Number(booth.longitude) },
    );
    if (distance <= LOCATION_WARNING_RADIUS_METERS) return undefined;
    return `Lokasi Anda sekitar ${Math.round(distance)}m dari Booth "${booth.name}". Pastikan Anda berada di lokasi yang benar.`;
  }

  /// JWT `boothId` dipakai banyak endpoint booth-scoped (catalog,
  /// distributions/pending, restock-requests — lihat masing-masing
  /// controller) tapi cuma diisi dari `Profile.defaultBoothId` saat login.
  /// Staff yang boothnya ditentukan lewat BoothShiftAssignment (bukan
  /// defaultBoothId) akan punya boothId null di token lamanya — reissue di
  /// sini supaya endpoint-endpoint itu langsung berfungsi begitu Check-In
  /// selesai, tanpa harus login ulang.
  private reissueToken(user: JwtPayload, boothId: string) {
    return this.jwtService.signAsync({
      sub: user.sub,
      username: user.username,
      role: user.role,
      boothId,
    });
  }

  private toActiveShiftResponse(
    shift: {
      id: string;
      booth: { id: string; code: string; name: string };
      shiftTemplate: { name: string };
      status: ShiftStatus;
      scheduledStartAt: Date;
      scheduledEndAt: Date;
    },
    accessToken?: string,
    locationWarning?: string,
  ) {
    return {
      shiftSessionId: shift.id,
      booth: { id: shift.booth.id, code: shift.booth.code, name: shift.booth.name },
      shiftName: shift.shiftTemplate.name,
      status: shift.status,
      scheduledStartAt: shift.scheduledStartAt,
      scheduledEndAt: shift.scheduledEndAt,
      ...(accessToken ? { accessToken } : {}),
      ...(locationWarning ? { locationWarning } : {}),
    };
  }

  private async loadOwnedShift(shiftSessionId: string, user: JwtPayload) {
    const shift = await this.prisma.shiftSession.findUnique({ where: { id: shiftSessionId } });
    if (!shift) {
      throw new DomainError('NOT_FOUND', 'Shift tidak ditemukan.');
    }
    if (user.role === UserRole.BOOTH_STAFF && shift.staffId !== user.sub) {
      throw new DomainError('UNAUTHORIZED_BOOTH', 'Shift ini bukan milik user yang login.');
    }
    return shift;
  }

  /// Mirrors start_shift_closing (§09): snapshot current Booth stock jadi
  /// "expected", lalu ubah shift ke CLOSING. Idempotent — kalau closing
  /// draft sudah ada, kembalikan yang itu (bukan bikin snapshot baru).
  async startClosing(shiftSessionId: string, user: JwtPayload) {
    const shift = await this.loadOwnedShift(shiftSessionId, user);

    const existing = await this.prisma.shiftStockCount.findUnique({
      where: { shiftSessionId },
      include: { items: { include: { product: true } } },
    });
    if (existing) {
      return this.toClosingResponse(existing);
    }

    if (shift.status !== ShiftStatus.OPEN) {
      throw new DomainError('SHIFT_NOT_OPEN', 'Shift harus berstatus OPEN untuk memulai closing.');
    }

    const boothStocks = await this.prisma.boothStock.findMany({
      where: { boothId: shift.boothId },
      include: { product: true },
    });

    const count = await this.prisma.$transaction(async (tx) => {
      await tx.shiftSession.update({
        where: { id: shiftSessionId },
        data: { status: ShiftStatus.CLOSING, closingStartedAt: new Date() },
      });

      return tx.shiftStockCount.create({
        data: {
          shiftSessionId,
          countedById: user.sub,
          status: StockCountStatus.DRAFT,
          items: {
            createMany: {
              data: boothStocks.map((s) => ({
                productId: s.productId,
                expectedQty: s.qtyOnHand,
                actualQty: s.qtyOnHand,
              })),
            },
          },
        },
        include: { items: { include: { product: true } } },
      });
    });

    return this.toClosingResponse(count);
  }

  /// Mirrors confirm_shift_closing (§09): item dengan selisih wajib
  /// reason_code (BR-011), lalu Booth stock disesuaikan ke actual lewat
  /// movement ADJUSTMENT (BR-012) dan shift ditutup.
  async confirmClosing(shiftSessionId: string, dto: ConfirmClosingDto, user: JwtPayload) {
    const shift = await this.loadOwnedShift(shiftSessionId, user);
    const booth = await this.prisma.booth.findUniqueOrThrow({ where: { id: shift.boothId } });

    const count = await this.prisma.shiftStockCount.findUnique({
      where: { shiftSessionId },
      include: { items: true },
    });
    if (!count) {
      throw new DomainError('CLOSING_NOT_STARTED', 'Closing belum dimulai untuk shift ini.');
    }
    if (count.status === StockCountStatus.CONFIRMED) {
      return this.toClosingResponse(
        (await this.prisma.shiftStockCount.findUnique({
          where: { shiftSessionId },
          include: { items: { include: { product: true } } },
        }))!,
      );
    }
    if (shift.status !== ShiftStatus.CLOSING) {
      throw new DomainError('SHIFT_NOT_CLOSING', 'Shift ini tidak sedang dalam proses closing.');
    }

    const inputByProduct = new Map(dto.items.map((i) => [i.productId, i]));
    for (const item of count.items) {
      const input = inputByProduct.get(item.productId);
      if (!input) continue;
      if (input.actualQty !== item.expectedQty && !input.reasonCode) {
        throw new DomainError(
          'DISCREPANCY_REASON_REQUIRED',
          'Alasan wajib diisi untuk produk dengan selisih stok.',
          { productId: item.productId },
        );
      }
    }

    const closedAt = new Date();
    const businessDate = businessDateOf(closedAt);

    await this.prisma.$transaction(async (tx) => {
      for (const item of count.items) {
        const input = inputByProduct.get(item.productId);
        const actualQty = input?.actualQty ?? item.expectedQty;
        const discrepancyQty = actualQty - item.expectedQty;

        await tx.shiftStockCountItem.update({
          where: { id: item.id },
          data: {
            actualQty,
            discrepancyQty,
            reasonCode: input?.reasonCode,
            reasonNote: input?.reasonNote,
          },
        });

        if (discrepancyQty !== 0) {
          await tx.boothStock.update({
            where: { boothId_productId: { boothId: shift.boothId, productId: item.productId } },
            data: { qtyOnHand: actualQty, version: { increment: 1 } },
          });

          await tx.stockMovement.create({
            data: {
              movementNo: generateDocNo('ADJ'),
              movementType: StockMovementType.ADJUSTMENT,
              productId: item.productId,
              qty: Math.abs(discrepancyQty),
              fromBoothId: discrepancyQty < 0 ? shift.boothId : null,
              toBoothId: discrepancyQty > 0 ? shift.boothId : null,
              referenceType: 'shift_closing',
              referenceId: count.id,
              shiftSessionId,
              businessDate,
              occurredAt: closedAt,
              createdBy: user.sub,
              note: input?.reasonNote ?? input?.reasonCode ?? 'Selisih closing shift',
            },
          });
        }
      }

      await tx.shiftStockCount.update({
        where: { id: count.id },
        data: { status: StockCountStatus.CONFIRMED, confirmedAt: closedAt },
      });

      await tx.shiftSession.update({
        where: { id: shiftSessionId },
        data: {
          status: ShiftStatus.CLOSED,
          closedAt,
          checkOutLatitude: dto.checkOutLatitude,
          checkOutLongitude: dto.checkOutLongitude,
          checkOutPhotoUrl: dto.checkOutPhotoUrl,
        },
      });
    });

    const final = await this.prisma.shiftStockCount.findUnique({
      where: { shiftSessionId },
      include: { items: { include: { product: true } } },
    });
    const locationWarning = this.computeLocationWarning(dto.checkOutLatitude, dto.checkOutLongitude, booth);
    return { ...this.toClosingResponse(final!), ...(locationWarning ? { locationWarning } : {}) };
  }

  /// Riwayat Absen — daftar ShiftSession milik staff yang login pada satu
  /// bulan (default bulan berjalan Asia/Jakarta), + agregat "Total Hadir
  /// Bulan Ini" utk kartu ringkasan di layar Riwayat Absen.
  async getMyHistory(user: JwtPayload, month?: string) {
    const now = new Date();
    const jakartaNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const [tahun, bulan] = month
      ? month.split('-').map(Number)
      : [jakartaNow.getUTCFullYear(), jakartaNow.getUTCMonth() + 1];
    const { awal, akhir } = batasBulanJakarta(bulan, tahun);

    const shifts = await this.prisma.shiftSession.findMany({
      where: { staffId: user.sub, businessDate: { gte: awal, lt: akhir } },
      include: { booth: true },
      orderBy: { businessDate: 'desc' },
    });

    const isCurrentMonth = tahun === jakartaNow.getUTCFullYear() && bulan === jakartaNow.getUTCMonth() + 1;
    const akhirHariBerjalan = isCurrentMonth
      ? jakartaNow.getUTCDate()
      : Math.round((akhir.getTime() - awal.getTime()) / (24 * 60 * 60 * 1000));

    return {
      totalHadir: shifts.filter((s) => s.status !== ShiftStatus.CANCELLED && s.status !== ShiftStatus.SCHEDULED).length,
      totalHariKerja: akhirHariBerjalan,
      items: shifts.map((s) => ({
        id: s.id,
        businessDate: s.businessDate,
        status: s.status,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        boothName: s.booth.name,
      })),
    };
  }

  /// "Laporan Kembali" — ringkasan stok (dari StockMovement ber-shiftSessionId
  /// ini) + kas Tunai/QRIS (dari Sale ber-shiftSessionId ini). Tidak ada
  /// snapshot stok-awal eksplisit saat Check-In, jadi stokAwal DITURUNKAN:
  /// qtyOnHand saat ini dikurangi net efek movement shift ini (restock masuk,
  /// terjual/retur keluar, adjustment bertanda) mengembalikan nilai sebelum
  /// shift dimulai.
  async getShiftReport(shiftSessionId: string, user: JwtPayload) {
    const shift = await this.loadOwnedShift(shiftSessionId, user);
    const [booth, shiftTemplate, movements, boothStocks, sales] = await Promise.all([
      this.prisma.booth.findUniqueOrThrow({ where: { id: shift.boothId } }),
      this.prisma.shiftTemplate.findUniqueOrThrow({ where: { id: shift.shiftTemplateId } }),
      this.prisma.stockMovement.findMany({ where: { shiftSessionId }, include: { product: true } }),
      this.prisma.boothStock.findMany({ where: { boothId: shift.boothId } }),
      this.prisma.sale.findMany({
        where: { shiftSessionId, status: 'PAID' },
        include: { payments: { where: { status: 'POSTED' } } },
      }),
    ]);

    const qtyOnHandByProduct = new Map(boothStocks.map((s) => [s.productId, s.qtyOnHand]));

    type Acc = { productName: string; restock: number; terjual: number; retur: number; adjustmentNet: number };
    const byProduct = new Map<string, Acc>();
    const acc = (productId: string, productName: string): Acc => {
      let entry = byProduct.get(productId);
      if (!entry) {
        entry = { productName, restock: 0, terjual: 0, retur: 0, adjustmentNet: 0 };
        byProduct.set(productId, entry);
      }
      return entry;
    };

    for (const m of movements) {
      const entry = acc(m.productId, m.product.name);
      const masuk = m.toBoothId === shift.boothId;
      switch (m.movementType) {
        case StockMovementType.RESTOCK:
        case StockMovementType.WAREHOUSE_TO_BOOTH:
          if (masuk) entry.restock += m.qty;
          break;
        case StockMovementType.SALE:
          entry.terjual += m.qty;
          break;
        case StockMovementType.RETURN_TO_WAREHOUSE:
          entry.retur += m.qty;
          break;
        case StockMovementType.ADJUSTMENT:
        case StockMovementType.VOID_REVERSAL:
          entry.adjustmentNet += masuk ? m.qty : -m.qty;
          break;
      }
    }

    const items = Array.from(byProduct.entries()).map(([productId, v]) => {
      const sisaSistem = qtyOnHandByProduct.get(productId) ?? 0;
      const stokAwal = sisaSistem - v.restock + v.terjual + v.retur - v.adjustmentNet;
      return {
        productId,
        productName: v.productName,
        stokAwal,
        restock: v.restock,
        terjual: v.terjual,
        retur: v.retur,
        sisaSistem,
      };
    });

    // Dihitung dari baris Payment (bukan Sale.paymentMethod langsung) —
    // sale Split py bisa punya DUA baris Payment (Tunai + QRIS) yang harus
    // masuk ke dua sisi breakdown, bukan cuma satu sisi seperti kalau
    // dibaca dari Sale.paymentMethod ("SPLIT") yang tidak masuk kategori
    // manapun.
    let kasTunai = 0;
    let kasQris = 0;
    for (const s of sales) {
      for (const p of s.payments) {
        if (p.method === 'CASH') kasTunai += Number(p.amount);
        else if (p.method === 'QRIS') kasQris += Number(p.amount);
      }
    }

    return {
      boothName: booth.name,
      shiftTemplateName: shiftTemplate.name,
      businessDate: shift.businessDate,
      items,
      totalPenjualan: kasTunai + kasQris,
      kasTunai,
      kasQris,
    };
  }

  /// TX-07 — Impact Preview untuk Shift Correction. Reassignment Booth
  /// hanya boleh jika shift belum punya transaksi terikat (sales/movement),
  /// karena seluruh ledger sudah terikat ke Booth tersebut.
  async previewShiftCorrection(shiftSessionId: string) {
    const shift = await this.prisma.shiftSession.findUnique({ where: { id: shiftSessionId } });
    if (!shift) {
      throw new DomainError('NOT_FOUND', 'Shift tidak ditemukan.');
    }
    const [salesCount, movementsCount] = await Promise.all([
      this.prisma.sale.count({ where: { shiftSessionId } }),
      this.prisma.stockMovement.count({ where: { shiftSessionId } }),
    ]);
    return {
      salesCount,
      movementsCount,
      hasDependentTransactions: salesCount > 0 || movementsCount > 0,
      current: { staffId: shift.staffId, boothId: shift.boothId, shiftTemplateId: shift.shiftTemplateId },
    };
  }

  /// TX-07 — Shift Correction (Admin-only). Salah Petugas/shift template
  /// boleh dikoreksi kapan saja (tidak mempengaruhi ledger stok). Salah
  /// Booth hanya boleh dikoreksi selama belum ada transaksi terikat
  /// (docs/24-data-consistency-correction-reversal.md §7 TX-07).
  async correctShift(shiftSessionId: string, dto: CorrectShiftDto, user: JwtPayload) {
    const existing = await this.corrections.findExistingByIdempotencyKey(dto.idempotencyKey);
    if (existing) {
      return this.prisma.shiftSession.findUnique({ where: { id: shiftSessionId }, include: { booth: true, shiftTemplate: true, staff: { select: SAFE_PROFILE_SELECT } } });
    }

    const shift = await this.prisma.shiftSession.findUnique({ where: { id: shiftSessionId } });
    if (!shift) {
      throw new DomainError('NOT_FOUND', 'Shift tidak ditemukan.');
    }
    this.corrections.validateReason(dto.reasonCode, dto.reasonNote);

    if (dto.boothId && dto.boothId !== shift.boothId) {
      const [salesCount, movementsCount] = await Promise.all([
        this.prisma.sale.count({ where: { shiftSessionId } }),
        this.prisma.stockMovement.count({ where: { shiftSessionId } }),
      ]);
      if (salesCount > 0 || movementsCount > 0) {
        throw new DomainError(
          'SHIFT_BOOTH_LOCKED',
          'Booth tidak dapat diubah karena shift ini sudah memiliki transaksi (sale/movement) yang terikat.',
          { salesCount, movementsCount },
        );
      }
    }

    const before = { staffId: shift.staffId, boothId: shift.boothId, shiftTemplateId: shift.shiftTemplateId };
    const after = {
      staffId: dto.staffId ?? shift.staffId,
      boothId: dto.boothId ?? shift.boothId,
      shiftTemplateId: dto.shiftTemplateId ?? shift.shiftTemplateId,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.shiftSession.update({ where: { id: shiftSessionId }, data: after });

      await this.corrections.record(tx, {
        entityType: 'shift_session',
        entityId: shiftSessionId,
        transactionGroupId: shiftSessionId,
        correctionType: 'REVISION',
        reasonCode: dto.reasonCode,
        reasonNote: dto.reasonNote,
        impactSnapshot: { before, after },
        createdById: user.sub,
        idempotencyKey: dto.idempotencyKey,
      });
    });

    return this.prisma.shiftSession.findUnique({
      where: { id: shiftSessionId },
      include: { booth: true, shiftTemplate: true, staff: { select: SAFE_PROFILE_SELECT } },
    });
  }

  private toClosingResponse(count: {
    id: string;
    shiftSessionId: string;
    status: StockCountStatus;
    confirmedAt: Date | null;
    items: {
      productId: string;
      product: { name: string };
      expectedQty: number;
      actualQty: number;
      discrepancyQty: number;
      reasonCode: string | null;
    }[];
  }) {
    return {
      id: count.id,
      shiftSessionId: count.shiftSessionId,
      status: count.status,
      confirmedAt: count.confirmedAt,
      items: count.items.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        expectedQty: item.expectedQty,
        actualQty: item.actualQty,
        discrepancyQty: item.discrepancyQty,
        reasonCode: item.reasonCode,
      })),
    };
  }
}
