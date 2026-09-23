import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UserRole } from '@prisma/client';
import { Namespace, Socket } from 'socket.io';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { NotificationsService } from './notifications.service';

const PUSH_INTERVAL_MS = 5_000;

/// Push notifikasi ke PWA Petugas tanpa perlu refresh — lonceng di Beranda
/// (app/petugas/page.tsx) & badge "BARU" di kartu Terima Stok sama-sama
/// dengar snapshot dari sini. Pola sama seperti BoothAktifGateway/
/// WarehouseStockGateway (polling ~5 detik, bukan hook ke tiap service
/// penulis Sale/StockMovement/ShiftSession), BEDANYA namespace ini
/// booth-scoped: tiap client cuma boleh dapat notifikasi booth-nya sendiri
/// (JWT `boothId`, terisi setelah Check-In — lihat ShiftsService.checkIn),
/// jadi broadcast-nya dikelompokkan per boothId, bukan disiarkan rata ke
/// semua yang tersambung seperti dua gateway Admin di atas.
@WebSocketGateway({ namespace: '/notifications', cors: { origin: true } })
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);
  private intervalId: NodeJS.Timeout | null = null;

  @WebSocketServer()
  server!: Namespace;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit() {
    this.intervalId = setInterval(() => this.broadcast(), PUSH_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  /// Sama seperti JwtAuthGuard di NotificationsController — namespace
  /// WebSocket ini tidak boleh jadi celah auth yang terlewat dari guard REST
  /// biasa. Hanya BOOTH_STAFF yang sudah Check-In (JWT punya boothId) yang
  /// boleh konek; boothId-nya disimpan di `client.data` untuk dipakai
  /// `broadcast()` mengelompokkan query per booth.
  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      if (payload.role !== UserRole.BOOTH_STAFF || !payload.boothId) {
        client.disconnect(true);
        return;
      }
      client.data.boothId = payload.boothId;
    } catch {
      client.disconnect(true);
      return;
    }

    this.notificationsService
      .getForBooth(client.data.boothId as string)
      .then((data) => client.emit('notifications:snapshot', data))
      .catch((err) => this.logger.error('Gagal mengirim snapshot awal notifikasi', err));
  }

  /// Satu query per Booth yang punya client tersambung (bukan satu query per
  /// client) — beberapa Petugas di Booth yang sama (jarang, tapi mungkin)
  /// tidak menggandakan beban DB.
  private async broadcast() {
    if (!this.server || this.server.sockets.size === 0) return;

    const socketsByBooth = new Map<string, Socket[]>();
    for (const socket of this.server.sockets.values()) {
      const boothId = socket.data.boothId as string | undefined;
      if (!boothId) continue;
      const list = socketsByBooth.get(boothId) ?? [];
      list.push(socket);
      socketsByBooth.set(boothId, list);
    }

    for (const [boothId, sockets] of socketsByBooth) {
      try {
        const data = await this.notificationsService.getForBooth(boothId);
        for (const socket of sockets) socket.emit('notifications:snapshot', data);
      } catch (err) {
        this.logger.error(`Gagal broadcast notifikasi Booth ${boothId}`, err);
      }
    }
  }
}
