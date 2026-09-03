import { Injectable, NotFoundException } from '@nestjs/common';
import { ShiftStatus, StockCountStatus, StockMovementType, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { generateDocNo } from '../../common/doc-no';
import { CorrectionsService } from '../corrections/corrections.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ConfirmClosingDto } from './dto/confirm-closing.dto';
import { CorrectShiftDto } from './dto/correct-shift.dto';

function businessDateOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly corrections: CorrectionsService,
  ) {}

  /// Mirrors get_my_active_shift() from
  /// docs/obbel-coffee-ai-docs/09-api-rpc-contract.md.
  async getMyActiveShift(staffId: string) {
    const shift = await this.prisma.shiftSession.findFirst({
      where: {
        staffId,
        status: { in: [ShiftStatus.OPEN, ShiftStatus.CLOSING] },
      },
      include: { booth: true, shiftTemplate: true },
      orderBy: { scheduledStartAt: 'desc' },
    });

    if (!shift) {
      throw new NotFoundException('Belum ada shift aktif untuk user ini.');
    }

    return {
      shiftSessionId: shift.id,
      booth: { id: shift.booth.id, code: shift.booth.code, name: shift.booth.name },
      shiftName: shift.shiftTemplate.name,
      status: shift.status,
      scheduledStartAt: shift.scheduledStartAt,
      scheduledEndAt: shift.scheduledEndAt,
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
        data: { status: ShiftStatus.CLOSED, closedAt },
      });
    });

    const final = await this.prisma.shiftStockCount.findUnique({
      where: { shiftSessionId },
      include: { items: { include: { product: true } } },
    });
    return this.toClosingResponse(final!);
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
      return this.prisma.shiftSession.findUnique({ where: { id: shiftSessionId }, include: { booth: true, shiftTemplate: true, staff: true } });
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
      include: { booth: true, shiftTemplate: true, staff: true },
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
