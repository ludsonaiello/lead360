import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export enum PreviewType {
  MINIMAL = 'minimal',
  STANDARD = 'standard',
  COMPLEX = 'complex',
}

export class PreviewTemplateDto {
  @ApiProperty({
    enum: PreviewType,
    default: PreviewType.STANDARD,
    description: 'Type of sample data to use for preview',
  })
  @IsEnum(PreviewType)
  preview_type: PreviewType;

  @ApiProperty({
    default: false,
    description: 'Use real quote data instead of sample data',
  })
  @IsBoolean()
  use_real_quote: boolean;

  @ApiProperty({
    required: false,
    description:
      'Quote ID to use for preview (required if use_real_quote is true)',
  })
  @IsOptional()
  @IsUUID()
  quote_id?: string;
}

export class PreviewTemplateResponseDto {
  @ApiProperty({ description: 'Rendered HTML content' })
  rendered_html: string;

  @ApiProperty({ description: 'Rendered CSS content' })
  rendered_css: string;

  @ApiProperty({
    description: 'Temporary preview URL (expires after 15 minutes)',
  })
  preview_url: string;

  @ApiProperty({ description: 'Preview expiration timestamp' })
  expires_at: string;
}
