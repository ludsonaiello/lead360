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
}
