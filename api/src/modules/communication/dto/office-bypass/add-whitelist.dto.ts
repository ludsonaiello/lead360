import {
  IsString,
  Matches,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * E.164 Phone Number Format Regex
 *
 * Validates international phone numbers in E.164 format:
 * - Must start with '+'
 * - Followed by 1-15 digits
 * - No spaces, dashes, or parentheses
 *
 * Examples:
 * ✅ +12025551234 (US number)
 * ✅ +442071234567 (UK number)
 * ✅ +5511987654321 (Brazil number)
 * ❌ 2025551234 (missing +1)
 * ❌ +1 (202) 555-1234 (contains formatting)
 */
export const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

/**
 * AddWhitelistDto
 *
 * DTO for adding a phone number to the office bypass whitelist.
 *
 * Office Bypass Feature:
 * - Whitelisted numbers bypass IVR when calling in
 * - Caller is prompted to enter target number
 * - System initiates outbound call to target
 * - Useful for office staff making outbound calls using company number
 *
 * Security Considerations:
 * - Only Owner/Admin can add/remove whitelist entries
 * - Whitelisted numbers must be verified (belong to authorized staff)
 * - All bypass calls are recorded and audited
 * - Phone numbers must be in E.164 format for international support
 *
 * @example
 * {
 *   "phone_number": "+19781234567",
 *   "label": "John Doe - Sales Manager"
 * }
 */
export class AddWhitelistDto {
  @ApiProperty({
    description:
      'Phone number in E.164 format (+[country code][number], no spaces)',
    example: '+19781234567',
    pattern: E164_PHONE_REGEX.source,
  })
  @IsString()
  @IsNotEmpty({ message: 'Phone number cannot be empty' })
  @Matches(E164_PHONE_REGEX, {
    message:
      'Phone number must be in E.164 format (e.g., +12025551234). Start with + followed by country code and number, no spaces or formatting.',
  })
  phone_number: string;

  @ApiProperty({
    description:
      'Human-readable label identifying the owner of this phone number',
    example: "John Doe - Sales Manager's Mobile",
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'Label cannot be empty' })
  @MinLength(1, { message: 'Label must be at least 1 character' })
  @MaxLength(100, { message: 'Label must not exceed 100 characters' })
  label: string;
}

/**
 * UpdateWhitelistDto
 *
 * DTO for updating a whitelist entry.
 * All fields are optional - only provide the fields you want to update.
 */
export class UpdateWhitelistDto {
  @ApiProperty({
    description: 'Updated phone number in E.164 format',
    example: '+19787654321',
    pattern: E164_PHONE_REGEX.source,
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Phone number cannot be empty' })
  @Matches(E164_PHONE_REGEX, {
    message:
      'Phone number must be in E.164 format (e.g., +12025551234). Start with + followed by country code and number, no spaces or formatting.',
  })
  phone_number?: string;

  @ApiProperty({
    description: 'Updated label for this whitelist entry',
    example: "John Doe - VP of Sales's Mobile",
    minLength: 1,
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Label cannot be empty' })
  @MinLength(1, { message: 'Label must be at least 1 character' })
  @MaxLength(100, { message: 'Label must not exceed 100 characters' })
  label?: string;

  @ApiProperty({
    description: 'Updated status (active or inactive)',
    example: 'active',
    enum: ['active', 'inactive'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Status cannot be empty' })
  @IsIn(['active', 'inactive'], {
    message: 'Status must be either active or inactive',
  })
  status?: string;
}

/**
 * OfficeWhitelistResponseDto
 *
 * Response DTO for office whitelist entries.
 * Returned by GET endpoints.
 */
export class OfficeWhitelistResponseDto {
  @ApiProperty({
    description: 'Whitelist entry UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'Tenant UUID',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  })
  tenant_id: string;

  @ApiProperty({
    description: 'Whitelisted phone number (E.164 format)',
    example: '+19781234567',
  })
  phone_number: string;

  @ApiProperty({
    description: 'Label identifying this phone number',
    example: "John Doe - Sales Manager's Mobile",
  })
  label: string;

  @ApiProperty({
    description: 'Status of this whitelist entry',
    example: 'active',
    enum: ['active', 'inactive'],
  })
  status: string;

  @ApiProperty({
    description: 'Timestamp when this entry was created',
    example: '2026-01-15T10:30:00.000Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Timestamp when this entry was last updated',
    example: '2026-01-15T10:30:00.000Z',
  })
  updated_at: Date;
}
