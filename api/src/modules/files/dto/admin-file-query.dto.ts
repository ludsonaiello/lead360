import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Admin File Query DTO
 * Query parameters for admin file listing (bypasses tenant isolation)
 */
export class AdminFileQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter by tenant ID (optional - if not provided, returns all tenants)',
    example: 'tenant-123',
  })
  @IsOptional()
  @IsString()
  tenant_id?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page (max 100)',
    default: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ['active', 'deleted'],
    example: 'active',
  })
  @IsOptional()
  @IsEnum(['active', 'deleted'])
  status?: 'active' | 'deleted';

  @ApiPropertyOptional({
    description: 'Filter by MIME type',
    example: 'application/pdf',
  })
  @IsOptional()
  @IsString()
  mime_type?: string;

  @ApiPropertyOptional({
    description: 'Search filename (partial match)',
    example: 'invoice',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by file category',
    enum: [
      'quote',
      'invoice',
      'license',
      'insurance',
      'logo',
      'contract',
      'receipt',
      'photo',
      'report',
      'signature',
      'misc',
    ],
    example: 'invoice',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Filter by entity type (e.g., "invoice", "user", "quote")',
    example: 'invoice',
  })
  @IsOptional()
  @IsString()
  entity_type?: string;

  @ApiPropertyOptional({
    description: 'Filter by file type: "image", "document", or "other"',
    enum: ['image', 'document', 'other'],
    example: 'image',
  })
  @IsOptional()
  @IsString()
  file_type?: string;
}

/**
 * Admin Share Links Query DTO
 * Query parameters for listing share links across all tenants
 */
export class AdminShareLinksQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by tenant ID (optional)',
    example: 'tenant-123',
  })
  @IsOptional()
  @IsString()
  tenant_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status only',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active_only?: boolean = false;

  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page (max 100)',
    default: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}
