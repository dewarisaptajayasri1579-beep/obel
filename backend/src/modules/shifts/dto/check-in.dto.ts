import { IsUUID } from 'class-validator';

export class CheckInDto {
  @IsUUID()
  idempotencyKey!: string;
}
