import { ConflictException, Injectable } from '@nestjs/common';
import { Booth } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { CreateBoothDto } from './dto/create-booth.dto';
import { UpdateBoothDto } from './dto/update-booth.dto';

@Injectable()
export class BoothsService {
  constructor(private readonly prisma: PrismaService) {}

  /// `latitude`/`longitude` disimpan sebagai Prisma `Decimal` (presisi tetap
  /// untuk koordinat GPS), tapi client cukup pakai `number` biasa — dikonversi
  /// di sini, satu tempat, supaya findAll/create/update selalu konsisten.
  private toResponse(booth: Booth) {
    return {
      ...booth,
      latitude: booth.latitude === null ? null : Number(booth.latitude),
      longitude: booth.longitude === null ? null : Number(booth.longitude),
    };
  }

  async findAll() {
    const booths = await this.prisma.booth.findMany({ orderBy: { name: 'asc' } });
    return booths.map((b) => this.toResponse(b));
  }

  async create(dto: CreateBoothDto) {
    const existing = await this.prisma.booth.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Kode booth "${dto.code}" sudah dipakai.`);
    }
    const booth = await this.prisma.booth.create({
      data: {
        code: dto.code,
        name: dto.name,
        locationName: dto.locationName,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });
    return this.toResponse(booth);
  }

  async update(id: string, dto: UpdateBoothDto) {
    const existing = await this.prisma.booth.findUnique({ where: { id } });
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Booth tidak ditemukan.');
    }

    const booth = await this.prisma.booth.update({
      where: { id },
      data: {
        name: dto.name,
        locationName: dto.locationName,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        status: dto.status,
      },
    });
    return this.toResponse(booth);
  }
}
