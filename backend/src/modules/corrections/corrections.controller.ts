import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CorrectionsService } from './corrections.service';

@Controller('transaction-corrections')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class CorrectionsController {
  constructor(private readonly correctionsService: CorrectionsService) {}

  @Get()
  findAll() {
    return this.correctionsService.findAll();
  }
}
