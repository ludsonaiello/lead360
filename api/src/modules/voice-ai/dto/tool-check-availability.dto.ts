import { IsString, IsOptional, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ToolCheckAvailabilityDto {
  @ApiProperty({ description: 'Call log ID from /calls/start' })
  @IsString()
  @IsNotEmpty()
  call_log_id: string;

  @ApiPropertyOptional({ example: 'Plumbing' })
  @IsOptional()
  @IsString()
  service_type?: string;

  @ApiPropertyOptional({
    example: '2026-03-01',
    description: 'Preferred date ISO YYYY-MM-DD — slots generated from this date',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'preferred_date must be YYYY-MM-DD',
  })
  preferred_date?: string;
}
