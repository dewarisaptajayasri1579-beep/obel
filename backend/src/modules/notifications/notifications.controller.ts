import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getAll(@CurrentUser() user: JwtPayload) {
    if (user.role === UserRole.BOOTH_STAFF) {
      return user.boothId ? this.notificationsService.getForBooth(user.boothId) : [];
    }
    return this.notificationsService.getAll();
  }
}
