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
import { WarehouseStockService } from './warehouse-stock.service';

const PUSH_INTERVAL_MS = 5_000;

/// Push saldo Stok Gudang ke Admin Web tanpa client perlu polling — dipakai
/// label "Gudang: N" di samping Qty Kirim pada form Serah Terima Stok, biar
/// Admin lihat sisa Gudang ter-update kalau ada Tambah Stok Gudang lain
/// diposting sambil form ini masih terbuka. Pola SAMA PERSIS dengan
/// BoothAktifGateway (dashboard module): polling snapshot ~5 detik + broadcast,
/// bukan hook ke tiap service penulis WarehouseStock — jauh lebih kecil
/// risikonya daripada menyambungkan ke seluruh titik mutasi stok Gudang.
@WebSocketGateway({ namespace: '/warehouse-stock', cors: { origin: true } })
export class WarehouseStockGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(WarehouseStockGateway.name);
  private intervalId: NodeJS.Timeout | null = null;

  @WebSocketServer()
  server!: Namespace;

  constructor(
    private readonly warehouseStockService: WarehouseStockService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit() {
    this.intervalId = setInterval(() => this.broadcast(), PUSH_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  /// Sama seperti JwtAuthGuard + RolesGuard(ADMIN, OWNER) di
  /// WarehouseStockController — namespace WebSocket ini tidak boleh jadi
  /// celah auth yang terlewat dari guard REST biasa.
  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      if (payload.role !== UserRole.ADMIN && payload.role !== UserRole.OWNER) {
        client.disconnect(true);
        return;
      }
    } catch {
      client.disconnect(true);
      return;
    }

    this.warehouseStockService
      .findAll()
      .then((data) => client.emit('warehouse-stock:snapshot', data))
      .catch((err) => this.logger.error('Gagal mengirim snapshot awal Stok Gudang', err));
  }

  private async broadcast() {
    if (!this.server || this.server.sockets.size === 0) return;
    try {
      const data = await this.warehouseStockService.findAll();
      this.server.emit('warehouse-stock:snapshot', data);
    } catch (err) {
      this.logger.error('Gagal broadcast Stok Gudang', err);
    }
  }
}
