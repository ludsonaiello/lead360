import { IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by project status',
    enum: ['planned', 'in_progress', 'on_hold', 'completed', 'canceled'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by assigned project manager user ID',
  })
  @IsOptional()
  @IsUUID()
  assigned_pm_user_id?: string;

  @ApiPropertyOptional({
    description: 'Filter projects created on or after this date (ISO 8601)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'Filter projects created on or before this date (ISO 8601)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;
}

export class GanttQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by project status',
    enum: ['planned', 'in_progress', 'on_hold', 'completed', 'canceled'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by assigned project manager user ID',
  })
  @IsOptional()
  @IsUUID()
  assigned_pm_user_id?: string;

  @ApiPropertyOptional({
    description: 'Search by project name or number',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number (default: 1)',
    default: '1',
  })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({
    description: 'Items per page (default: 20, max: 100)',
    default: '20',
  })
  @IsOptional()
  @IsString()
  limit?: string;
}
