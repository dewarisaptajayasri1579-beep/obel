import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StorageService } from '../../common/storage/storage.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.BOOTH_STAFF)
  findAll() {
    return this.productsService.findAll();
  }

  /// Rute statis HARUS didaftarkan sebelum ':id' kalau ada nanti — belum
  /// ada ':id' di controller ini, tapi konsisten dgn pola modul lain.
  @Get('terlaris-mine')
  @Roles(UserRole.BOOTH_STAFF)
  terlarisMine(@CurrentUser() user: JwtPayload) {
    if (!user.boothId) {
      throw new BadRequestException('User belum memiliki assignment booth.');
    }
    return this.productsService.terlarisUntukBooth(user.boothId);
  }

  @Get('categories')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findCategories() {
    return this.productsService.findCategories();
  }

  @Post('categories')
  @Roles(UserRole.ADMIN)
  createCategory(@Body() dto: CreateProductCategoryDto) {
    return this.productsService.createCategory(dto);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateProductDto, @CurrentUser() user: JwtPayload) {
    return this.productsService.create(dto, user.sub, user.username);
  }

  @Post('upload-image')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
          callback(new BadRequestException('Foto produk harus berupa JPG, PNG, WEBP, atau GIF.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /^image\/(jpeg|png|webp|gif)$/,
            skipMagicNumbersValidation: true,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const { url } = await this.storage.upload('products', file.buffer, file.mimetype, extname(file.originalname).toLowerCase());
    return { imageUrl: url };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: JwtPayload) {
    return this.productsService.update(id, dto, user.sub, user.username);
  }

  /// Soft delete — lihat ProductsService.remove() untuk syarat penolakannya.
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.productsService.remove(id, user.sub, user.username);
  }
}
