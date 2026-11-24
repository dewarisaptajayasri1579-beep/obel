import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole, AccessLevel } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { GrantAttendancePermitDto } from './dto/grant-attendance-permit.dto';
import { EarlyCheckoutReasonDto } from './dto/early-checkout-request.dto';
import { AttendancePermitsService } from './attendance-permits.service';
import { Menu } from '../../common/access/menu-access.decorator';

@Controller('attendance-permits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendancePermitsController {
  constructor(private readonly permits: AttendancePermitsService) {}

  /// `date` = YYYY-MM-DD (Asia/Jakarta); kosong = hari ini.
  @Get()
  @Menu('CHECKIN_CHECKOUT', AccessLevel.VIEW)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  list(@Query('date') date?: string) {
    return this.permits.list(date ? new Date(`${date}T12:00:00+07:00`) : undefined);
  }

  @Post()
  @Menu('CHECKIN_CHECKOUT', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  grant(@Body() dto: GrantAttendancePermitDto, @CurrentUser() user: JwtPayload) {
    return this.permits.grant(dto, user);
  }

  /// Barista mengajukan pulang cepat (Check-Out sebelum jam selesai shift).
  @Post('early-checkout-request')
  @Roles(UserRole.BOOTH_STAFF)
  requestEarlyCheckout(@Body() dto: EarlyCheckoutReasonDto, @CurrentUser() user: JwtPayload) {
    return this.permits.requestEarlyCheckout(user, dto.reason);
  }

  /// Status pengajuan pulang cepat Barista hari ini (null kalau belum mengajukan).
  @Get('early-checkout-request/mine')
  @Roles(UserRole.BOOTH_STAFF)
  myEarlyCheckout(@CurrentUser() user: JwtPayload) {
    return this.permits.findMyEarlyCheckout(user);
  }

  @Post(':id/approve')
  @Menu('CHECKIN_CHECKOUT', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.permits.decideEarlyCheckout(id, true, user);
  }

  @Post(':id/reject')
  @Menu('CHECKIN_CHECKOUT', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  reject(@Param('id') id: string, @Body() dto: EarlyCheckoutReasonDto, @CurrentUser() user: JwtPayload) {
    return this.permits.decideEarlyCheckout(id, false, user, dto.reason);
  }
}
