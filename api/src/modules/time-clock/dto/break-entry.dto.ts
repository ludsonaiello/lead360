import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum BreakTypeEnum {
  PAID = 'paid',
  UNPAID = 'unpaid',
}

export class StartBreakDto {
  @ApiPropertyOptional({
    description:
      'Break type — paid breaks do not reduce total worked time, unpaid breaks are subtracted at clock-out',
    enum: BreakTypeEnum,
    default: BreakTypeEnum.UNPAID,
    example: BreakTypeEnum.UNPAID,
  })
  @IsOptional()
  @IsEnum(BreakTypeEnum)
  break_type?: BreakTypeEnum;

  @ApiPropertyOptional({
    description:
      'Human-readable label for this break (e.g. Lunch, Rest, Coffee). Informational only — not used in any calculations.',
    maxLength: 50,
    example: 'Lunch',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  break_label?: string;
}
