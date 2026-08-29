import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const profile = await this.prisma.profile.findUnique({ where: { username } });

    // Same error for unknown username vs wrong password so login can't be used
    // to enumerate valid usernames.
    if (!profile || !profile.active) {
      throw new UnauthorizedException('Username atau password salah.');
    }

    const passwordValid = await bcrypt.compare(password, profile.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Username atau password salah.');
    }

    const payload: JwtPayload = {
      sub: profile.id,
      username: profile.username,
      role: profile.role,
      boothId: profile.defaultBoothId,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      profile: {
        id: profile.id,
        username: profile.username,
        fullName: profile.fullName,
        role: profile.role,
        defaultBoothId: profile.defaultBoothId,
      },
    };
  }
}
