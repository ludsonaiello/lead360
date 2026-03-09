import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FindLeadToolDto {
  @ApiProperty({
    example: '+19788968047',
    description: 'Phone number in E.164 format',
  })
  @IsString()
  @IsNotEmpty()
  phone_number: string;
}

export class FindLeadToolResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  found: boolean;

  @ApiPropertyOptional()
  lead_id?: string;

  @ApiPropertyOptional()
  first_name?: string;

  @ApiPropertyOptional()
  last_name?: string;

  @ApiPropertyOptional()
  full_name?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  phone_number?: string;

  @ApiPropertyOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Primary address of the lead' })
  address?: {
    address_line1: string;
    address_line2: string | null;
    city: string;
    state: string;
    zip_code: string;
    country: string;
  };

  @ApiPropertyOptional()
  error?: string;
}
