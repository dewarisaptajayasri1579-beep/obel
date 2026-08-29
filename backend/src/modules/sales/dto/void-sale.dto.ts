import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ReasonCode } from '@prisma/client';

export class VoidSaleDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsEnum(ReasonCode)
  reasonCode!: ReasonCode;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}
