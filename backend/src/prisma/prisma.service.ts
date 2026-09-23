import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/// Kode error Prisma saat koneksi pool ke Postgres eksternal (160.236.68.131)
/// ditutup diam-diam gara-gara idle terlalu lama (bukan salah query) — gejala
/// yang berulang kali muncul sebagai "backend putus" di BoothAktifGateway.
/// Query-nya sendiri valid, jadi cukup diulang SEKALI dengan koneksi baru
/// dari pool, bukan dianggap error permanen.
const KODE_KONEKSI_TERTUTUP = 'P1017';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
    this.$use(async (params, next) => {
      try {
        return await next(params);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === KODE_KONEKSI_TERTUTUP) {
          this.logger.warn(`Koneksi database basi, mengulang ${params.model ?? '?'}.${params.action} sekali.`);
          return next(params);
        }
        throw err;
      }
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
