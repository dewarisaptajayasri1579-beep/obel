import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateShiftTemplateDto } from './dto/create-shift-template.dto';
import { UpdateShiftTemplateDto } from './dto/update-shift-template.dto';
import { ShiftTemplatesService } from './shift-templates.service';

@Controller('shift-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftTemplatesController {
  constructor(private readonly shiftTemplatesService: ShiftTemplatesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findAll() {
    return this.shiftTemplatesService.findAll();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateShiftTemplateDto) {
    return this.shiftTemplatesService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateShiftTemplateDto) {
    return this.shiftTemplatesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.shiftTemplatesService.remove(id);
  }
}
