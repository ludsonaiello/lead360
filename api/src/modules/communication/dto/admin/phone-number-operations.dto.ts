import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsPhoneNumber,
  IsObject,
} from 'class-validator';

/**
 * Purchase Phone Number DTO
 *
 * Request body for purchasing a new Twilio phone number.
 *
 * @class PurchasePhoneNumberDto
 */
export class PurchasePhoneNumberDto {
  @ApiProperty({
    description: 'Phone number to purchase (E.164 format)',
    example: '+15555555555',
  })
  @IsString()
  @IsPhoneNumber(undefined, {
    message: 'Phone number must be in E.164 format (e.g., +15555555555)',
  })
  phone_number: string;

  @ApiProperty({
    required: false,
    description: 'Capabilities for the phone number',
    example: { voice: true, sms: true, mms: true },
  })
  @IsOptional()
  @IsObject()
  capabilities?: {
    voice?: boolean;
    sms?: boolean;
    mms?: boolean;
  };

  @ApiProperty({
    description: 'Tenant ID to allocate the phone number to',
    example: 'tenant-uuid-here',
  })
  @IsString()
  tenant_id: string;

  @ApiProperty({
    required: false,
    description: 'Purpose of the phone number allocation',
    example: 'SMS + Calls',
    enum: ['SMS Only', 'Calls Only', 'SMS + Calls', 'WhatsApp'],
  })
  @IsOptional()
  @IsEnum(['SMS Only', 'Calls Only', 'SMS + Calls', 'WhatsApp'])
  purpose?: string;
}

/**
 * Allocate Phone Number DTO
 *
 * Request body for allocating an existing phone number to a tenant.
 *
 * @class AllocatePhoneNumberDto
 */
export class AllocatePhoneNumberDto {
  @ApiProperty({
    description: 'Tenant ID to allocate the phone number to',
    example: 'tenant-uuid-here',
  })
  @IsString()
  tenant_id: string;

  @ApiProperty({
    required: false,
    description: 'Purpose of the phone number allocation',
    example: 'SMS + Calls',
    enum: ['SMS Only', 'Calls Only', 'SMS + Calls', 'WhatsApp'],
  })
  @IsOptional()
  @IsEnum(['SMS Only', 'Calls Only', 'SMS + Calls', 'WhatsApp'])
  purpose?: string;
}

/**
 * Deallocate Phone Number DTO
 *
 * Request body for deallocating a phone number from a tenant.
 *
 * @class DeallocatePhoneNumberDto
 */
export class DeallocatePhoneNumberDto {
  @ApiProperty({
    required: false,
    description:
      'Also delete tenant SMS/WhatsApp configuration using this number',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  delete_config?: boolean;

  @ApiProperty({
    required: false,
    description: 'Reason for deallocation (for audit log)',
    example: 'Tenant requested removal',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
