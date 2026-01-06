import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AuditLogQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    example: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 50,
    default: 50,
    minimum: 1,
    maximum: 200,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Filter by start date (ISO-8601 format)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  start_date?: string;

  @ApiPropertyOptional({
    description: 'Filter by end date (ISO-8601 format)',
    example: '2026-01-31T23:59:59.999Z',
  })
  @IsDateString()
  @IsOptional()
  end_date?: string;

  @ApiPropertyOptional({
    description: 'Filter by actor user ID',
    example: 'user-uuid-123',
  })
  @IsUUID()
  @IsOptional()
  actor_user_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by actor type',
    example: 'user',
    enum: ['user', 'system', 'platform_admin', 'cron_job'],
  })
  @IsEnum(['user', 'system', 'platform_admin', 'cron_job'])
  @IsOptional()
  actor_type?: string;

  @ApiPropertyOptional({
    description: 'Filter by action type',
    example: 'updated',
    enum: ['created', 'updated', 'deleted', 'accessed', 'failed'],
  })
  @IsEnum(['created', 'updated', 'deleted', 'accessed', 'failed'])
  @IsOptional()
  action_type?: string;

  @ApiPropertyOptional({
    description: 'Filter by entity type',
    example: 'tenant',
  })
  @IsString()
  @IsOptional()
  entity_type?: string;

  @ApiPropertyOptional({
    description: 'Filter by specific entity ID',
    example: 'entity-uuid-789',
  })
  @IsString()
  @IsOptional()
  entity_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    example: 'success',
    enum: ['success', 'failure'],
  })
  @IsEnum(['success', 'failure'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Search in description field',
    example: 'legal name',
  })
  @IsString()
  @IsOptional()
  search?: string;
}
