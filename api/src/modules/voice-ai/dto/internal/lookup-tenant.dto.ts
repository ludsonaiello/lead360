import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Request DTO for tenant lookup by phone number
 */
export class LookupTenantDto {
  @ApiProperty({
    description: 'Twilio phone number to look up (E.164 format)',
    example: '+19788787756',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+1\d{10}$/, {
    message: 'Phone number must be E.164 format (+1XXXXXXXXXX)',
  })
  phone_number: string;
}

/**
 * Response DTO for tenant lookup
 *
 * Returns tenant identification data needed by the agent.
 * Does NOT include sensitive data - agent will call /context for full details.
 */
export class LookupTenantResponseDto {
  @ApiProperty({ description: 'Whether a tenant was found for this number' })
  found: boolean;

  @ApiProperty({ description: 'Tenant UUID', required: false })
  tenant_id?: string;

  @ApiProperty({ description: 'Tenant business name', required: false })
  tenant_name?: string;

  @ApiProperty({
    description: 'The phone number that was looked up',
    required: false,
  })
  phone_number?: string;

  @ApiProperty({
    description: 'Error message if lookup failed',
    required: false,
  })
  error?: string;
}
