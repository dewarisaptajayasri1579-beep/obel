import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateShiftTemplateDto } from './dto/create-shift-template.dto';

@Injectable()
export class ShiftTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.shiftTemplate.findMany({ orderBy: { startTime: 'asc' } });
  }

  create(dto: CreateShiftTemplateDto) {
    return this.prisma.shiftTemplate.create({
      data: { name: dto.name, startTime: dto.startTime, endTime: dto.endTime },
    });
  }
}
