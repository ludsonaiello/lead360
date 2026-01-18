import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsArray,
  IsObject,
  IsOptional,
  IsUUID,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';

/**
 * DTO for sending templated email
 */
export class SendTemplatedEmailDto {
  @ApiProperty({
    description: 'Recipient email address',
    example: 'customer@example.com',
  })
  @IsEmail()
  to: string;

  @ApiPropertyOptional({
    description: 'CC email addresses',
    example: ['manager@acmeplumbing.com'],
  })
  @IsArray()
  @IsEmail({}, { each: true })
  @ArrayMaxSize(10)
  @IsOptional()
  cc?: string[];

  @ApiPropertyOptional({
    description: 'BCC email addresses',
    example: ['admin@acmeplumbing.com'],
  })
  @IsArray()
  @IsEmail({}, { each: true })
  @ArrayMaxSize(10)
  @IsOptional()
  bcc?: string[];

  @ApiProperty({
    description: 'Template key to use',
    example: 'quote-sent',
  })
  @IsString()
  template_key: string;

  @ApiProperty({
    description: 'Variables to render in template',
    example: {
      customerName: 'John Doe',
      companyName: 'Acme Plumbing',
      quoteNumber: 'Q-12345',
      quoteTotal: '$1,250.00',
    },
  })
  @IsObject()
  variables: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Related entity type (for tracking)',
    example: 'quote',
  })
  @IsString()
  @IsOptional()
  related_entity_type?: string;

  @ApiPropertyOptional({
    description: 'Related entity ID (for tracking)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  @IsOptional()
  related_entity_id?: string;
}

/**
 * DTO for sending raw email (no template)
 */
export class SendRawEmailDto {
  @ApiProperty({
    description: 'Recipient email address',
    example: 'customer@example.com',
  })
  @IsEmail()
  to: string;

  @ApiPropertyOptional({
    description: 'CC email addresses',
    example: ['manager@acmeplumbing.com'],
  })
  @IsArray()
  @IsEmail({}, { each: true })
  @ArrayMaxSize(10)
  @IsOptional()
  cc?: string[];

  @ApiPropertyOptional({
    description: 'BCC email addresses',
    example: ['admin@acmeplumbing.com'],
  })
  @IsArray()
  @IsEmail({}, { each: true })
  @ArrayMaxSize(10)
  @IsOptional()
  bcc?: string[];

  @ApiProperty({
    description: 'Email subject',
    example: 'Your Quote is Ready',
  })
  @IsString()
  @MaxLength(500)
  subject: string;

  @ApiProperty({
    description: 'HTML email body',
    example: '<h1>Hello!</h1><p>Your quote is ready for review.</p>',
  })
  @IsString()
  html_body: string;

  @ApiPropertyOptional({
    description: 'Plain text email body',
    example: 'Hello! Your quote is ready for review.',
  })
  @IsString()
  @IsOptional()
  text_body?: string;

  @ApiPropertyOptional({
    description: 'File attachments',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'File ID from file management' },
      },
    },
  })
  @IsArray()
  @IsOptional()
  attachments?: Array<{ file_id: string }>;

  @ApiPropertyOptional({
    description: 'Related entity type (for tracking)',
    example: 'quote',
  })
  @IsString()
  @IsOptional()
  related_entity_type?: string;

  @ApiPropertyOptional({
    description: 'Related entity ID (for tracking)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  @IsOptional()
  related_entity_id?: string;
}
