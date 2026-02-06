import {
  IsString,
  IsInt,
  IsEnum,
  IsEmail,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEmailConfigDto {
  @ApiProperty({
    example: 'smtp.gmail.com',
    description: 'SMTP server hostname',
  })
  @IsString()
  smtp_host: string;

  @ApiProperty({
    example: 587,
    minimum: 1,
    maximum: 65535,
    description: 'SMTP server port (587 for TLS, 465 for SSL)',
  })
  @IsInt()
  @Min(1)
  @Max(65535)
  smtp_port: number;

  @ApiProperty({
    enum: ['none', 'tls', 'ssl'],
    example: 'tls',
    description: 'SMTP encryption type',
  })
  @IsEnum(['none', 'tls', 'ssl'])
  smtp_encryption: string;

  @ApiProperty({
    example: 'noreply@lead360.app',
    description: 'SMTP username (usually an email address)',
  })
  @IsString()
  smtp_username: string;

  @ApiProperty({
    example: 'your-smtp-password',
    minLength: 8,
    description:
      'SMTP password or app-specific password (minimum 8 characters)',
  })
  @IsString()
  @MinLength(8)
  smtp_password: string;

  @ApiProperty({
    example: 'noreply@lead360.app',
    description: 'Email address to use in the "From" field',
  })
  @IsEmail()
  from_email: string;

  @ApiProperty({
    example: 'Lead360 Platform',
    description: 'Name to display in the "From" field',
  })
  @IsString()
  from_name: string;
}

export class SendTestEmailDto {
  @ApiProperty({
    example: 'admin@example.com',
    description: 'Email address to send test email to',
  })
  @IsEmail()
  to_email: string;
}
