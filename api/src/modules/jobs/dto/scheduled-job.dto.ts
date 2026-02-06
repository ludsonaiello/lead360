import { IsString, IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateScheduledJobDto {
  @ApiProperty({
    example: 'my-custom-job',
    description: 'Unique job type identifier',
  })
  @IsString()
  job_type: string;

  @ApiProperty({
    example: 'Daily Report Generation',
    description: 'Human-readable job name',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: 'Generate daily sales reports for all tenants',
    description: 'Detailed description of what this job does',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: '0 8 * * *',
    description:
      'Cron expression (minute hour day month weekday). Example: "0 8 * * *" = Daily at 8:00 AM',
  })
  @IsString()
  schedule: string;

  @ApiPropertyOptional({
    example: 'America/New_York',
    description: 'Timezone for schedule execution',
    default: 'America/New_York',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    example: 3,
    minimum: 1,
    description: 'Maximum number of retry attempts on failure',
    default: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  max_retries?: number;

  @ApiPropertyOptional({
    example: 300,
    minimum: 60,
    description: 'Job timeout in seconds',
    default: 300,
  })
  @IsOptional()
  @IsInt()
  @Min(60)
  timeout_seconds?: number;
}

export class UpdateScheduledJobDto extends PartialType(CreateScheduledJobDto) {
  @ApiPropertyOptional({
    description: 'Enable or disable the scheduled job',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;
}

export class TriggerScheduledJobDto {
  // Empty DTO - schedule ID comes from path parameter
}
