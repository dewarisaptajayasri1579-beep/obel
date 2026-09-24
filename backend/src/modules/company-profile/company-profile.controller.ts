import {
  BadRequestException,
  Body,
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  ParseFilePipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StorageService } from '../../common/storage/storage.service';
import { CompanyProfileService } from './company-profile.service';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';

@Controller('company-profile')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompanyProfileController {
  constructor(
    private readonly companyProfile: CompanyProfileService,
    private readonly storage: StorageService,
  ) {}

  /// Dibaca semua role — identitas perusahaan dipajang di header layar
  /// (bukan cuma dokumen cetak), Owner & Petugas Booth juga perlu melihatnya.
  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.BOOTH_STAFF)
  get() {
    return this.companyProfile.get();
  }

  @Patch()
  @Roles(UserRole.ADMIN)
  update(@Body() dto: UpdateCompanyProfileDto) {
    return this.companyProfile.update(dto);
  }

  @Post('upload-logo')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        if (!/^image\/(jpeg|png)$/.test(file.mimetype)) {
          // Hanya JPEG/PNG — pdfkit & ExcelJS (dipakai di *-report.service.ts untuk
          // menaruh logo di kop dokumen cetak) tidak mendukung WEBP/GIF.
          callback(new BadRequestException('Logo harus berupa JPG atau PNG (dipakai di dokumen cetak, WEBP/GIF tidak didukung).'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadLogo(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png)$/, skipMagicNumbersValidation: true }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const { url } = await this.storage.upload('company', file.buffer, file.mimetype, extname(file.originalname).toLowerCase());
    return { logoUrl: url };
  }
}
