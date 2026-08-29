import { Injectable } from '@nestjs/common';
import { RestockRequestStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { generateDocNo } from '../../common/doc-no';
import { DistributionsService } from '../distributions/distributions.service';
import { ApproveRestockRequestDto } from './dto/approve-restock-request.dto';
import { CreateRestockRequestDto } from './dto/create-restock-request.dto';
import { RejectRestockRequestDto } from './dto/reject-restock-request.dto';

@Injectable()
export class RestockRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly distributionsService: DistributionsService,
  ) {}

  findAll() {
    return this.prisma.restockRequest.findMany({
      include: {
        booth: true,
        items: { include: { product: true } },
        distribution: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findForBooth(boothId: string) {
    return this.prisma.restockRequest.findMany({
      where: { boothId },
      include: {
        booth: true,
        items: { include: { product: true } },
        distribution: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /// Booth Staff meminta restock — belum ada efek stok sampai Admin approve
  /// (BR-008/BR-009 di 08-business-rules.md).
  async create(dto: CreateRestockRequestDto, boothId: string, staffId: string) {
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    const productById = new Map(products.map((p) => [p.id, p]));
    for (const item of dto.items) {
      const product = productById.get(item.productId);
      if (!product || !product.active) {
        throw new DomainError('PRODUCT_INACTIVE', 'Salah satu produk tidak aktif atau tidak ditemukan.', {
          productId: item.productId,
        });
      }
    }

    return this.prisma.restockRequest.create({
      data: {
        requestNo: generateDocNo('RSTK'),
        boothId,
        requestedById: staffId,
        status: RestockRequestStatus.REQUESTED,
        note: dto.note,
        items: {
          createMany: { data: dto.items.map((i) => ({ productId: i.productId, qtyRequested: i.qty })) },
        },
      },
      include: { items: { include: { product: true } } },
    });
  }

  /// Approve = langsung kirim (menghasilkan StockDistribution) sesuai
  /// BR-009: qty approved tidak boleh melebihi warehouse available — dicek
  /// otomatis oleh DistributionsService.create via INSUFFICIENT_STOCK.
  async approve(id: string, dto: ApproveRestockRequestDto, actorId: string) {
    const request = await this.prisma.restockRequest.findUnique({ where: { id } });
    if (!request) {
      throw new DomainError('NOT_FOUND', 'Permintaan restock tidak ditemukan.');
    }
    if (request.status !== RestockRequestStatus.REQUESTED) {
      throw new DomainError('RESTOCK_NOT_PENDING', 'Permintaan ini sudah diproses sebelumnya.');
    }

    const distribution = await this.distributionsService.create(
      {
        idempotencyKey: randomUUID(),
        boothId: request.boothId,
        items: dto.items.map((i) => ({ productId: i.productId, qty: i.qtyApproved })),
        note: `Restock untuk ${request.requestNo}`,
      },
      actorId,
    );

    return this.prisma.restockRequest.update({
      where: { id },
      data: {
        status: RestockRequestStatus.APPROVED,
        approvedById: actorId,
        distributionId: distribution.id,
      },
      include: { items: { include: { product: true } }, distribution: true },
    });
  }

  async reject(id: string, dto: RejectRestockRequestDto, actorId: string) {
    const request = await this.prisma.restockRequest.findUnique({ where: { id } });
    if (!request) {
      throw new DomainError('NOT_FOUND', 'Permintaan restock tidak ditemukan.');
    }
    if (request.status !== RestockRequestStatus.REQUESTED) {
      throw new DomainError('RESTOCK_NOT_PENDING', 'Permintaan ini sudah diproses sebelumnya.');
    }

    return this.prisma.restockRequest.update({
      where: { id },
      data: { status: RestockRequestStatus.REJECTED, approvedById: actorId, rejectReason: dto.reason },
    });
  }
}
