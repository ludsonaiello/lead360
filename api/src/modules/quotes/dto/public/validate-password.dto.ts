import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ValidatePasswordDto {
  @ApiProperty({
    description: 'Password to validate',
    example: 'SecurePass123',
  })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  password: string;
}

export class PasswordValidationResponseDto {
  @ApiProperty({
    description: 'Whether the password is valid',
    example: true,
  })
  valid: boolean;

  @ApiProperty({
    description: 'Message explaining the result',
    example: 'Password is correct',
  })
  message: string;

  @ApiProperty({
    description: 'Number of failed attempts (if invalid)',
    example: 1,
    required: false,
  })
  failed_attempts?: number;

  @ApiProperty({
    description:
      'Whether the account is locked due to too many failed attempts',
    example: false,
    required: false,
  })
  is_locked?: boolean;

  @ApiProperty({
    description: 'Time when the lockout expires (ISO 8601 format)',
    example: '2026-01-23T10:15:00Z',
    required: false,
  })
  lockout_expires_at?: string;
}
