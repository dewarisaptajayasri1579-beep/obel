import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  getSummary() {
    return this.reportsService.getSummary();
  }

  @Get('export')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="laporan-obbel.csv"')
  exportCsv() {
    return this.reportsService.exportCsv();
  }
}
