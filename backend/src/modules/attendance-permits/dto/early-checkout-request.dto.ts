import { IsString, MinLength } from 'class-validator';

/// Alasan Barista mengajukan pulang cepat (B4), atau alasan Admin menolaknya.
export class EarlyCheckoutReasonDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
