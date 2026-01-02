import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({ description: 'User ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'User email', example: 'john@example.com' })
  email: string;

  @ApiProperty({ description: 'User first name', example: 'John' })
  first_name: string;

  @ApiProperty({ description: 'User last name', example: 'Doe' })
  last_name: string;

  @ApiPropertyOptional({
    description: 'User phone number',
    example: '+15551234567',
  })
  phone?: string;

  @ApiPropertyOptional({ description: 'Tenant ID', example: 'uuid' })
  tenant_id?: string;

  @ApiProperty({
    description: 'User roles',
    example: ['Owner'],
    type: [String],
  })
  roles: string[];

  @ApiProperty({
    description: 'Is platform admin',
    example: false,
  })
  is_platform_admin: boolean;

  @ApiProperty({
    description: 'Email verified status',
    example: true,
  })
  email_verified: boolean;

  @ApiPropertyOptional({
    description: 'Last login timestamp',
    example: '2025-01-01T12:00:00Z',
  })
  last_login_at?: string;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2024-01-01T08:00:00Z',
  })
  created_at: string;
}

export class PartialUserDto {
  @ApiProperty({ description: 'User ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'User email', example: 'john@example.com' })
  email: string;

  @ApiProperty({ description: 'User first name', example: 'John' })
  first_name: string;

  @ApiProperty({ description: 'User last name', example: 'Doe' })
  last_name: string;

  @ApiProperty({ description: 'Is active', example: false })
  is_active: boolean;

  @ApiProperty({ description: 'Email verified', example: false })
  email_verified: boolean;
}

export class TenantDto {
  @ApiProperty({ description: 'Tenant ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Tenant subdomain', example: 'acme-roofing' })
  subdomain: string;

  @ApiProperty({
    description: 'Company name',
    example: 'Acme Roofing LLC',
  })
  company_name: string;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token: string;

  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refresh_token: string;

  @ApiProperty({
    description: 'Token type',
    example: 'Bearer',
  })
  token_type: string;

  @ApiProperty({
    description: 'Access token expiry in seconds',
    example: 86400,
  })
  expires_in: number;

  @ApiProperty({
    description: 'User profile',
    type: UserProfileDto,
  })
  user: UserProfileDto;
}

export class RefreshResponseDto {
  @ApiProperty({
    description: 'New JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token: string;

  @ApiProperty({
    description: 'Token type',
    example: 'Bearer',
  })
  token_type: string;

  @ApiProperty({
    description: 'Access token expiry in seconds',
    example: 86400,
  })
  expires_in: number;
}

export class RegisterResponseDto {
  @ApiProperty({
    description: 'Created user (partial)',
    type: PartialUserDto,
  })
  user: PartialUserDto;

  @ApiProperty({
    description: 'Created tenant',
    type: TenantDto,
  })
  tenant: TenantDto;

  @ApiProperty({
    description: 'Success message',
    example:
      'Registration successful. Please check your email to activate your account.',
  })
  message: string;
}

export class MessageResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Operation successful',
  })
  message: string;
}

export class LogoutAllResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Logged out from all devices successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Number of sessions revoked',
    example: 3,
  })
  sessions_revoked: number;
}

export class SessionDto {
  @ApiProperty({ description: 'Session ID', example: 'uuid' })
  id: string;

  @ApiPropertyOptional({
    description: 'Device name',
    example: 'Chrome on MacOS',
  })
  device_name?: string;

  @ApiPropertyOptional({
    description: 'IP address',
    example: '192.168.1.100',
  })
  ip_address?: string;

  @ApiProperty({
    description: 'Session creation timestamp',
    example: '2025-01-01T08:00:00Z',
  })
  created_at: string;

  @ApiProperty({
    description: 'Session expiry timestamp',
    example: '2025-01-08T08:00:00Z',
  })
  expires_at: string;

  @ApiProperty({
    description: 'Is this the current session',
    example: true,
  })
  is_current: boolean;
}

export class SessionsResponseDto {
  @ApiProperty({
    description: 'List of active sessions',
    type: [SessionDto],
  })
  sessions: SessionDto[];
}
