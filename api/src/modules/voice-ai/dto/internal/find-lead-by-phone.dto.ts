import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FindLeadByPhoneDto {
  @ApiProperty({ example: 'tenant-uuid', description: 'Tenant ID' })
  @IsString()
  @IsNotEmpty()
  tenant_id: string;

  @ApiProperty({ example: '+19788968047', description: 'Phone number in E.164 format' })
  @IsString()
  @IsNotEmpty()
  phone_number: string;
}

export class LeadInfo {
  @ApiProperty()
  id: string;

  @ApiProperty()
  first_name: string;

  @ApiProperty()
  last_name: string;

  @ApiProperty()
  full_name: string;

  @ApiPropertyOptional()
  email: string | null;

  @ApiProperty()
  phone_number: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  last_contact_date: Date | null;

  @ApiProperty()
  total_contacts: number;

  @ApiPropertyOptional()
  notes: string | null;
}

export class FindLeadByPhoneResponseDto {
  @ApiProperty()
  found: boolean;

  @ApiPropertyOptional({ type: LeadInfo })
  lead?: LeadInfo | null;
}
