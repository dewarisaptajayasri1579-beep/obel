import {
  Body,
  Controller,
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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateBoothDto } from './dto/create-booth.dto';
import { UpdateBoothDto } from './dto/update-booth.dto';
import { BoothsService } from './booths.service';
import { Menu, Lookup } from '../../common/access/menu-access.decorator';
import { imageFilePipe, imageUploadOptions, publicUploadUrl } from '../../common/image-upload';

@Controller('booths')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BoothsController {
  constructor(private readonly boothsService: BoothsService) {}

  @Get()
  @Lookup()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.BOOTH_STAFF)
  findAll() {
    return this.boothsService.findAll();
  }

  @Post()
  @Menu('BOOTH', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateBoothDto) {
    return this.boothsService.create(dto);
  }

  @Post('upload-qris')
  @Menu('BOOTH', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', imageUploadOptions('booths', 'Kode QRIS')))
  uploadQris(@UploadedFile(imageFilePipe()) file: Express.Multer.File, @Req() request: Request) {
    return { qrisImageUrl: publicUploadUrl(request, 'booths', file.filename) };
  }

  @Patch(':id')
  @Menu('BOOTH', AccessLevel.MANAGE)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateBoothDto) {
    return this.boothsService.update(id, dto);
  }
}
