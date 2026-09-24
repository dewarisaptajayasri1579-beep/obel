import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ConfirmCashDepositDto {
  @IsInt()
  @Min(0)
  depositedAmount!: number;

  /// Wajib diisi kalau depositedAmount != expectedAmount (lihat
  /// ShiftsService.confirmCashDeposit).
  @IsOptional()
  @IsString()
  note?: string;
}
