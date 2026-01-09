import { IsString, IsEnum, IsOptional, IsDateString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from './common.dto';

export class JobFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ['pending', 'processing', 'completed', 'failed'],
    description: 'Filter jobs by status',
    example: 'failed',
  })
  @IsOptional()
  @IsEnum(['pending', 'processing', 'completed', 'failed'])
  status?: string;

  @ApiPropertyOptional({
    example: 'send-email',
    description: 'Filter jobs by job type',
  })
  @IsOptional()
  @IsString()
  job_type?: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Filter jobs by tenant ID',
  })
  @IsOptional()
  @IsUUID()
  tenant_id?: string;

  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00Z',
    description: 'Filter jobs created after this date (ISO 8601 format)',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({
    example: '2026-01-31T23:59:59Z',
    description: 'Filter jobs created before this date (ISO 8601 format)',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;
}

export class RetryJobDto {
  // Empty DTO - job ID comes from path parameter
}
