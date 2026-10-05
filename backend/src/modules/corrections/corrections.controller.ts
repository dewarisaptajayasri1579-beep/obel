import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole, AccessLevel } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CorrectionsService } from './corrections.service';
import { Menu } from '../../common/access/menu-access.decorator';

@Controller('transaction-corrections')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class CorrectionsController {
  constructor(private readonly correctionsService: CorrectionsService) {}

  @Get()
  @Menu('DASHBOARD', AccessLevel.VIEW)
  findAll() {
    return this.correctionsService.findAll();
  }
}
