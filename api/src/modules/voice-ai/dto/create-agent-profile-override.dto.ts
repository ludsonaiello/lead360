import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsUUID,
  IsOptional,
  MaxLength,
} from 'class-validator';

/**
 * CreateAgentProfileOverrideDto
 *
 * DTO for creating a tenant override for a global voice agent profile.
 * Tenants select a global profile and optionally customize greeting/instructions.
 *
 * Required: agent_profile_id (global profile UUID)
 * Optional: custom_greeting, custom_instructions, is_active (default true)
 */
export class CreateAgentProfileOverrideDto {
  @ApiProperty({
    description:
      'Global voice agent profile UUID to override. ' +
      'Must be an active global profile created by system admin.',
    example: '00000000-0000-0000-0000-000000000001',
  })
  @IsUUID('4')
  agent_profile_id: string;

  @ApiPropertyOptional({
    description:
      'Optional custom greeting to override the global profile default. ' +
      'Use {business_name} placeholder. If not provided, uses global default.',
    nullable: true,
    maxLength: 65535, // TEXT column limit
    example: 'Welcome to our business! How can we assist you today?',
  })
  @IsOptional()
  @IsString()
  @MaxLength(65535)
  custom_greeting?: string;

  @ApiPropertyOptional({
    description:
      'Optional custom instructions to override the global profile default. ' +
      'If not provided, uses global default instructions.',
    nullable: true,
    example:
      'You are a friendly assistant for our plumbing business. ' +
      'Always mention our 24/7 emergency service availability.',
  })
  @IsOptional()
  @IsString()
  custom_instructions?: string;

  @ApiPropertyOptional({
    description:
      'Active status for this override. Default: true. ' +
      'Set to false to temporarily disable without deleting.',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
