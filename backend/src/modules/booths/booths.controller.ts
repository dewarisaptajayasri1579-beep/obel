import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateBoothDto } from './dto/create-booth.dto';
import { BoothsService } from './booths.service';

@Controller('booths')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BoothsController {
  constructor(private readonly boothsService: BoothsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findAll() {
    return this.boothsService.findAll();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateBoothDto) {
    return this.boothsService.create(dto);
  }
}
