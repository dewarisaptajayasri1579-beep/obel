import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/jwt-payload.interface';
import { canSeeNotification, NotificationsService } from './notifications.service';
import { Lookup } from '../../common/access/menu-access.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Lookup()
  async getAll(@CurrentUser() user: AuthUser) {
    if (user.role === UserRole.BOOTH_STAFF) {
      return user.boothId ? this.notificationsService.getForBooth(user.boothId) : [];
    }
    // Admin hanya melihat notifikasi menu yang boleh ia buka (Owner: Lihat di semua menu).
    return (await this.notificationsService.getAll()).filter((n) => canSeeNotification(user.access, n.id));
  }
}
