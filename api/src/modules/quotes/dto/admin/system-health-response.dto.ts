import { ApiProperty } from '@nestjs/swagger';

export class ApiHealthDto {
  @ApiProperty({ example: 125.5, description: 'Average API response time in milliseconds' })
  avg_response_time_ms: number;

  @ApiProperty({ example: 0.02, description: 'Error rate (0-1 range)' })
  error_rate: number;

  @ApiProperty({ example: 1543, description: 'Number of API requests in the last hour' })
  requests_last_hour: number;
}

export class PdfGenerationDto {
  @ApiProperty({ example: 5, description: 'Number of pending PDF generation jobs' })
  queue_size: number;

  @ApiProperty({ example: 2350.25, description: 'Average PDF generation time in milliseconds' })
  avg_generation_time_ms: number;

  @ApiProperty({ example: 98.5, description: 'PDF generation success rate percentage' })
  success_rate: number;
}

export class EmailDeliveryDto {
  @ApiProperty({ example: 12, description: 'Number of pending emails in queue' })
  queue_size: number;

  @ApiProperty({ example: 99.2, description: 'Email delivery success rate percentage' })
  success_rate: number;

  @ApiProperty({ example: 3, description: 'Number of failed emails in last 24 hours' })
  failed_last_24h: number;
}

export class DatabaseHealthDto {
  @ApiProperty({ example: 'good', enum: ['excellent', 'good', 'fair', 'degraded', 'error'], description: 'Database query performance status' })
  query_performance: string;

  @ApiProperty({ example: 45.2, description: 'Database connection pool usage percentage' })
  connection_pool_usage: number;
}

export class SystemHealthResponseDto {
  @ApiProperty({ type: ApiHealthDto })
  api_health: ApiHealthDto;

  @ApiProperty({ type: PdfGenerationDto })
  pdf_generation: PdfGenerationDto;

  @ApiProperty({ type: EmailDeliveryDto })
  email_delivery: EmailDeliveryDto;

  @ApiProperty({ type: DatabaseHealthDto })
  database: DatabaseHealthDto;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z', description: 'Timestamp of health check' })
  timestamp: string;
}
