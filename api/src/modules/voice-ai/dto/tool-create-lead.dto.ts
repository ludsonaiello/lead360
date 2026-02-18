import {
  IsString,
  IsOptional,
  IsEmail,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ToolCreateLeadDto {
  @ApiProperty({ description: 'Call log ID from /calls/start' })
  @IsString()
  @IsNotEmpty()
  call_log_id: string;

  @ApiProperty({
    description: 'Caller phone number — E.164 (+15551234567) or 10 digits',
    example: '+15551234567',
  })
  @IsString()
  @IsNotEmpty()
  phone_number: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '123 Main St' })
  @IsOptional()
  @IsString()
  address_line1?: string;

  @ApiPropertyOptional({ example: 'Miami' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'FL', description: '2-letter state code' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'state must be a 2-letter code (e.g. FL)' })
  state?: string;

  @ApiPropertyOptional({ example: '33101' })
  @IsOptional()
  @IsString()
  zip_code?: string;

  @ApiPropertyOptional({ example: 'Needs AC repair urgently' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'HVAC' })
  @IsOptional()
  @IsString()
  service_type?: string;
}
