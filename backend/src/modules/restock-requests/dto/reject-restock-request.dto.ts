import { IsString, MinLength } from 'class-validator';

export class RejectRestockRequestDto {
  @IsString()
  @MinLength(1)
  reason!: string;
}
