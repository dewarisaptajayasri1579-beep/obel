import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AttendancePermitType,
  AttendancePoint,
  Prisma,
  SaleStatus,
  ShiftStatus,
  StockCountStatus,
  StockMovementType,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { nomorMovementBerikutnya } from '../../common/doc-no';
import { SAFE_PROFILE_SELECT } from '../../common/safe-profile';
import { pastikanBaristaSudahKembali } from '../../common/shift-return-guard';
import {
  batasBulanJakarta,
  businessDateOf,
  combineJakartaDateAndTime,
  formatJamJakarta,
  startOfTodayJakarta,
} from '../../common/jakarta-date';
import { CorrectionsService } from '../corrections/corrections.service';
import { ReturnsService } from '../returns/returns.service';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { AttendancePermitsService } from '../attendance-permits/attendance-permits.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { AttendanceDto } from './dto/attendance.dto';
import { CheckInDto } from './dto/check-in.dto';
import { LocationPingDto } from './dto/location-ping.dto';
import { ConfirmClosingDto } from './dto/confirm-closing.dto';
import { ConfirmCashDepositDto } from './dto/confirm-cash-deposit.dto';
import { CorrectShiftDto } from './dto/correct-shift.dto';

const UNIQUE_VIOLATION = 'P2002';

const EARTH_RADIUS_METERS = 6_371_000;

const NAMA_TITIK: Record<AttendancePoint, string> = {
  DEPART: 'Berangkat',
  ARRIVE: 'Tiba',
  FINISH: 'Check-Out',
  RETURN: 'Kembali',
};

/// Jarak antara dua koordinat (haversine) untuk validasi radius absen (BR-042).
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
    private readonly returnsService: ReturnsService,
    private readonly appSettings: AppSettingsService,
    private readonly permits: AttendancePermitsService,
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

    // Absen ke-4 (Kembali di Gudang) shift sebelumnya tidak boleh dilewati (BR-042).
    const belumKembali = await this.prisma.shiftSession.findFirst({
      where: { staffId: user.sub, status: ShiftStatus.CLOSED, returnedAt: null },
      include: { booth: true },
    });
    if (belumKembali) {
      throw new DomainError(
        'PREVIOUS_SHIFT_NOT_RETURNED',
        `Absen Kembali di Gudang untuk shift sebelumnya (${belumKembali.booth.name}) belum dilakukan.`,
        { shiftSessionId: belumKembali.id },
      );
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
    const lokasi = await this.periksaLokasi(user.sub, AttendancePoint.DEPART, dto, await this.acuanGudang());

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
          cashFloat: booth.cashFloat,
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

    if (lokasi.permitId) await this.permits.pakai(this.prisma, lokasi.permitId, created.id);
    return this.toActiveShiftResponse(created, await this.reissueToken(user, boothId));
  }

  /// Absen Tiba di Booth (BR-042) — wajib sebelum Check-Out; Kasir tidak menunggu ini.
  /// Idempotent: kalau sudah tiba, kembalikan shift apa adanya.
  async arrive(user: JwtPayload, shiftSessionId: string, dto: AttendanceDto) {
    const shift = await this.prisma.shiftSession.findUnique({ where: { id: shiftSessionId }, include: { booth: true, shiftTemplate: true } });
    if (!shift || shift.staffId !== user.sub) {
      throw new DomainError('NOT_FOUND', 'Shift tidak ditemukan.');
    }
    if (shift.status !== ShiftStatus.OPEN) {
      throw new DomainError('SHIFT_NOT_OPEN', 'Absen Tiba hanya untuk shift yang sedang berjalan.');
    }
    if (shift.arrivedAt) return this.toActiveShiftResponse(shift);

    const lokasi = await this.periksaLokasi(user.sub, AttendancePoint.ARRIVE, dto, this.acuanBooth(shift.booth));
    const updated = await this.prisma.$transaction(async (tx) => {
      const hasil = await tx.shiftSession.update({
        where: { id: shiftSessionId },
        data: { arrivedAt: new Date(), arrivalLatitude: dto.latitude, arrivalLongitude: dto.longitude, arrivalPhotoUrl: dto.photoUrl },
        include: { booth: true, shiftTemplate: true },
      });
      if (lokasi.permitId) await this.permits.pakai(tx, lokasi.permitId, shiftSessionId);
      return hasil;
    });
    return this.toActiveShiftResponse(updated);
  }

  /// Absen Kembali di Gudang (BR-042) — setelah Check-Out; baru sesudahnya Admin
  /// boleh approve Stok Kembali & Setor Uang shift ini. Idempotent.
  async returnToWarehouse(user: JwtPayload, shiftSessionId: string, dto: AttendanceDto) {
    const shift = await this.prisma.shiftSession.findUnique({ where: { id: shiftSessionId } });
    if (!shift || shift.staffId !== user.sub) {
      throw new DomainError('NOT_FOUND', 'Shift tidak ditemukan.');
    }
    if (shift.status !== ShiftStatus.CLOSED) {
      throw new DomainError('SHIFT_NOT_CLOSED', 'Absen Kembali dilakukan setelah Check-Out di Booth.');
    }
    if (shift.returnedAt) return { shiftSessionId, returnedAt: shift.returnedAt };

    const lokasi = await this.periksaLokasi(user.sub, AttendancePoint.RETURN, dto, await this.acuanGudang());
    const returnedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.shiftSession.update({
        where: { id: shiftSessionId },
        data: { returnedAt, returnLatitude: dto.latitude, returnLongitude: dto.longitude, returnPhotoUrl: dto.photoUrl },
      });
      if (lokasi.permitId) await this.permits.pakai(tx, lokasi.permitId, shiftSessionId);
    });
    return { shiftSessionId, returnedAt };
  }

  /// Shift milik Barista yang sudah Check-Out tapi belum absen Kembali (paling
  /// banyak satu — Berangkat berikutnya ditolak selama masih ada). Null kalau tidak ada.
  async getMyPendingReturn(user: JwtPayload) {
    const shift = await this.prisma.shiftSession.findFirst({
      where: { staffId: user.sub, status: ShiftStatus.CLOSED, returnedAt: null },
      include: { booth: true, shiftTemplate: true, cashDeposit: true },
      orderBy: { closedAt: 'desc' },
    });
    if (!shift) return null;
    return {
      shiftSessionId: shift.id,
      booth: { id: shift.booth.id, code: shift.booth.code, name: shift.booth.name },
      shiftName: shift.shiftTemplate.name,
      closedAt: shift.closedAt,
      cashFloat: Number(shift.cashFloat),
      expectedCash: shift.cashDeposit ? Number(shift.cashDeposit.expectedAmount) : null,
    };
  }

  /// Ping lokasi berkala (apps/booth_pwa_flutter, action `gps.start`) — dua
  /// tulisan sekaligus dalam satu transaksi: (1) overwrite titik terakhir di
  /// ShiftSession (dipakai marker cepat di peta, tanpa perlu query histori),
  /// dan (2) insert baris baru ke ShiftLocationPing (append-only, dipakai
  /// gambar jalur perjalanan booth — lihat getShiftJourney). Bukan transaksi
  /// yang perlu correction/reversal (lihat komentar di schema.prisma).
  /// Ditolak kalau shift bukan milik staff ybs atau sudah CLOSED, supaya
  /// booth otomatis "hilang" dari peta realtime begitu checkout — sesuai
  /// requirement, native app juga sudah stop kirim ping duluan, ini validasi
  /// sisi server-nya.
  async recordLocationPing(user: JwtPayload, shiftId: string, dto: LocationPingDto) {
    const shift = await this.prisma.shiftSession.findUnique({ where: { id: shiftId } });
    if (!shift || shift.staffId !== user.sub) {
      throw new NotFoundException('Shift tidak ditemukan.');
    }
    if (shift.status !== ShiftStatus.OPEN && shift.status !== ShiftStatus.CLOSING) {
      throw new DomainError('SHIFT_NOT_ACTIVE', 'Shift ini sudah ditutup, ping lokasi tidak diterima.');
    }

    const capturedAt = dto.capturedAt ? new Date(dto.capturedAt) : new Date();
    await this.prisma.$transaction([
      this.prisma.shiftSession.update({
        where: { id: shiftId },
        data: {
          lastLocationLatitude: dto.latitude,
          lastLocationLongitude: dto.longitude,
          lastLocationAt: capturedAt,
        },
      }),
      this.prisma.shiftLocationPing.create({
        data: { shiftSessionId: shiftId, latitude: dto.latitude, longitude: dto.longitude, capturedAt },
      }),
    ]);
    return { ok: true, capturedAt };
  }

  /// Jalur perjalanan satu shift, dari Check-In sampai sekarang (atau sampai
  /// Check-Out kalau shift sudah CLOSED) — gabungan 2 sumber titik, diurut
  /// bersama secara kronologis:
  /// 1. Ping GPS berkala (ShiftLocationPing) — garis jalurnya.
  /// 2. Titik penjualan (Sale.latitude/longitude, sudah ada sejak fitur
  ///    Monitoring Real-Time — lihat docs 26 §5/§7) — supaya kelihatan DI
  ///    TITIK MANA booth itu jualan & berapa cup, bukan cuma rute geraknya.
  /// Dipakai peta Monitoring > Booth Aktif > Realtime saat Admin klik/pilih
  /// satu booth (garis timeline cuma muncul utk booth yang lagi disorot).
  async getShiftJourney(shiftId: string) {
    const shift = await this.prisma.shiftSession.findUnique({ where: { id: shiftId } });
    if (!shift) {
      throw new NotFoundException('Shift tidak ditemukan.');
    }

    const [pings, sales] = await Promise.all([
      this.prisma.shiftLocationPing.findMany({
        where: { shiftSessionId: shiftId },
        orderBy: { capturedAt: 'asc' },
      }),
      this.prisma.sale.findMany({
        where: { shiftSessionId: shiftId, status: SaleStatus.PAID, latitude: { not: null }, longitude: { not: null } },
        include: { items: true },
        orderBy: { paidAt: 'asc' },
      }),
    ]);

    return {
      shiftId,
      checkInAt: shift.openedAt,
      checkInLatitude: shift.checkInLatitude == null ? null : Number(shift.checkInLatitude),
      checkInLongitude: shift.checkInLongitude == null ? null : Number(shift.checkInLongitude),
      path: pings.map((p) => ({
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        capturedAt: p.capturedAt,
      })),
      sales: sales.map((s) => ({
        saleId: s.id,
        saleNo: s.saleNo,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        capturedAt: s.locationCapturedAt ?? s.paidAt ?? s.createdAt,
        qty: s.items.reduce((sum, i) => sum + i.qty, 0),
        total: Number(s.total),
      })),
    };
  }

  /// Validasi radius absen (BR-042): di luar `attendanceRadiusMeters` dari acuan →
  /// ditolak, kecuali Admin sudah memberi izin LOCATION untuk titik ini hari ini
  /// (izinnya dikembalikan supaya ditandai terpakai bersama absennya). Acuan yang
  /// belum diatur Admin (null) tidak memblokir — tampil "acuan kosong" di riwayat.
  private async periksaLokasi(
    staffId: string,
    point: AttendancePoint,
    posisi: { latitude: number; longitude: number },
    acuan: { nama: string; lat: number; lng: number } | null,
  ): Promise<{ permitId?: string }> {
    if (!acuan) return {};
    const { attendanceRadiusMeters: radius } = await this.appSettings.get();
    const jarak = Math.round(distanceMeters({ lat: posisi.latitude, lng: posisi.longitude }, acuan));
    if (jarak <= radius) return {};
    const izin = await this.permits.cariIzin(staffId, AttendancePermitType.LOCATION, point);
    if (izin) return { permitId: izin.id };
    throw new DomainError(
      'OUTSIDE_ATTENDANCE_RADIUS',
      `Lokasi Anda sekitar ${jarak} m dari ${acuan.nama} (maks ${radius} m). Absen ${NAMA_TITIK[point]} ditolak — kalau GPS meleset, minta izin Admin lalu ulangi.`,
      { distance: jarak, radius, point, place: acuan.nama },
    );
  }

  private async acuanGudang() {
    const s = await this.appSettings.get();
    return s.warehouseLatitude == null || s.warehouseLongitude == null
      ? null
      : { nama: 'Gudang', lat: Number(s.warehouseLatitude), lng: Number(s.warehouseLongitude) };
  }

  private acuanBooth(booth: { name: string; latitude: unknown; longitude: unknown }) {
    return booth.latitude == null || booth.longitude == null
      ? null
      : { nama: `Booth "${booth.name}"`, lat: Number(booth.latitude), lng: Number(booth.longitude) };
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
      arrivedAt: Date | null;
      cashFloat: bigint;
    },
    accessToken?: string,
  ) {
    return {
      shiftSessionId: shift.id,
      booth: { id: shift.booth.id, code: shift.booth.code, name: shift.booth.name },
      shiftName: shift.shiftTemplate.name,
      status: shift.status,
      scheduledStartAt: shift.scheduledStartAt,
      scheduledEndAt: shift.scheduledEndAt,
      openedAt: shift.openedAt,
      arrivedAt: shift.arrivedAt,
      cashFloat: Number(shift.cashFloat),
      ...(accessToken ? { accessToken } : {}),
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

  /// Draft (Sale PENDING) belum memotong stok dan hanya bisa dibayar/dihapus selama
  /// shift-nya terbuka; kalau shift ditutup, draft itu yatim selamanya. Ditolak di
  /// startClosing (layar Check-Out langsung memberi tahu) dan confirmClosing (draft
  /// bisa dibuat setelah layar dibuka).
  private async pastikanTidakAdaDraft(shiftSessionId: string) {
    const drafts = await this.prisma.sale.findMany({
      where: { shiftSessionId, status: SaleStatus.PENDING },
      select: { id: true, saleNo: true },
      orderBy: { createdAt: 'asc' },
    });
    if (drafts.length > 0) {
      throw new DomainError(
        'PENDING_DRAFTS_EXIST',
        `Masih ada ${drafts.length} draft transaksi (${drafts.map((d) => d.saleNo).join(', ')}). Bayar atau hapus dulu di Kasir sebelum Check-Out.`,
        { saleIds: drafts.map((d) => d.id), saleNos: drafts.map((d) => d.saleNo) },
      );
    }
  }

  /// Syarat absen Check-Out (BR-042): sudah absen Tiba, dan tidak sebelum
  /// `scheduledEndAt − toleransi` kecuali Admin memberi izin pulang awal hari ini.
  /// Mengembalikan izin itu supaya confirmClosing menandainya terpakai.
  private async pastikanBolehCheckOut(shift: { staffId: string; arrivedAt: Date | null; scheduledEndAt: Date }) {
    if (!shift.arrivedAt) {
      throw new DomainError('ARRIVAL_REQUIRED', 'Absen Tiba di Booth dulu sebelum Check-Out.');
    }
    const { earlyCheckoutToleranceMinutes } = await this.appSettings.get();
    const bolehMulai = new Date(shift.scheduledEndAt.getTime() - earlyCheckoutToleranceMinutes * 60_000);
    if (new Date() >= bolehMulai) return null;
    const izin = await this.permits.cariIzin(shift.staffId, AttendancePermitType.EARLY_CHECKOUT, null);
    if (izin) return izin;
    throw new DomainError(
      'EARLY_CHECKOUT',
      `Check-Out baru bisa mulai pukul ${formatJamJakarta(bolehMulai)}. Kalau harus pulang lebih awal, minta izin Admin.`,
      { allowedFrom: bolehMulai },
    );
  }

  /// Mirrors start_shift_closing (§09): snapshot current Booth stock jadi
  /// "expected". Shift TETAP OPEN (kasir masih boleh jualan) sampai
  /// confirmClosing sukses — status DRAFT di ShiftStockCount inilah yang
  /// menandai closing sedang berjalan, bukan ShiftSession.status.
  /// Snapshot DRAFT yang sudah ada diperbarui ke stok terkini (lihat di bawah).
  async startClosing(shiftSessionId: string, user: JwtPayload) {
    const shift = await this.loadOwnedShift(shiftSessionId, user);

    const existing = await this.prisma.shiftStockCount.findUnique({
      where: { shiftSessionId },
      include: { items: { include: { product: true } } },
    });
    if (existing && existing.status === StockCountStatus.CONFIRMED) {
      return this.toClosingResponse(existing);
    }

    if (shift.status !== ShiftStatus.OPEN) {
      throw new DomainError('SHIFT_NOT_OPEN', 'Shift harus berstatus OPEN untuk memulai closing.');
    }
    await this.pastikanBolehCheckOut(shift);
    await this.pastikanTidakAdaDraft(shiftSessionId);

    const boothStocks = await this.prisma.boothStock.findMany({
      where: { boothId: shift.boothId },
      include: { product: true },
    });

    // Layar Check-Out bisa memanggil ini dua kali hampir bersamaan (tap ganda, efek ganda React di dev):
    // dua pengisian ulang yang bertabrakan melanggar unique snapshot/item. Yang kalah cukup membaca
    // snapshot yang baru ditulis pemenangnya — isinya sama, diambil dari stok Booth saat itu juga.
    try {
      return await this.tulisSnapshotClosing(shiftSessionId, user, existing, boothStocks);
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;
      const terbaru = await this.prisma.shiftStockCount.findUniqueOrThrow({
        where: { shiftSessionId },
        include: { items: { include: { product: true } } },
      });
      return this.toClosingResponse(terbaru);
    }
  }

  private async tulisSnapshotClosing(
    shiftSessionId: string,
    user: JwtPayload,
    existing: { id: string } | null,
    boothStocks: { productId: string; qtyOnHand: number }[],
  ) {
    // Snapshot DRAFT dari buka-layar-Check-Out sebelumnya bisa sudah basi:
    // shift tetap OPEN sampai konfirmasi, jadi Petugas bisa balik, lanjut
    // jualan/terima stok, lalu buka layar lagi. Diisi ulang dari stok Booth
    // sekarang — aman, karena Stok Fisik yang diketik belum pernah disimpan
    // ke server sebelum konfirmasi.
    if (existing) {
      const segar = await this.prisma.$transaction(async (tx) => {
        await tx.shiftStockCountItem.deleteMany({ where: { stockCountId: existing.id } });
        await tx.shiftStockCountItem.createMany({
          data: boothStocks.map((b) => ({
            stockCountId: existing.id,
            productId: b.productId,
            expectedQty: b.qtyOnHand,
            actualQty: b.qtyOnHand,
          })),
        });
        return tx.shiftStockCount.findUniqueOrThrow({
          where: { id: existing.id },
          include: { items: { include: { product: true } } },
        });
      });
      return this.toClosingResponse(segar);
    }

    const count = await this.prisma.$transaction(async (tx) => {
      await tx.shiftSession.update({
        where: { id: shiftSessionId },
        data: { closingStartedAt: new Date() },
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
    if (shift.status !== ShiftStatus.OPEN) {
      throw new DomainError('SHIFT_NOT_OPEN', 'Shift harus berstatus OPEN untuk konfirmasi checkout.');
    }
    const izinPulangAwal = await this.pastikanBolehCheckOut(shift);
    await this.pastikanTidakAdaDraft(shiftSessionId);
    const lokasi = await this.periksaLokasi(
      shift.staffId,
      AttendancePoint.FINISH,
      { latitude: dto.checkOutLatitude, longitude: dto.checkOutLongitude },
      this.acuanBooth(booth),
    );

    // Stok Booth harus masih sama dengan snapshot yang Petugas lihat di layar
    // (mis. Admin mengirim stok atau ada penjualan setelah layar dibuka) —
    // kalau tidak, selisih yang dihitung dari angka basi akan salah tercatat.
    const stokSekarang = await this.prisma.boothStock.findMany({ where: { boothId: shift.boothId } });
    const qtySekarang = new Map(stokSekarang.map((b) => [b.productId, b.qtyOnHand]));
    const snapshot = new Map(count.items.map((i) => [i.productId, i.expectedQty]));
    const berubah = [
      ...count.items.filter((i) => (qtySekarang.get(i.productId) ?? 0) !== i.expectedQty).map((i) => i.productId),
      ...stokSekarang.filter((b) => !snapshot.has(b.productId) && b.qtyOnHand > 0).map((b) => b.productId),
    ];
    if (berubah.length > 0) {
      throw new DomainError(
        'STOCK_CHANGED_DURING_CLOSING',
        'Stok Booth berubah sejak layar Check-Out dibuka. Muat ulang layar ini lalu hitung ulang Stok Fisik.',
        { productIds: berubah },
      );
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

        // Selisih Stok Fisik vs Sisa Sistem SENGAJA TIDAK langsung
        // menyesuaikan BoothStock di sini — alasan Petugas (reasonCode/
        // reasonNote) cuma dicatat sebagai konteks, bukan keputusan final.
        // BoothStock (= qty sistem) tetap utuh sampai Return otomatis di
        // bawah mengajukannya ke Gudang dengan qty SISTEM (bukan qty fisik),
        // supaya selisihnya baru benar-benar diputuskan Admin (Rusak/Ganti
        // Rugi Petugas/Salah Hitung/Lainnya) saat approve Stok Kembali —
        // bukan diserap diam-diam oleh alasan sepihak Petugas saat Check-Out.
        await tx.shiftStockCountItem.update({
          where: { id: item.id },
          data: {
            actualQty,
            discrepancyQty,
            reasonCode: input?.reasonCode,
            reasonNote: input?.reasonNote,
          },
        });
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
      if (izinPulangAwal) await this.permits.pakai(tx, izinPulangAwal.id, shiftSessionId);
      if (lokasi.permitId) await this.permits.pakai(tx, lokasi.permitId, shiftSessionId);
    });

    // Sisa Stok SISTEM Booth (BoothStock belum disentuh oleh selisih Stok
    // Fisik, lihat komentar di atas) OTOMATIS diajukan sebagai Return ke
    // Gudang begitu Check-Out — qty yang diajukan = qty sistem, bukan qty
    // fisik, supaya selisihnya kelihatan & wajib Tindak Lanjut Admin saat
    // approve Stok Kembali (lihat ReturnsService.create dgn
    // shiftSessionIdOverride yang menandai asal-usulnya).
    const sisaStok = await this.prisma.boothStock.count({ where: { boothId: shift.boothId, qtyOnHand: { gt: 0 } } });
    if (sisaStok > 0) {
      await this.returnsService.create(
        { note: 'Otomatis diajukan saat Check-Out.' },
        shift.boothId,
        user.sub,
        shiftSessionId,
      );
    }

    // Setoran kas Tunai + uang jalan (modal kembalian, BR-043) — juga menunggu
    // approve Admin di Laporan Kembali, terpisah dari approve Stok Kembali (dua
    // keputusan independen).
    const salesForCash = await this.prisma.sale.findMany({
      where: { shiftSessionId, status: 'PAID' },
      include: { payments: { where: { status: 'POSTED', method: 'CASH' } } },
    });
    const kasTunai = salesForCash.reduce(
      (sum, s) => sum + s.payments.reduce((sub, p) => sub + Number(p.amount), 0),
      0,
    );
    await this.prisma.shiftCashDeposit.create({
      data: { shiftSessionId, expectedAmount: BigInt(kasTunai) + shift.cashFloat },
    });

    const final = await this.prisma.shiftStockCount.findUnique({
      where: { shiftSessionId },
      include: { items: { include: { product: true } } },
    });
    return this.toClosingResponse(final!);
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
    await pastikanBaristaSudahKembali(this.prisma, shiftSessionId);
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

    // Absen 4 titik (BR-042): jarak ke acuannya dihitung saat dibaca (acuan bisa
    // diubah Admin kapan saja, jadi tidak disimpan), plus izin yang dipakai.
    const gudang = await this.acuanGudang();
    const izinDipakai = await this.prisma.attendancePermit.findMany({
      where: { usedShiftSessionId: { in: shifts.map((s) => s.id) } },
      include: { grantedBy: { select: SAFE_PROFILE_SELECT } },
    });
    const titik = (
      point: AttendancePoint,
      shiftId: string,
      at: Date | null,
      lat: Prisma.Decimal | null,
      lng: Prisma.Decimal | null,
      photoUrl: string | null,
      acuan: { lat: number; lng: number } | null,
    ) => {
      const izin = izinDipakai.find((p) => p.usedShiftSessionId === shiftId && p.point === point);
      return {
        at,
        photoUrl,
        latitude: lat == null ? null : Number(lat),
        longitude: lng == null ? null : Number(lng),
        distanceMeters: lat == null || lng == null || !acuan ? null : Math.round(distanceMeters({ lat: Number(lat), lng: Number(lng) }, acuan)),
        acuanKosong: !acuan,
        izin: izin ? { reason: izin.reason, grantedBy: izin.grantedBy.fullName } : null,
      };
    };

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
      arrivedAt: s.arrivedAt,
      returnedAt: s.returnedAt,
      cashFloat: Number(s.cashFloat),
      absen: {
        berangkat: titik(AttendancePoint.DEPART, s.id, s.openedAt, s.checkInLatitude, s.checkInLongitude, s.checkInPhotoUrl, gudang),
        tiba: titik(AttendancePoint.ARRIVE, s.id, s.arrivedAt, s.arrivalLatitude, s.arrivalLongitude, s.arrivalPhotoUrl, this.acuanBooth(s.booth)),
        selesai: titik(AttendancePoint.FINISH, s.id, s.closedAt, s.checkOutLatitude, s.checkOutLongitude, s.checkOutPhotoUrl, this.acuanBooth(s.booth)),
        kembali: titik(AttendancePoint.RETURN, s.id, s.returnedAt, s.returnLatitude, s.returnLongitude, s.returnPhotoUrl, gudang),
      },
      izinPulangAwal: (() => {
        const izin = izinDipakai.find((p) => p.usedShiftSessionId === s.id && p.type === AttendancePermitType.EARLY_CHECKOUT);
        return izin ? { reason: izin.reason, grantedBy: izin.grantedBy.fullName } : null;
      })(),
      totalJualCup: cupByShiftId.get(s.id) ?? 0,
      adaSelisih: s.stockCount?.items.some((i) => i.discrepancyQty !== 0) ?? false,
      returStatus: s.stockReturns[0]?.status ?? null,
      setoranStatus: s.cashDeposit?.status ?? null,
    }));
  }

  /// Id sale yang sudah digantikan revisinya. Sale yang direvisi TIDAK berubah status (tetap PAID,
  /// atau VOIDED kalau dibatalkan lebih dulu); penandanya hanya revisionOfId di versi barunya
  /// (pola yang sama dengan SalesService.findAll), jadi versi lama harus dibuang dari daftar penjualan.
  private async saleYangDirevisi(saleIds: string[]): Promise<Set<string>> {
    const revisiBaru = await this.prisma.sale.findMany({
      where: { revisionOfId: { in: saleIds } },
      select: { revisionOfId: true },
    });
    return new Set(revisiBaru.map((r) => r.revisionOfId as string));
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
        this.prisma.stockMovement.findMany({
          // Shift CLOSED = keadaan saat ditutup: hanya movement sampai closedAt, titik waktu
          // yang sama dengan snapshot yang jadi Sisa Sistem. Movement ber-shift sesudahnya
          // (return otomatis, void/refund/revisi Admin) ada di ledger tapi tidak di Sisa;
          // kalau ikut dijumlahkan, Awal (residual) bergeser.
          where: { shiftSessionId, ...(shift.closedAt ? { occurredAt: { lte: shift.closedAt } } : {}) },
          include: { product: true },
        }),
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

    // Snapshot penutupan baru jadi sumber kebenaran SETELAH dikonfirmasi: saat itu
    // sisa Stok Fisik otomatis diajukan sebagai Return ke Gudang (lihat
    // confirmClosing) yang men-nol-kan BoothStock, jadi qtyOnHand live tidak lagi
    // merepresentasikan kondisi shift ini. Selama masih DRAFT, snapshot bisa basi
    // (Petugas membuka layar Check-Out lalu lanjut jualan/terima stok) — layar
    // Check-Out memanggil laporan ini BERSAMAAN dengan startClosing yang
    // memperbaruinya, jadi laporan selalu membaca snapshot sebelum diperbarui.
    // Akibatnya "Awal" (diturunkan dari Sisa Sistem) ikut bergeser sebesar
    // penjualan sejak snapshot terakhir. Maka selama DRAFT dipakai stok live.
    const snapshotFinal = stockCount?.status === StockCountStatus.CONFIRMED;

    // Koreksi Penerimaan Admin (TX-02) mengubah stok Booth lewat movement ADJUSTMENT
    // yang TIDAK ber-shiftSessionId (Admin bukan Petugas yang sedang shift), jadi
    // tidak ikut di `movements` di atas — tanpa ini selisihnya diserap diam-diam ke
    // "Awal" (residual) dan "Restock" tetap qty lama. Koreksi atas kiriman yang
    // diterima di shift ini ditambahkan ke Restock-nya; koreksi atas kiriman PERTAMA
    // (Stok Awal) sengaja tidak, karena Awal memang qty kiriman itu SETELAH koreksi.
    // Koreksi setelah shift ditutup tidak dihitung (snapshot sudah beku).
    const kirimanDiShift = [
      ...new Set(
        movements
          .filter((m) => m.movementType === StockMovementType.WAREHOUSE_TO_BOOTH && m.toBoothId === shift.boothId && m.referenceId)
          .map((m) => m.referenceId as string),
      ),
    ];
    if (kirimanDiShift.length > 0) {
      const koreksi = await this.prisma.stockMovement.findMany({
        where: {
          referenceType: 'distribution_receipt_correction',
          referenceId: { in: kirimanDiShift },
          occurredAt: { lte: shift.closedAt ?? new Date() },
        },
        include: { product: true },
      });
      for (const m of koreksi) {
        if (m.referenceId === referenceIdAwal) continue;
        acc(m.productId, m.product.name).restock += m.toBoothId === shift.boothId ? m.qty : -m.qty;
      }
    }

    const items = Array.from(byProduct.entries()).map(([productId, v]) => {
      const closingItem = snapshotFinal ? closingItemByProduct.get(productId) : undefined;
      const sisaSistem = closingItem?.expectedQty ?? qtyOnHandByProduct.get(productId) ?? 0;
      const stokAwal = sisaSistem - v.restock + v.terjual + v.retur - v.adjustmentNet;
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
    // Urut abjad nama produk — sebelumnya ikut urutan insersi Map (movement
    // pertama yang ditemui per produk), yang beda-beda tiap shift dan bikin
    // urutan baris di Rekap Stok Produk vs Stok Kembali tidak sinkron.
    items.sort((a, b) => a.productName.localeCompare(b.productName));

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

    // Kas di atas sudah benar tanpa penyaringan (Payment versi lama SUPERSEDED), tapi daftar
    // transaksinya tidak boleh memuat versi lama sale yang direvisi.
    const diganti = await this.saleYangDirevisi(sales.map((s) => s.id));
    const transaksi = sales.filter((s) => !diganti.has(s.id)).map((s) => {
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

    const koreksiRetur = stockReturn
      ? await this.corrections.deltaKoreksiPenerimaan('stock_return', [stockReturn.id])
      : new Map<string, number>();

    return {
      boothName: booth.name,
      shiftTemplateName: shiftTemplate.name,
      staffName: staff.fullName,
      status: shift.status,
      businessDate: shift.businessDate,
      arrivedAt: shift.arrivedAt,
      returnedAt: shift.returnedAt,
      /// Uang jalan (BR-043) — sudah termasuk di setoran.expectedAmount (kas Tunai + uang jalan).
      uangJalan: Number(shift.cashFloat),
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
            items: stockReturn.items
              .map((i) => {
                const closingItem = closingItemByProduct.get(i.productId);
                return {
                  productId: i.productId,
                  productName: i.product.name,
                  sellPrice: Number(i.product.sellPrice),
                  qtySubmitted: i.qtySubmitted,
                  // Angka SETELAH Koreksi Penerimaan (lihat CorrectionsService.deltaKoreksiPenerimaan).
                  qtyReceived:
                    i.qtyReceived === null
                      ? null
                      : i.qtyReceived + (koreksiRetur.get(`${stockReturn.id}:${i.productId}`) ?? 0),
                  // Stok Fisik yang dihitung Petugas saat Check-Out — dipakai
                  // FE sebagai saran awal "Stok Dikembalikan" (qtySubmitted
                  // di atas itu qty SISTEM, bukan qty fisik, lihat
                  // confirmClosing).
                  stokFisikPetugas: closingItem?.actualQty ?? null,
                  catatanPetugas: closingItem?.reasonNote ?? null,
                  discrepancyReasonCode: i.discrepancyReasonCode,
                  discrepancyNote: i.discrepancyNote,
                };
              })
              .sort((a, b) => a.productName.localeCompare(b.productName)),
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

  /// Ringkasan PENJUALAN satu shift untuk struk Check-Out — sengaja terpisah dari getShiftReport
  /// (berorientasi stok, 9 query). Versi lama sale yang direvisi (saleYangDirevisi) dibuang dari
  /// penjualan maupun pembatalan.
  /// Total per metode dari baris Payment, bukan Sale.paymentMethod, supaya sale Split masuk dua sisi.
  async getSalesSummary(shiftSessionId: string, user: JwtPayload) {
    const shift = await this.loadOwnedShift(shiftSessionId, user);
    const [booth, shiftTemplate, staff, sales] = await Promise.all([
      this.prisma.booth.findUniqueOrThrow({ where: { id: shift.boothId } }),
      this.prisma.shiftTemplate.findUniqueOrThrow({ where: { id: shift.shiftTemplateId } }),
      this.prisma.profile.findUniqueOrThrow({ where: { id: shift.staffId }, select: SAFE_PROFILE_SELECT }),
      this.prisma.sale.findMany({
        where: { shiftSessionId, status: { in: [SaleStatus.PAID, SaleStatus.VOIDED] } },
        include: {
          payments: { where: { status: 'POSTED' } },
          items: { include: { product: { include: { category: true } } } },
        },
      }),
    ]);

    const diganti = await this.saleYangDirevisi(sales.map((s) => s.id));
    const lunas = sales.filter((s) => s.status === SaleStatus.PAID && !diganti.has(s.id));
    const batal = sales.filter((s) => s.status === SaleStatus.VOIDED && !diganti.has(s.id));

    let subtotal = 0;
    let diskon = 0;
    let total = 0;
    let cup = 0;
    const metode = { CASH: { count: 0, amount: 0 }, QRIS: { count: 0, amount: 0 } };
    type Baris = { name: string; qty: number; amount: number };
    const kategori = new Map<string, { name: string; sortOrder: number; qty: number; amount: number; produk: Map<string, Baris> }>();

    for (const s of lunas) {
      subtotal += Number(s.subtotal);
      diskon += Number(s.discount);
      total += Number(s.total);
      for (const m of ['CASH', 'QRIS'] as const) {
        const dibayar = s.payments.filter((p) => p.method === m);
        if (dibayar.length === 0) continue;
        metode[m].count += 1;
        metode[m].amount += dibayar.reduce((n, p) => n + Number(p.amount), 0);
      }
      for (const it of s.items) {
        cup += it.qty;
        const kat = it.product.category;
        const kunci = kat?.id ?? '-';
        let k = kategori.get(kunci);
        if (!k) {
          k = { name: kat?.name ?? 'Lainnya', sortOrder: kat?.sortOrder ?? Number.MAX_SAFE_INTEGER, qty: 0, amount: 0, produk: new Map() };
          kategori.set(kunci, k);
        }
        k.qty += it.qty;
        k.amount += Number(it.lineTotal);
        const p = k.produk.get(it.productId) ?? { name: it.product.name, qty: 0, amount: 0 };
        p.qty += it.qty;
        p.amount += Number(it.lineTotal);
        k.produk.set(it.productId, p);
      }
    }

    const uangJalan = Number(shift.cashFloat);
    return {
      boothName: booth.name,
      shiftTemplateName: shiftTemplate.name,
      staffName: staff.fullName,
      businessDate: shift.businessDate,
      openedAt: shift.openedAt,
      transaksi: lunas.length,
      cup,
      subtotal,
      diskon,
      total,
      pembatalan: {
        count: batal.length,
        cup: batal.reduce((n, s) => n + s.items.reduce((m, it) => m + it.qty, 0), 0),
        amount: batal.reduce((n, s) => n + Number(s.total), 0),
      },
      tunai: metode.CASH,
      qris: metode.QRIS,
      uangJalan,
      setoranDiharapkan: metode.CASH.amount + uangJalan,
      kategori: [...kategori.values()]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map((k) => ({
          name: k.name,
          qty: k.qty,
          amount: k.amount,
          produk: [...k.produk.values()].sort((a, b) => a.name.localeCompare(b.name)),
        })),
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
