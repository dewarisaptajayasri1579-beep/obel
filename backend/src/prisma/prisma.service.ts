import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/// Kode error Prisma saat koneksi pool ke Postgres eksternal (160.236.68.131)
/// ditutup diam-diam gara-gara idle terlalu lama (bukan salah query) — gejala
/// yang berulang kali muncul sebagai "backend putus" di BoothAktifGateway.
/// Query-nya sendiri valid, jadi cukup diulang SEKALI dengan koneksi baru
/// dari pool, bukan dianggap error permanen.
const KODE_KONEKSI_TERTUTUP = 'P1017';
/// Pool cuma 5 koneksi (lihat DATABASE_URL) dan dipakai bersamaan oleh
/// beberapa WebSocket gateway yang polling tiap beberapa detik (BoothAktif,
/// WarehouseStock, Notifications) + trafik HTTP biasa — gampang antre lalu
/// timeout menunggu koneksi bebas walau query & DB-nya sendiri sehat.
const KODE_POOL_TIMEOUT = 'P2024';
/// DB sempat tidak terjangkau sesaat (network blip) — bukan berarti query
/// salah, jadi diperlakukan sama seperti koneksi basi: retry sekali.
const KODE_DB_TIDAK_TERJANGKAU = 'P1001';
const KODE_BISA_DIRETRY = new Set([KODE_KONEKSI_TERTUTUP, KODE_POOL_TIMEOUT, KODE_DB_TIDAK_TERJANGKAU]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
    this.$use(async (params, next) => {
      try {
        return await next(params);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && KODE_BISA_DIRETRY.has(err.code)) {
          this.logger.warn(`Koneksi database bermasalah (${err.code}), mengulang ${params.model ?? '?'}.${params.action} sekali.`);
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
