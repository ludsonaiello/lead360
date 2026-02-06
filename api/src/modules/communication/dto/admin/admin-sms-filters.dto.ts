import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, IsDateString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Admin SMS/WhatsApp Filters DTO
 *
 * Query parameters for filtering SMS/WhatsApp messages across all tenants.
 *
 * @class AdminSmsFiltersDto
 */
export class AdminSmsFiltersDto {
  @ApiProperty({
    required: false,
    description: 'Filter by tenant ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  tenant_id?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by message status',
    enum: ['pending', 'sent', 'delivered', 'failed', 'bounced'],
    example: 'delivered',
  })
  @IsOptional()
  @IsString()
  @IsIn(['pending', 'sent', 'delivered', 'failed', 'bounced'])
  status?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by direction',
    enum: ['inbound', 'outbound'],
    example: 'outbound',
  })
  @IsOptional()
  @IsString()
  @IsIn(['inbound', 'outbound'])
  direction?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by communication channel',
    enum: ['sms', 'whatsapp'],
    example: 'sms',
  })
  @IsOptional()
  @IsString()
  @IsIn(['sms', 'whatsapp'])
  channel?: 'sms' | 'whatsapp';

  @ApiProperty({
    required: false,
    description: 'Filter by start date (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by end date (ISO 8601)',
    example: '2026-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiProperty({
    default: 1,
    description: 'Page number',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({
    default: 20,
    description: 'Results per page',
    example: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;
}
