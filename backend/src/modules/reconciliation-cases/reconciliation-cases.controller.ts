import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole, AccessLevel } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ResolveReconciliationCaseDto } from './dto/resolve-case.dto';
import { ReconciliationCasesService } from './reconciliation-cases.service';
import { Menu } from '../../common/access/menu-access.decorator';

@Controller('reconciliation-cases')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class ReconciliationCasesController {
  constructor(private readonly reconciliationCasesService: ReconciliationCasesService) {}

  @Get()
  @Menu('DASHBOARD', AccessLevel.VIEW)
  findAll() {
    return this.reconciliationCasesService.findAll();
  }

  @Post(':id/resolve')
  @Menu('DASHBOARD', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  resolve(@Param('id') id: string, @Body() dto: ResolveReconciliationCaseDto, @CurrentUser() user: JwtPayload) {
    return this.reconciliationCasesService.resolve(id, dto, user);
  }
}
