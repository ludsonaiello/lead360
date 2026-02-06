import {
  IsOptional,
  IsString,
  IsInt,
  IsUrl,
  IsEnum,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { grid_layout } from '@prisma/client';

/**
 * UpdateQuoteAttachmentDto
 *
 * Allows updating mutable fields of a quote attachment.
 * Cannot change attachment_type or file_id after creation.
 *
 * @author Backend Developer
 */
export class UpdateQuoteAttachmentDto {
  @ApiPropertyOptional({
    description: 'Updated title/description',
    example: 'Updated Permit Documents',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated URL (will trigger QR code regeneration)',
    example: 'https://example.com/new-document.pdf',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'url must be a valid URL' })
  @MaxLength(500)
  url?: string;

  @ApiPropertyOptional({
    description: 'Updated grid layout (only for grid_photo type)',
    enum: grid_layout,
    example: 'grid_6',
  })
  @IsOptional()
  @IsEnum(grid_layout, {
    message: 'grid_layout must be one of: grid_2, grid_4, grid_6',
  })
  grid_layout?: grid_layout;

  @ApiPropertyOptional({
    description: 'Updated display order index',
    example: 5,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  order_index?: number;
}
