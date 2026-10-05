import { UserRole } from '@prisma/client';
import type { UserAccess } from '../../common/access/access-rules';

export interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
  boothId: string | null;
}

/// `request.user` setelah JwtStrategy: isi token + role & hak akses TERBARU dari DB (BR-044).
export interface AuthUser extends JwtPayload {
  fullName: string;
  access: UserAccess;
}
