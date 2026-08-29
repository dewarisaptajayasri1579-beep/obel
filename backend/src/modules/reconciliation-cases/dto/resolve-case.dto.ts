import { IsIn, IsOptional, IsString } from 'class-validator';

export class ResolveReconciliationCaseDto {
  @IsIn(['RESOLVED', 'IGNORED'])
  status!: 'RESOLVED' | 'IGNORED';

  @IsOptional()
  @IsString()
  resolutionNote?: string;
}
