import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, IsNotEmpty } from 'class-validator';

/**
 * Register System Provider DTO
 *
 * Data required to register the system-level Twilio provider (Model B).
 *
 * @class RegisterSystemProviderDto
 */
export class RegisterSystemProviderDto {
  @ApiProperty({
    description: 'Twilio Account SID (starts with AC)',
    example: 'AC1234567890abcdef1234567890abcd',
    pattern: '^AC[a-z0-9]{32}$',
  })
  @IsString()
  @Matches(/^AC[a-z0-9]{32}$/, {
    message:
      'account_sid must be a valid Twilio Account SID (starts with AC, followed by 32 alphanumeric characters)',
  })
  account_sid: string;

  @ApiProperty({
    description: 'Twilio Auth Token',
    example: 'your_twilio_auth_token_here',
  })
  @IsString()
  @IsNotEmpty()
  auth_token: string;
}

/**
 * Update System Provider DTO
 *
 * Data required to update system-level Twilio credentials.
 *
 * @class UpdateSystemProviderDto
 */
export class UpdateSystemProviderDto extends RegisterSystemProviderDto {}

/**
 * Test Connectivity DTO
 *
 * Data required to test Twilio connectivity for a specific tenant.
 *
 * @class TestConnectivityDto
 */
export class TestConnectivityDto {
  @ApiProperty({
    description:
      'Tenant ID to test connectivity for (use "system" for system-level check)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  tenant_id: string;
}
