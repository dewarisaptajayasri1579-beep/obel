import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateCompanyProfileDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  logoUrl?: string;
}
