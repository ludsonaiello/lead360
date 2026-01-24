import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsArray, MaxLength } from 'class-validator';

export class SendQuoteEmailDto {
  @ApiPropertyOptional({
    description: 'Recipient email (if different from lead email)',
    example: 'customer@example.com',
  })
  @IsOptional()
  @IsEmail()
  recipient_email?: string;

  @ApiPropertyOptional({
    description: 'CC email addresses',
    example: ['manager@example.com'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  cc_emails?: string[];

  @ApiPropertyOptional({
    description: 'Custom message to include in email',
    example: 'Thank you for considering our services.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  custom_message?: string;
}

export class SendQuoteEmailResponseDto {
  @ApiProperty({
    description: 'Whether email was sent successfully',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Result message',
    example: 'Quote emailed successfully to customer@example.com',
  })
  message: string;

  @ApiProperty({
    description: 'Public URL generated for the quote',
    example: 'https://company.lead360.app/quotes/abc123',
  })
  public_url: string;

  @ApiProperty({
    description: 'PDF file ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  pdf_file_id: string;

  @ApiProperty({
    description: 'Email ID in communication system',
    example: '456e7890-e89b-12d3-a456-426614174111',
  })
  email_id: string;
}
