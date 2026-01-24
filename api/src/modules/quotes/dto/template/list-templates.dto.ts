import { IsBoolean, IsOptional, IsNumber, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListTemplatesDto {
  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  is_active?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Filter global templates only (admin use)' })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  is_global?: boolean;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716', description: 'Filter by tenant ID (admin use)' })
  @IsUUID()
  @IsOptional()
  tenant_id?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}
