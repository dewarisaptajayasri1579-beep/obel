import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBoothDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  locationName?: string;
}
