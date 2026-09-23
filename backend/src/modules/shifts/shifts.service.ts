import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ShiftStatus, StockCountStatus, StockMovementType, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { nomorMovementBerikutnya } from '../../common/doc-no';
import { SAFE_PROFILE_SELECT } from '../../common/safe-profile';
import { startOfTodayJakarta, batasBulanJakarta } from '../../common/jakarta-date';
import { CorrectionsService } from '../corrections/corrections.service';
import { ReturnsService } from '../returns/returns.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CheckInDto } from './dto/check-in.dto';
import { ConfirmClosingDto } from './dto/confirm-closing.dto';
import { ConfirmCashDepositDto } from './dto/confirm-cash-deposit.dto';
import { CorrectShiftDto } from './dto/correct-shift.dto';

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

/// `businessDate` adalah instant UTC yang mewakili tengah malam Jakarta
/// (lihat `startOfTodayJakarta`); `time` adalah string "HH:mm" milik
/// ShiftTemplate. Fungsi ini menambahkan jam:menit itu ke businessDate.
function combineJakartaDateAndTime(businessDate: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(businessDate.getTime() + (hours * 60 + minutes) * 60 * 1000);
}

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly corrections: CorrectionsService,
    private readonly jwtService: JwtService,
    private readonly returnsService: ReturnsService,
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
      openedAt: s.openedAt,
    }));
  }

  /// Absen Berangkat — membuka ShiftSession (SCHEDULED tidak pernah dibuat
  /// duluan, jadi langsung create berstatus OPEN). Booth default diambil dari
  /// BoothShiftAssignment staff ybs (roster tetap Booth+Shift per staff),
  /// `dto.boothId` boleh override manual. Idempotent terhadap double-tap:
  /// kalau staff SUDAH aktif di Booth yang sama, kembalikan session yang
  /// sudah ada apa adanya alih-alih membuat baris baru (tidak ada unique
  /// constraint di schema yang mencegah dobel, jadi guard ini wajib di sini).
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

    const created = await this.prisma.shiftSession.create({
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
      openedAt: Date | null;
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
      openedAt: shift.openedAt,
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
              movementNo: await nomorMovementBerikutnya(tx, 'ADJ'),
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

    // Sisa Stok Fisik Booth (sudah disesuaikan ke actualQty di atas) OTOMATIS
    // diajukan sebagai Return ke Gudang begitu Check-Out — BR-013 "Return qty
    // default = actual stock setelah closing". Admin approve di Laporan
    // Kembali (bukan menu Return terpisah), lihat ReturnsService.create dgn
    // shiftSessionIdOverride yang menandai asal-usulnya.
    const sisaStok = await this.prisma.boothStock.count({ where: { boothId: shift.boothId, qtyOnHand: { gt: 0 } } });
    if (sisaStok > 0) {
      await this.returnsService.create(
        { note: 'Otomatis diajukan saat Check-Out.' },
        shift.boothId,
        user.sub,
        shiftSessionId,
      );
    }

    // Setoran kas Tunai — juga menunggu approve Admin di Laporan Kembali
    // terpisah dari approve Stok Kembali (dua keputusan independen).
    const salesForCash = await this.prisma.sale.findMany({
      where: { shiftSessionId, status: 'PAID' },
      include: { payments: { where: { status: 'POSTED', method: 'CASH' } } },
    });
    const kasTunai = salesForCash.reduce(
      (sum, s) => sum + s.payments.reduce((sub, p) => sub + Number(p.amount), 0),
      0,
    );
    await this.prisma.shiftCashDeposit.create({
      data: { shiftSessionId, expectedAmount: kasTunai },
    });

    const final = await this.prisma.shiftStockCount.findUnique({
      where: { shiftSessionId },
      include: { items: { include: { product: true } } },
    });
    const locationWarning = this.computeLocationWarning(dto.checkOutLatitude, dto.checkOutLongitude, booth);
    return { ...this.toClosingResponse(final!), ...(locationWarning ? { locationWarning } : {}) };
  }

  /// Admin approve setoran kas Tunai Petugas (Laporan Kembali) — terpisah
  /// dari approve Stok Kembali (ReturnsService.receive). Wajib catatan kalau
  /// jumlah disetor beda dari expectedAmount (kasTunai hasil hitung shift).
  async confirmCashDeposit(shiftSessionId: string, dto: ConfirmCashDepositDto, user: JwtPayload) {
    const deposit = await this.prisma.shiftCashDeposit.findUnique({ where: { shiftSessionId } });
    if (!deposit) {
      throw new DomainError('NOT_FOUND', 'Setoran kas untuk shift ini tidak ditemukan.');
    }
    if (deposit.status !== 'PENDING') {
      return deposit;
    }
    const hasDiscrepancy = dto.depositedAmount !== Number(deposit.expectedAmount);
    if (hasDiscrepancy && !dto.note?.trim()) {
      throw new DomainError(
        'DISCREPANCY_REASON_REQUIRED',
        'Catatan wajib diisi kalau jumlah Setor Uang berbeda dari yang seharusnya.',
      );
    }

    return this.prisma.shiftCashDeposit.update({
      where: { shiftSessionId },
      data: {
        status: hasDiscrepancy ? 'DISCREPANCY' : 'CONFIRMED',
        depositedAmount: dto.depositedAmount,
        note: dto.note?.trim() || null,
        confirmedById: user.sub,
        confirmedAt: new Date(),
      },
    });
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

  /// Riwayat Absen (Admin) — daftar ShiftSession SELURUH Booth/Petugas untuk
  /// menu Transaksi Booth → Check In-Check Out, termasuk foto selfie & total
  /// cup terjual (dari SaleItem ber-shiftSessionId ini, status PAID).
  async getAdminHistory() {
    const shifts = await this.prisma.shiftSession.findMany({
      include: {
        booth: true,
        staff: { select: SAFE_PROFILE_SELECT },
        stockCount: { include: { items: true } },
        stockReturns: { orderBy: { createdAt: 'desc' }, take: 1 },
        cashDeposit: true,
      },
      orderBy: { businessDate: 'desc' },
    });

    const sales = await this.prisma.sale.findMany({
      where: { status: 'PAID', shiftSessionId: { in: shifts.map((s) => s.id) } },
      select: { shiftSessionId: true, items: { select: { qty: true } } },
    });
    const cupByShiftId = new Map<string, number>();
    for (const s of sales) {
      const qty = s.items.reduce((sum, item) => sum + item.qty, 0);
      cupByShiftId.set(s.shiftSessionId, (cupByShiftId.get(s.shiftSessionId) ?? 0) + qty);
    }

    return shifts.map((s) => ({
      id: s.id,
      businessDate: s.businessDate,
      boothId: s.boothId,
      boothName: s.booth.name,
      staffId: s.staffId,
      staffName: s.staff.fullName,
      status: s.status,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      checkInPhotoUrl: s.checkInPhotoUrl,
      checkInLatitude: s.checkInLatitude ? Number(s.checkInLatitude) : null,
      checkInLongitude: s.checkInLongitude ? Number(s.checkInLongitude) : null,
      checkOutPhotoUrl: s.checkOutPhotoUrl,
      checkOutLatitude: s.checkOutLatitude ? Number(s.checkOutLatitude) : null,
      checkOutLongitude: s.checkOutLongitude ? Number(s.checkOutLongitude) : null,
      totalJualCup: cupByShiftId.get(s.id) ?? 0,
      adaSelisih: s.stockCount?.items.some((i) => i.discrepancyQty !== 0) ?? false,
      returStatus: s.stockReturns[0]?.status ?? null,
      setoranStatus: s.cashDeposit?.status ?? null,
    }));
  }

  /// "Laporan Kembali" — ringkasan stok (dari StockMovement ber-shiftSessionId
  /// ini) + kas Tunai/QRIS (dari Sale ber-shiftSessionId ini). Tidak ada
  /// snapshot stok-awal eksplisit saat Check-In, jadi stokAwal DITURUNKAN:
  /// qtyOnHand saat ini dikurangi net efek movement shift ini (restock masuk,
  /// terjual/retur keluar, adjustment bertanda) mengembalikan nilai sebelum
  /// shift dimulai.
  async getShiftReport(shiftSessionId: string, user: JwtPayload) {
    const shift = await this.loadOwnedShift(shiftSessionId, user);
    const [booth, shiftTemplate, staff, movements, boothStocks, sales, stockCount, stockReturn, cashDeposit] =
      await Promise.all([
        this.prisma.booth.findUniqueOrThrow({ where: { id: shift.boothId } }),
        this.prisma.shiftTemplate.findUniqueOrThrow({ where: { id: shift.shiftTemplateId } }),
        this.prisma.profile.findUniqueOrThrow({ where: { id: shift.staffId }, select: SAFE_PROFILE_SELECT }),
        this.prisma.stockMovement.findMany({ where: { shiftSessionId }, include: { product: true } }),
        this.prisma.boothStock.findMany({ where: { boothId: shift.boothId } }),
        this.prisma.sale.findMany({
          where: { shiftSessionId, status: 'PAID' },
          include: { payments: { where: { status: 'POSTED' } }, items: true },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.shiftStockCount.findUnique({ where: { shiftSessionId }, include: { items: true } }),
        this.prisma.stockReturn.findFirst({
          where: { shiftSessionId },
          include: { items: { include: { product: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.shiftCashDeposit.findUnique({ where: { shiftSessionId } }),
      ]);

    const qtyOnHandByProduct = new Map(boothStocks.map((s) => [s.productId, s.qtyOnHand]));
    const closingItemByProduct = new Map((stockCount?.items ?? []).map((i) => [i.productId, i]));
    const catatan = stockCount?.items.find((i) => i.reasonNote)?.reasonNote ?? null;

    // Kiriman PERTAMA yang diterima booth ini sejak shift dibuka jenisnya
    // "Stok Awal" (bukan "Restock") — sama definisi dengan computeJenisFor()
    // di stock-handovers.service.ts, dikenali dari referenceId (= distribution
    // id) movement WAREHOUSE_TO_BOOTH yang occurredAt-nya paling awal di
    // antara movement shift ini. Kiriman berikutnya (referenceId lain) baru
    // dihitung Restock.
    let referenceIdAwal: string | null = null;
    let waktuAwal: Date | null = null;
    for (const m of movements) {
      if (m.movementType !== StockMovementType.WAREHOUSE_TO_BOOTH || m.toBoothId !== shift.boothId) continue;
      if (!waktuAwal || m.occurredAt < waktuAwal) {
        waktuAwal = m.occurredAt;
        referenceIdAwal = m.referenceId;
      }
    }

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
          // Kiriman "Stok Awal" (referenceIdAwal) SENGAJA tidak ditambahkan ke
          // `restock` di sini — otomatis kehitung lewat residual `stokAwal`
          // di bawah (sisaSistem - restock + terjual + retur - adjustment),
          // gabung dengan carry-over stok lama kalau ada.
          if (masuk && m.referenceId !== referenceIdAwal) entry.restock += m.qty;
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
      const closingItem = closingItemByProduct.get(productId);
      return {
        productId,
        productName: v.productName,
        stokAwal,
        restock: v.restock,
        terjual: v.terjual,
        retur: v.retur,
        sisaSistem,
        stokFisik: closingItem?.actualQty ?? null,
        selisih: closingItem?.discrepancyQty ?? 0,
        reasonCode: closingItem?.reasonCode ?? null,
        reasonNote: closingItem?.reasonNote ?? null,
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

    const transaksi = sales.map((s) => {
      let tunai = 0;
      let qris = 0;
      for (const p of s.payments) {
        if (p.method === 'CASH') tunai += Number(p.amount);
        else if (p.method === 'QRIS') qris += Number(p.amount);
      }
      return {
        saleId: s.id,
        saleNo: s.saleNo,
        cupCount: s.items.reduce((sum, it) => sum + it.qty, 0),
        total: Number(s.total),
        tunai,
        qris,
      };
    });

    return {
      boothName: booth.name,
      shiftTemplateName: shiftTemplate.name,
      staffName: staff.fullName,
      status: shift.status,
      businessDate: shift.businessDate,
      items,
      transaksi,
      totalPenjualan: kasTunai + kasQris,
      kasTunai,
      kasQris,
      catatan,
      retur: stockReturn
        ? {
            id: stockReturn.id,
            returnNo: stockReturn.returnNo,
            status: stockReturn.status,
            note: stockReturn.note,
            receiveNote: stockReturn.receiveNote,
            submittedAt: stockReturn.submittedAt,
            receivedAt: stockReturn.receivedAt,
            items: stockReturn.items.map((i) => ({
              productId: i.productId,
              productName: i.product.name,
              qtySubmitted: i.qtySubmitted,
              qtyReceived: i.qtyReceived,
            })),
          }
        : null,
      setoran: cashDeposit
        ? {
            status: cashDeposit.status,
            expectedAmount: Number(cashDeposit.expectedAmount),
            depositedAmount: cashDeposit.depositedAmount != null ? Number(cashDeposit.depositedAmount) : null,
            note: cashDeposit.note,
            confirmedAt: cashDeposit.confirmedAt,
          }
        : null,
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
