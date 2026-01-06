import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AuditLogQueryDto } from './audit-log-query.dto';

export class ExportAuditLogDto extends AuditLogQueryDto {
  @ApiPropertyOptional({
    description: 'Export format',
    example: 'csv',
    enum: ['csv', 'json'],
    default: 'csv',
  })
  @IsEnum(['csv', 'json'])
  @IsOptional()
  format?: string = 'csv';
}
