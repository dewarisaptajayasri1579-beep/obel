import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AppSettings, UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AppSettingsService } from './app-settings.service';
import { UpdateAppSettingsDto } from './dto/update-app-settings.dto';

/// Koordinat Gudang disimpan Decimal; client cukup number biasa.
function toResponse(s: AppSettings) {
  return {
    ...s,
    warehouseLatitude: s.warehouseLatitude === null ? null : Number(s.warehouseLatitude),
    warehouseLongitude: s.warehouseLongitude === null ? null : Number(s.warehouseLongitude),
  };
}

@Controller('app-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppSettingsController {
  constructor(private readonly appSettings: AppSettingsService) {}

  /// Dibaca semua role — booth_pwa_flutter (Petugas) perlu tahu interval ping
  /// GPS yang berlaku sebelum memulai foreground service lokasi.
  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.BOOTH_STAFF)
  get() {
    return this.appSettings.get().then(toResponse);
  }

  @Patch()
  @Roles(UserRole.ADMIN)
  update(@Body() dto: UpdateAppSettingsDto) {
    return this.appSettings.update(dto).then(toResponse);
  }
}
