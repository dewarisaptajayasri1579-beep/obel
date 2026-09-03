import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ReasonCode } from '@prisma/client';

export class CorrectShiftDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsUUID()
  boothId?: string;

  @IsOptional()
  @IsUUID()
  shiftTemplateId?: string;

  @IsEnum(ReasonCode)
  reasonCode!: ReasonCode;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}
