import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole, AccessLevel } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DashboardService } from './dashboard.service';
import { Menu } from '../../common/access/menu-access.decorator';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin')
  @Menu('DASHBOARD', AccessLevel.VIEW)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  getAdminDashboard() {
    return this.dashboardService.getAdminDashboard();
  }

  @Get('booth-aktif')
  @Menu('BOOTH_AKTIF', AccessLevel.VIEW)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  getBoothAktif() {
    return this.dashboardService.getBoothAktif();
  }

  @Get('sales-report')
  @Menu('DASHBOARD', AccessLevel.VIEW)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  getSalesReport(@Query('start') start?: string, @Query('end') end?: string) {
    if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
      throw new BadRequestException('Parameter start/end wajib format YYYY-MM-DD.');
    }
    return this.dashboardService.getSalesReport(start, end);
  }

  @Get('stock-neglect-report')
  @Menu('DASHBOARD', AccessLevel.VIEW)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  getStockNeglectReport(@Query('start') start?: string, @Query('end') end?: string) {
    if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
      throw new BadRequestException('Parameter start/end wajib format YYYY-MM-DD.');
    }
    return this.dashboardService.getStockNeglectReport(start, end);
  }
}
