import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateShiftTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
