import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole, AccessLevel } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { GrantAttendancePermitDto } from './dto/grant-attendance-permit.dto';
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
}
