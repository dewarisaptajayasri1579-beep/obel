import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BulkUpsertThresholdDto } from './dto/bulk-upsert-threshold.dto';
import { BoothStockThresholdsService } from './booth-stock-thresholds.service';

@Controller('booth-stock-thresholds')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BoothStockThresholdsController {
  constructor(private readonly thresholdsService: BoothStockThresholdsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  getForBooth(@Query('boothId') boothId: string) {
    return this.thresholdsService.getForBooth(boothId);
  }

  @Post('bulk')
  @Roles(UserRole.ADMIN)
  bulkUpsert(@Body() dto: BulkUpsertThresholdDto) {
    return this.thresholdsService.bulkUpsert(dto);
  }
}
