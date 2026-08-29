import { Injectable } from '@nestjs/common';
import { ReconciliationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { generateDocNo } from '../../common/doc-no';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ResolveReconciliationCaseDto } from './dto/resolve-case.dto';

/// docs/24-data-consistency-correction-reversal.md §12 — Reconciliation
/// Engine. Case dibuat ketika correction TIDAK bisa diselesaikan otomatis
/// tanpa keputusan fisik/manual Admin (mis. chain dependency conflict).
@Injectable()
export class ReconciliationCasesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.reconciliationCase.findMany({
      include: { resolvedBy: true },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  countOpen() {
    return this.prisma.reconciliationCase.count({ where: { status: ReconciliationStatus.OPEN } });
  }

  /// Dipanggil oleh domain service lain saat correction tidak dapat
  /// direkonsiliasi otomatis (mis. INSUFFICIENT_STOCK di tengah correction
  /// chain) — dicatat untuk ditindaklanjuti Admin, bukan memaksa balance.
  create(input: {
    sourceEntityType: string;
    sourceEntityId: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    reasonCode: import('@prisma/client').ReasonCode;
    details: Record<string, unknown>;
  }) {
    return this.prisma.reconciliationCase.create({
      data: {
        caseNo: generateDocNo('RECON'),
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
        severity: input.severity,
        reasonCode: input.reasonCode,
        details: input.details as never,
      },
    });
  }

  async resolve(id: string, dto: ResolveReconciliationCaseDto, user: JwtPayload) {
    const record = await this.prisma.reconciliationCase.findUnique({ where: { id } });
    if (!record) {
      throw new DomainError('NOT_FOUND', 'Reconciliation case tidak ditemukan.');
    }
    if (record.status !== ReconciliationStatus.OPEN) {
      throw new DomainError('CASE_ALREADY_CLOSED', 'Case ini sudah ditutup.', { status: record.status });
    }

    return this.prisma.reconciliationCase.update({
      where: { id },
      data: {
        status: dto.status,
        resolutionNote: dto.resolutionNote,
        resolvedById: user.sub,
        resolvedAt: new Date(),
      },
    });
  }
}
