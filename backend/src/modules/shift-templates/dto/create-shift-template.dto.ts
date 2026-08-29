import { IsString, Matches, MinLength } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateShiftTemplateDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'startTime harus format HH:mm' })
  startTime!: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'endTime harus format HH:mm' })
  endTime!: string;
}
