import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
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

  @Put()
  @Roles(UserRole.ADMIN)
  upsert(@Body() dto: UpsertBoothShiftAssignmentDto) {
    return this.boothShiftAssignmentsService.upsert(dto);
  }
}
