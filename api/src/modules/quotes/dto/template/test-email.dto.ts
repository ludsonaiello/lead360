import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsEmail, IsOptional } from 'class-validator';
import { PreviewType } from './preview-template.dto';

export class TestEmailDto {
  @ApiProperty({
    enum: PreviewType,
    default: PreviewType.STANDARD,
    description: 'Type of sample data to use for email rendering',
  })
  @IsEnum(PreviewType)
  preview_type: PreviewType;

  @ApiProperty({
    required: false,
    description: 'Email address to send test email to (optional)',
  })
  @IsOptional()
  @IsEmail()
  send_to_email?: string;
}

export class TestEmailResponseDto {
  @ApiProperty({ description: 'Rendered HTML email content' })
  html_preview: string;

  @ApiProperty({ description: 'Plain text version of email' })
  text_preview: string;

  @ApiProperty({ description: 'Email subject line' })
  subject_line: string;

  @ApiProperty({ description: 'Whether test email was sent' })
  test_email_sent: boolean;

  @ApiProperty({
    required: false,
    description: 'Email queue job ID (if test email was sent)',
  })
  email_job_id?: string;
}
