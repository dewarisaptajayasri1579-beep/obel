import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AccessLevel, AppSettings, UserRole } from '@prisma/client';
import { pastikanAkses } from '../../common/access/access-denied';
import type { MenuKey } from '../../common/access/menus';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/jwt-payload.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AppSettingsService } from './app-settings.service';
import { UpdateAppSettingsDto } from './dto/update-app-settings.dto';
import { Lookup, AccessCheckedInService } from '../../common/access/menu-access.decorator';

/// Koordinat Gudang disimpan Decimal; client cukup number biasa.
function toResponse(s: AppSettings) {
  return {
    ...s,
    warehouseLatitude: s.warehouseLatitude === null ? null : Number(s.warehouseLatitude),
    warehouseLongitude: s.warehouseLongitude === null ? null : Number(s.warehouseLongitude),
  };
}

/// Menu pemilik tiap field (BR-044): interval GPS diatur dari Booth Aktif, sisanya dari Pengaturan Absensi.
const MENU_FIELD: Record<keyof UpdateAppSettingsDto, MenuKey> = {
  gpsPingIntervalSeconds: 'BOOTH_AKTIF',
  warehouseLatitude: 'ABSENSI',
  warehouseLongitude: 'ABSENSI',
  attendanceRadiusMeters: 'ABSENSI',
  earlyCheckoutToleranceMinutes: 'ABSENSI',
};

@Controller('app-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppSettingsController {
  constructor(private readonly appSettings: AppSettingsService) {}

  /// Dibaca semua role — booth_pwa_flutter (Petugas) perlu tahu interval ping
  /// GPS yang berlaku sebelum memulai foreground service lokasi.
  @Get()
  @Lookup()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.BOOTH_STAFF)
  get() {
    return this.appSettings.get().then(toResponse);
  }

  @Patch()
  @AccessCheckedInService()
  @Roles(UserRole.ADMIN)
  update(@Body() dto: UpdateAppSettingsDto, @CurrentUser() user: AuthUser) {
    const fields = Object.keys(dto) as (keyof UpdateAppSettingsDto)[];
    for (const menu of new Set(fields.map((f) => MENU_FIELD[f]))) pastikanAkses(user, [menu], AccessLevel.MANAGE);
    return this.appSettings.update(dto).then(toResponse);
  }
}
