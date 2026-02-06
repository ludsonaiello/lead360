import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';

export class GeneratePdfDto {
  @ApiPropertyOptional({
    description: 'Whether to regenerate PDF even if one already exists',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  force_regenerate?: boolean;

  @ApiPropertyOptional({
    description:
      'Whether to include cost breakdown (vendor costs, profit margins) in PDF',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  include_cost_breakdown?: boolean;
}
