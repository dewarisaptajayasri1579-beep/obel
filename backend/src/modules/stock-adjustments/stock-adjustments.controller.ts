import { Body, Controller, Get, Param, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole, AccessLevel } from '@prisma/client';
import type { Request } from 'express';
import { imageFilePipe, imageUploadOptions, publicUploadUrl } from '../../common/image-upload';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateStockAdjustmentDto, ReverseStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { STOCK_WRITE_OFF_SUBDIR, WriteOffStockDto } from './dto/write-off-stock.dto';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { Menu } from '../../common/access/menu-access.decorator';

@Controller('stock-adjustments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class StockAdjustmentsController {
  constructor(private readonly stockAdjustmentsService: StockAdjustmentsService) {}

  @Get()
  @Menu(['PEMUSNAHAN_STOK', 'TAMBAH_STOK_GUDANG'], AccessLevel.VIEW)
  findAll() {
    return this.stockAdjustmentsService.findAll();
  }

  @Post()
  @Menu('TAMBAH_STOK_GUDANG', AccessLevel.MANAGE)
  create(@Body() dto: CreateStockAdjustmentDto, @CurrentUser() user: JwtPayload) {
    return this.stockAdjustmentsService.create(dto, user);
  }

  /// Foto bukti Pemusnahan Stok — diunggah dulu, URL-nya lalu dikirim sebagai
  /// `photoUrl` di POST /stock-adjustments/write-off.
  @Post('write-off/photo')
  @Menu('PEMUSNAHAN_STOK', AccessLevel.MANAGE)
  @UseInterceptors(FileInterceptor('file', imageUploadOptions(STOCK_WRITE_OFF_SUBDIR, 'Foto bukti pemusnahan')))
  uploadWriteOffPhoto(@UploadedFile(imageFilePipe()) file: Express.Multer.File, @Req() request: Request) {
    return { photoUrl: publicUploadUrl(request, STOCK_WRITE_OFF_SUBDIR, file.filename) };
  }

  @Post('write-off')
  @Menu('PEMUSNAHAN_STOK', AccessLevel.MANAGE)
  writeOff(@Body() dto: WriteOffStockDto, @CurrentUser() user: JwtPayload) {
    return this.stockAdjustmentsService.writeOff(dto, user);
  }

  @Post(':id/reverse')
  @Menu(['PEMUSNAHAN_STOK', 'TAMBAH_STOK_GUDANG'], AccessLevel.MANAGE)
  reverse(@Param('id') id: string, @Body() dto: ReverseStockAdjustmentDto, @CurrentUser() user: JwtPayload) {
    return this.stockAdjustmentsService.reverse(id, dto, user);
  }
}
