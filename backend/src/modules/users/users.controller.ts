import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser, JwtPayload } from '../auth/jwt-payload.interface';
import { AssignAccessRoleDto } from './dto/assign-access-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UsersService } from './users.service';
import { Lookup, AccessCheckedInService, OwnerOnly } from '../../common/access/menu-access.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Lookup()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  findAll() {
    return this.usersService.findAll();
  }

  /// Rute statis 'me' HARUS didaftarkan sebelum ':id' di bawah, kalau tidak
  /// Nest akan menangkap 'me' sebagai parameter :id.
  @Get('me')
  @Lookup()
  async findMe(@CurrentUser() user: AuthUser) {
    // `access` ikut dikirim supaya admin web memperbarui menu tanpa login ulang (BR-044).
    return { ...(await this.usersService.findMe(user.sub)), access: user.access };
  }

  @Patch('me')
  @Lookup()
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateMyProfileDto) {
    return this.usersService.updateMe(user.sub, dto);
  }

  @Post()
  @AccessCheckedInService()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.usersService.create(dto, user);
  }

  @Patch(':id')
  @AccessCheckedInService()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser) {
    return this.usersService.update(id, dto, user);
  }

  @Post(':id/reset-password')
  @AccessCheckedInService()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto, @CurrentUser() user: AuthUser) {
    return this.usersService.resetPassword(id, dto, user);
  }

  @Patch(':id/access-role')
  @OwnerOnly()
  @Roles(UserRole.OWNER)
  assignAccessRole(@Param('id') id: string, @Body() dto: AssignAccessRoleDto, @CurrentUser() user: AuthUser) {
    return this.usersService.assignAccessRole(id, dto, user);
  }
}
