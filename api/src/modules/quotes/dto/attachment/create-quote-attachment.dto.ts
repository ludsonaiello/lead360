import {
  IsEnum,
  IsOptional,
  IsString,
  IsInt,
  IsUrl,
  ValidateIf,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { attachment_type, grid_layout } from '@prisma/client';

/**
 * CreateQuoteAttachmentDto
 *
 * Validates quote attachment creation with conditional rules:
 * - url_attachment: requires url, no file_id
 * - Photo types: require file_id, no url
 * - grid_photo: requires grid_layout
 *
 * @author Backend Developer
 */
export class CreateQuoteAttachmentDto {
  @ApiProperty({
    description: 'Type of attachment',
    enum: attachment_type,
    example: 'cover_photo',
  })
  @IsEnum(attachment_type, {
    message:
      'attachment_type must be one of: cover_photo, full_page_photo, grid_photo, url_attachment',
  })
  attachment_type: attachment_type;

  @ApiPropertyOptional({
    description: 'File ID for photo attachments (required for photo types)',
    example: 'abc123def456',
    minLength: 1,
    maxLength: 36,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(36)
  @ValidateIf((o) =>
    ['cover_photo', 'full_page_photo', 'grid_photo'].includes(
      o.attachment_type,
    ),
  )
  file_id?: string;

  @ApiPropertyOptional({
    description: 'URL for url_attachment type (required for url_attachment)',
    example: 'https://example.com/document.pdf',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'url must be a valid URL' })
  @MaxLength(500)
  @ValidateIf((o) => o.attachment_type === 'url_attachment')
  url?: string;

  @ApiPropertyOptional({
    description:
      'Title/description for the attachment (primarily for URL attachments)',
    example: 'Permit Documents',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description:
      'Grid layout for grid_photo type (required if type is grid_photo)',
    enum: grid_layout,
    example: 'grid_4',
  })
  @IsOptional()
  @IsEnum(grid_layout, {
    message: 'grid_layout must be one of: grid_2, grid_4, grid_6',
  })
  @ValidateIf((o) => o.attachment_type === 'grid_photo')
  grid_layout?: grid_layout;

  @ApiPropertyOptional({
    description: 'Display order index (auto-incremented if not provided)',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  order_index?: number;
}
