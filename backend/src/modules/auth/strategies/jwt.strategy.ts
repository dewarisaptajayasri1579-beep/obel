import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AccessService } from '../../../common/access/access.service';
import { AuthUser, JwtPayload } from '../jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly accessService: AccessService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /// Role, status aktif & hak akses dibaca dari DB tiap request, bukan dari token, supaya
  /// nonaktif akun / perubahan peran berlaku langsung (BR-044). `boothId` tetap dari token
  /// (diterbitkan ulang saat Check-In, lihat ShiftsService.reissueToken).
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.accessService.resolve(payload.sub);
    if (!user) throw new UnauthorizedException('Sesi tidak berlaku. Silakan login ulang.');
    return { ...payload, role: user.role, fullName: user.fullName, access: user.access };
  }
}
