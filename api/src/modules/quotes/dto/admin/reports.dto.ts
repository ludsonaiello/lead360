import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsObject,
  IsISO8601,
  IsArray,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Report type enum
 */
export enum ReportType {
  QUOTE_SUMMARY = 'quote_summary',
  TENANT_PERFORMANCE = 'tenant_performance',
  REVENUE_ANALYSIS = 'revenue_analysis',
  CONVERSION_ANALYSIS = 'conversion_analysis',
}

/**
 * Export format enum
 */
export enum ExportFormat {
  CSV = 'csv',
  XLSX = 'xlsx',
  PDF = 'pdf',
}

/**
 * Report generation request DTO
 */
export class GenerateReportDto {
  @ApiProperty({
    description: 'Type of report to generate',
    enum: ReportType,
    example: ReportType.TENANT_PERFORMANCE,
  })
  @IsEnum(ReportType)
  report_type: ReportType;

  @ApiPropertyOptional({
    description: 'Start date (ISO 8601) - Can be provided at root level or inside parameters',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601) - Can be provided at root level or inside parameters',
    example: '2024-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsISO8601()
  date_to?: string;

  @ApiPropertyOptional({
    description: 'Report parameters (date range, filters, etc.) - Alternative to root-level date fields',
    example: {
      date_from: '2024-01-01T00:00:00.000Z',
      date_to: '2024-01-31T23:59:59.999Z',
      tenant_ids: ['550e8400-e29b-41d4-a716-446655440000'],
      group_by: 'vendor',
    },
  })
  @IsOptional()
  @IsObject()
  parameters?: {
    date_from?: string;
    date_to?: string;
    tenant_ids?: string[];
    group_by?: string;
  };

  @ApiProperty({
    description: 'Export format',
    enum: ExportFormat,
    example: ExportFormat.CSV,
  })
  @IsEnum(ExportFormat)
  format: ExportFormat;
}

/**
 * Report generation response DTO (job queued)
 */
export class GenerateReportResponseDto {
  @ApiProperty({
    description: 'Job ID for tracking report generation',
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
  })
  job_id: string;

  @ApiProperty({
    description: 'Job status',
    example: 'queued',
  })
  status: string;

  @ApiProperty({
    description: 'Estimated completion time (ISO 8601)',
    example: '2024-01-15T10:32:00.000Z',
  })
  estimated_completion: string;
}

/**
 * Report status DTO
 */
export class ReportStatusResponseDto {
  @ApiProperty({
    description: 'Job ID',
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
  })
  job_id: string;

  @ApiProperty({
    description: 'Job status',
    enum: ['queued', 'processing', 'completed', 'failed'],
    example: 'completed',
  })
  status: 'queued' | 'processing' | 'completed' | 'failed';

  @ApiPropertyOptional({
    description: 'Progress percentage (0-100)',
    example: 75,
  })
  progress?: number;

  @ApiPropertyOptional({
    description: 'Download URL (if completed)',
    example: '/admin/quotes/reports/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6/download',
  })
  download_url?: string;

  @ApiPropertyOptional({
    description: 'File expiry time (ISO 8601, if completed)',
    example: '2024-01-16T10:30:00.000Z',
  })
  expires_at?: string;

  @ApiPropertyOptional({
    description: 'Error message (if failed)',
    example: 'Database connection timeout',
  })
  error_message?: string;

  @ApiProperty({
    description: 'Report type',
    enum: ReportType,
    example: ReportType.TENANT_PERFORMANCE,
  })
  report_type: string;

  @ApiProperty({
    description: 'Export format',
    enum: ExportFormat,
    example: ExportFormat.CSV,
  })
  format: string;

  @ApiProperty({
    description: 'Created at (ISO 8601)',
    example: '2024-01-15T10:30:00.000Z',
  })
  created_at: string;

  @ApiPropertyOptional({
    description: 'Completed at (ISO 8601, if completed)',
    example: '2024-01-15T10:32:00.000Z',
  })
  completed_at?: string;

  @ApiPropertyOptional({
    description: 'Number of rows in report (if completed)',
    example: 150,
  })
  row_count?: number;
}

/**
 * Schedule enum for scheduled reports
 */
export enum ReportSchedule {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

/**
 * Create scheduled report DTO
 */
export class CreateScheduledReportDto {
  @ApiProperty({
    description: 'Friendly name for scheduled report',
    example: 'Weekly Revenue Report',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Type of report',
    enum: ReportType,
    example: ReportType.REVENUE_ANALYSIS,
  })
  @IsEnum(ReportType)
  report_type: ReportType;

  @ApiProperty({
    description: 'Schedule frequency',
    enum: ReportSchedule,
    example: ReportSchedule.WEEKLY,
  })
  @IsEnum(ReportSchedule)
  schedule: ReportSchedule;

  @ApiPropertyOptional({
    description: 'Report parameters (optional, defaults to last 30 days)',
    example: {
      date_from: 'relative:-7d',
      date_to: 'relative:now',
      group_by: 'vendor',
    },
  })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @ApiProperty({
    description: 'Export format',
    enum: ExportFormat,
    example: ExportFormat.XLSX,
  })
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @ApiProperty({
    description: 'Email recipients (for future use - not sent automatically)',
    example: ['admin@company.com', 'manager@company.com'],
  })
  @IsArray()
  @IsString({ each: true })
  recipients: string[];

  @ApiPropertyOptional({
    description: 'Whether report is active',
    example: true,
    default: true,
  })
  @IsOptional()
  is_active?: boolean;
}

/**
 * Update scheduled report DTO
 */
export class UpdateScheduledReportDto {
  @ApiPropertyOptional({
    description: 'Report name',
    example: 'Updated Report Name',
    minLength: 3,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Schedule frequency',
    enum: ReportSchedule,
    example: ReportSchedule.WEEKLY,
  })
  @IsOptional()
  @IsEnum(ReportSchedule)
  schedule?: ReportSchedule;

  @ApiPropertyOptional({
    description: 'Report parameters',
    example: {
      tenant_ids: ['tenant-uuid-3'],
      group_by: 'vendor',
    },
  })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Export format',
    enum: ExportFormat,
    example: ExportFormat.PDF,
  })
  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat;

  @ApiPropertyOptional({
    description: 'Recipient email addresses',
    example: ['admin@example.com', 'reports@example.com'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipients?: string[];

  @ApiPropertyOptional({
    description: 'Whether the scheduled report is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

/**
 * Scheduled report response DTO
 */
export class ScheduledReportResponseDto {
  @ApiProperty({
    description: 'Scheduled report ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Admin user ID',
    example: 'admin-uuid-here',
  })
  admin_user_id: string;

  @ApiProperty({
    description: 'Report name',
    example: 'Weekly Revenue Report',
  })
  name: string;

  @ApiProperty({
    description: 'Report type',
    enum: ReportType,
    example: ReportType.REVENUE_ANALYSIS,
  })
  report_type: string;

  @ApiProperty({
    description: 'Schedule frequency',
    enum: ReportSchedule,
    example: ReportSchedule.WEEKLY,
  })
  schedule: string;

  @ApiProperty({
    description: 'Report parameters',
  })
  parameters: Record<string, any>;

  @ApiProperty({
    description: 'Export format',
    example: 'xlsx',
  })
  format: string;

  @ApiProperty({
    description: 'Recipients',
    type: [String],
  })
  recipients: string[];

  @ApiProperty({
    description: 'Is active',
    example: true,
  })
  is_active: boolean;

  @ApiProperty({
    description: 'Next run time (ISO 8601)',
    example: '2024-01-22T00:00:00.000Z',
  })
  next_run_at: string;

  @ApiPropertyOptional({
    description: 'Last run time (ISO 8601)',
    example: '2024-01-15T00:00:00.000Z',
  })
  last_run_at?: string;

  @ApiProperty({
    description: 'Created at (ISO 8601)',
    example: '2024-01-01T10:00:00.000Z',
  })
  created_at: string;

  @ApiProperty({
    description: 'Updated at (ISO 8601)',
    example: '2024-01-15T14:30:00.000Z',
  })
  updated_at: string;

  @ApiProperty({
    description: 'Admin user who created the schedule',
    example: {
      id: 'admin-uuid',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
    },
  })
  admin_user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

/**
 * List of scheduled reports response DTO
 */
export class ScheduledReportsListResponseDto {
  @ApiProperty({
    description: 'List of scheduled reports',
    type: [ScheduledReportResponseDto],
  })
  reports: ScheduledReportResponseDto[];

  @ApiProperty({
    description: 'Total count',
    example: 5,
  })
  total: number;
}
