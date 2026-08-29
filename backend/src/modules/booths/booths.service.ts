import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBoothDto } from './dto/create-booth.dto';

@Injectable()
export class BoothsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.booth.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreateBoothDto) {
    const existing = await this.prisma.booth.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Kode booth "${dto.code}" sudah dipakai.`);
    }
    return this.prisma.booth.create({
      data: { code: dto.code, name: dto.name, locationName: dto.locationName },
    });
  }
}
