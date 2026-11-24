import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { UserRole, AccessLevel } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CompanyProfileService } from './company-profile.service';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';
import { Menu, Lookup } from '../../common/access/menu-access.decorator';
import { imageFilePipe, imageUploadOptions, publicUploadUrl, TIPE_GAMBAR_CETAK } from '../../common/image-upload';

@Controller('company-profile')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompanyProfileController {
  constructor(private readonly companyProfile: CompanyProfileService) {}

  /// Dibaca semua role — identitas perusahaan dipajang di header layar
  /// (bukan cuma dokumen cetak), Owner & Petugas Booth juga perlu melihatnya.
  @Get()
  @Lookup()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.BOOTH_STAFF)
  get() {
    return this.companyProfile.get();
  }

  @Patch()
  @Menu('PROFIL_PERUSAHAAN', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  update(@Body() dto: UpdateCompanyProfileDto) {
    return this.companyProfile.update(dto);
  }

  @Post('upload-logo')
  @Menu('PROFIL_PERUSAHAAN', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', imageUploadOptions('company', 'Logo', TIPE_GAMBAR_CETAK)))
  uploadLogo(@UploadedFile(imageFilePipe(TIPE_GAMBAR_CETAK)) file: Express.Multer.File, @Req() request: Request) {
    return { logoUrl: publicUploadUrl(request, 'company', file.filename) };
  }
}
