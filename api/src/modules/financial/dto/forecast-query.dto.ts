import { IsInt, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ForecastQueryDto {
  @ApiProperty({
    description: 'Forecast period in days. Must be exactly 30, 60, or 90',
    example: 30,
    enum: [30, 60, 90],
  })
  @IsInt()
  @IsIn([30, 60, 90])
  @Type(() => Number)
  days: number;
}
