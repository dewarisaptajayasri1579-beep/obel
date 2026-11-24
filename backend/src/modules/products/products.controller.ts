import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';
import { Menu, Lookup } from '../../common/access/menu-access.decorator';
import { imageFilePipe, imageUploadOptions, publicUploadUrl } from '../../common/image-upload';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Lookup()
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
  @Lookup()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findCategories() {
    return this.productsService.findCategories();
  }

  @Post('categories')
  @Menu('PRODUK', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  createCategory(@Body() dto: CreateProductCategoryDto) {
    return this.productsService.createCategory(dto);
  }

  @Patch('categories/:id')
  @Menu('PRODUK', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  updateCategory(@Param('id') id: string, @Body() dto: CreateProductCategoryDto, @CurrentUser() user: JwtPayload) {
    return this.productsService.updateCategory(id, dto, user.sub, user.username);
  }

  @Delete('categories/:id')
  @Menu('PRODUK', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  removeCategory(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.productsService.removeCategory(id, user.sub, user.username);
  }

  @Post()
  @Menu('PRODUK', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateProductDto, @CurrentUser() user: JwtPayload) {
    return this.productsService.create(dto, user.sub, user.username);
  }

  @Post('upload-image')
  @Menu('PRODUK', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', imageUploadOptions('products', 'Foto produk')))
  uploadImage(@UploadedFile(imageFilePipe()) file: Express.Multer.File, @Req() request: Request) {
    return { imageUrl: publicUploadUrl(request, 'products', file.filename) };
  }

  @Patch(':id')
  @Menu('PRODUK', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: JwtPayload) {
    return this.productsService.update(id, dto, user.sub, user.username);
  }

  /// Soft delete — lihat ProductsService.remove() untuk syarat penolakannya.
  @Delete(':id')
  @Menu('PRODUK', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.productsService.remove(id, user.sub, user.username);
  }
}
