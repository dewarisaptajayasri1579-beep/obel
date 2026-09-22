import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { UpsertBoothShiftAssignmentDto } from './dto/upsert-booth-shift-assignment.dto';
import { BoothShiftAssignmentsService } from './booth-shift-assignments.service';

@Controller('booth-shift-assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BoothShiftAssignmentsController {
  constructor(private readonly boothShiftAssignmentsService: BoothShiftAssignmentsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findAll() {
    return this.boothShiftAssignmentsService.findAll();
  }

  @Get('mine')
  @Roles(UserRole.BOOTH_STAFF)
  findMine(@CurrentUser() user: JwtPayload) {
    return this.boothShiftAssignmentsService.findByStaffId(user.sub);
  }

  @Put()
  @Roles(UserRole.ADMIN)
  upsert(@Body() dto: UpsertBoothShiftAssignmentDto) {
    return this.boothShiftAssignmentsService.upsert(dto);
  }
}
