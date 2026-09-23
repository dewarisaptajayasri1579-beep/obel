import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UserRole } from '@prisma/client';
import { Namespace, Socket } from 'socket.io';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { DashboardService } from './dashboard.service';

const PUSH_INTERVAL_MS = 5_000;

/// Push kartu Booth Aktif ke Admin Web tanpa client perlu polling
/// (docs/obbel-coffee-ai-docs/26-monitoring-realtime.md §6.2 sudah
/// merencanakan WebSocket untuk kelas fitur ini). Beda dari desain penuh di
/// dok 26 (invalidate-and-refetch dipicu tiap mutasi Sale/StockMovement/
/// ShiftSession — butuh hook di 9+ service penulis StockMovement): gateway
/// ini menjalankan ulang query snapshot yang SAMA setiap ~5 detik dan
/// broadcast ke semua client tersambung. Latensi beberapa detik ini cukup
/// untuk dashboard monitoring, dan tidak menyentuh kode transaksi manapun —
/// jauh lebih kecil risikonya daripada menghubungkan ke tiap service mutasi.
@WebSocketGateway({ namespace: '/booth-aktif', cors: { origin: true } })
export class BoothAktifGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(BoothAktifGateway.name);
  private intervalId: NodeJS.Timeout | null = null;

  // Server injeksi Nest untuk gateway ber-namespace tipenya sebenarnya
  // Namespace (bukan root Server) — dipakai eksplisit di sini karena
  // Server.sockets bertipe Namespace juga (alias legacy default namespace),
  // sedangkan Namespace.sockets adalah Map client yang benar-benar kita mau.
  @WebSocketServer()
  server!: Namespace;

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit() {
    // Query stok/shift/sales cukup murah untuk interval 5 detik pada skala
    // Obbel sekarang, tapi tetap dilewati kalau tidak ada client tersambung
    // supaya tidak polling DB sia-sia saat halaman Booth Aktif tidak dibuka.
    this.intervalId = setInterval(() => this.broadcast(), PUSH_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  /// Sama seperti JwtAuthGuard + RolesGuard(ADMIN, OWNER) di
  /// DashboardController — namespace WebSocket ini tidak boleh jadi celah
  /// auth yang terlewat dari guard REST biasa.
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

    // Kirim snapshot langsung saat konek — client tidak perlu menunggu
    // interval broadcast pertama, dan ini juga yang menutup celah "event
    // lewat saat putus koneksi" (reconnect socket.io-client otomatis memicu
    // handleConnection lagi).
    this.dashboardService
      .getBoothAktif()
      .then((data) => client.emit('booth-aktif:snapshot', data))
      .catch((err) => this.logger.error('Gagal mengirim snapshot awal Booth Aktif', err));
  }

  handleDisconnect() {
    // Tidak ada state per-koneksi yang perlu dibersihkan — broadcast interval
    // cukup mengecek this.server.engine.clientsCount sebelum query.
  }

  private async broadcast() {
    // `this.server` di gateway ber-namespace adalah objek Namespace, bukan
    // Server root — clientsCount hidup di root.engine, tapi Namespace punya
    // `sockets` (Map client tersambung di namespace ini) yang lebih tepat di
    // sini karena kita cuma peduli client di namespace /booth-aktif.
    if (!this.server || this.server.sockets.size === 0) return;
    try {
      const data = await this.dashboardService.getBoothAktif();
      this.server.emit('booth-aktif:snapshot', data);
    } catch (err) {
      this.logger.error('Gagal broadcast Booth Aktif', err);
    }
  }
}
