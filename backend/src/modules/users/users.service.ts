import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

const SELECT_SAFE_FIELDS = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  defaultBoothId: true,
  active: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.profile.findMany({
      select: SELECT_SAFE_FIELDS,
      orderBy: { fullName: 'asc' },
    });
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.profile.findUnique({ where: { username: dto.username } });
    if (existing) {
      throw new ConflictException(`Username "${dto.username}" sudah dipakai.`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.profile.create({
      data: {
        username: dto.username,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
        defaultBoothId: dto.defaultBoothId,
      },
      select: SELECT_SAFE_FIELDS,
    });
  }
}
