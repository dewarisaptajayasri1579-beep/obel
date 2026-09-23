import { IsOptional, IsString, MinLength } from 'class-validator';

/// Self-service (`PATCH /users/me`) — SENGAJA cuma `fullName`. `defaultBoothId`
/// dan `active` tetap domain Admin lewat `PATCH /users/:id` (UpdateUserDto),
/// staff tidak boleh mengubah booth default atau status aktif dirinya sendiri.
export class UpdateMyProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;
}
