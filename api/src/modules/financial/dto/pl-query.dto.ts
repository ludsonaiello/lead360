import { IsInt, Min, Max, IsOptional } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlQueryDto {
  @ApiProperty({
    description: 'Calendar year to report',
    example: 2026,
    minimum: 2020,
    maximum: 2100,
  })
  @IsInt()
  @Min(2020)
  @Max(2100)
  @Type(() => Number)
  year: number;

  @ApiPropertyOptional({
    description: 'Specific month (1-12). Omit for full year',
    example: 3,
    minimum: 1,
    maximum: 12,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month?: number;

  @ApiPropertyOptional({
    description: 'Include pending_review entries in total_with_pending',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  include_pending?: boolean = false;
}
