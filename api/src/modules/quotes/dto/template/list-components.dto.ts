import { IsString, IsOptional, IsBoolean, IsArray, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListComponentsDto {
  @ApiPropertyOptional({ description: 'Filter by component type', example: 'header' })
  @IsString()
  @IsOptional()
  component_type?: string;

  @ApiPropertyOptional({ description: 'Filter by category', example: 'layout' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by tags', example: ['modern', 'professional'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Filter by global/tenant-specific', example: true })
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  is_global?: boolean;

  @ApiPropertyOptional({ description: 'Filter by tenant ID', example: 'uuid-here' })
  @IsString()
  @IsOptional()
  tenant_id?: string;

  @ApiPropertyOptional({ description: 'Filter by active status', example: true, default: true })
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Page number', example: 1, default: 1 })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', example: 50, default: 50 })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}
