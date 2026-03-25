import { IsInt, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PreviewRecurringRulesDto {
  @ApiProperty({
    description: 'Preview period in days (30, 60, or 90)',
    example: 30,
  })
  @IsInt()
  @IsIn([30, 60, 90])
  @Type(() => Number)
  days: number;
}
