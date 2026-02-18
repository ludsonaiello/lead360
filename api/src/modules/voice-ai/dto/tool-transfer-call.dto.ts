import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ToolTransferCallDto {
  @ApiProperty({ description: 'Call log ID from /calls/start' })
  @IsString()
  @IsNotEmpty()
  call_log_id: string;

  @ApiPropertyOptional({
    description:
      'Specific transfer number UUID to use. If omitted, the default transfer number for the tenant is used.',
  })
  @IsOptional()
  @IsString()
  transfer_number_id?: string;

  @ApiPropertyOptional({ description: 'Lead UUID if already collected via create_lead' })
  @IsOptional()
  @IsString()
  lead_id?: string;
}
