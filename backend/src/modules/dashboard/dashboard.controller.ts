import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DashboardService } from './dashboard.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  getAdminDashboard() {
    return this.dashboardService.getAdminDashboard();
  }

  @Get('booth-aktif')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  getBoothAktif() {
    return this.dashboardService.getBoothAktif();
  }

  @Get('sales-report')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  getSalesReport(@Query('start') start?: string, @Query('end') end?: string) {
    if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
      throw new BadRequestException('Parameter start/end wajib format YYYY-MM-DD.');
    }
    return this.dashboardService.getSalesReport(start, end);
  }

  @Get('stock-neglect-report')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  getStockNeglectReport(@Query('start') start?: string, @Query('end') end?: string) {
    if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
      throw new BadRequestException('Parameter start/end wajib format YYYY-MM-DD.');
    }
    return this.dashboardService.getStockNeglectReport(start, end);
  }
}
