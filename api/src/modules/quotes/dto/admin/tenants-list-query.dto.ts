import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * TenantsListQueryDto
 *
 * Query parameters for listing tenants with quote activity
 * Supports filtering, searching, sorting, and pagination
 */
export class TenantsListQueryDto {
  @ApiProperty({
    enum: ['active', 'trial', 'suspended', 'all'],
    default: 'active',
    description: 'Filter by subscription status',
    required: false,
  })
  @IsOptional()
  @IsIn(['active', 'trial', 'suspended', 'all'])
  status?: 'active' | 'trial' | 'suspended' | 'all' = 'active';

  @ApiProperty({
    required: false,
    description: 'Search by company name or subdomain (case-insensitive)',
    example: 'acme',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    enum: ['quote_count', 'revenue', 'name'],
    default: 'quote_count',
    description: 'Sort tenants by field',
    required: false,
  })
  @IsOptional()
  @IsIn(['quote_count', 'revenue', 'name'])
  sort_by?: 'quote_count' | 'revenue' | 'name' = 'quote_count';

  @ApiProperty({
    default: 1,
    minimum: 1,
    description: 'Page number (1-based)',
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({
    default: 50,
    minimum: 1,
    maximum: 100,
    description: 'Results per page',
    required: false,
    example: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 50;
}
