import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { attachment_type, grid_layout } from '@prisma/client';

/**
 * FileInfoDto
 *
 * Nested file information for attachment files
 */
export class FileInfoDto {
  @ApiProperty({ description: 'File ID', example: 'abc123def456' })
  file_id: string;

  @ApiProperty({ description: 'Original filename', example: 'photo.jpg' })
  original_filename: string;

  @ApiProperty({ description: 'File MIME type', example: 'image/jpeg' })
  mime_type: string;

  @ApiProperty({ description: 'File size in bytes', example: 1024000 })
  size_bytes: number;

  @ApiPropertyOptional({ description: 'Presigned download URL', example: 'https://s3.amazonaws.com/...' })
  url?: string;

  @ApiPropertyOptional({ description: 'Image width in pixels', example: 1920 })
  width?: number;

  @ApiPropertyOptional({ description: 'Image height in pixels', example: 1080 })
  height?: number;

  @ApiPropertyOptional({ description: 'Thumbnail URL', example: 'https://s3.amazonaws.com/.../thumb.webp' })
  thumbnail_url?: string;
}

/**
 * QuoteAttachmentResponseDto
 *
 * Complete attachment data with related file information
 *
 * @author Backend Developer
 */
export class QuoteAttachmentResponseDto {
  @ApiProperty({ description: 'Attachment ID', example: 'abc123-def456-789' })
  id: string;

  @ApiProperty({ description: 'Quote ID', example: 'quote-abc-123' })
  quote_id: string;

  @ApiProperty({
    description: 'Attachment type',
    enum: attachment_type,
    example: 'cover_photo',
  })
  attachment_type: attachment_type;

  @ApiPropertyOptional({
    description: 'File ID (for photo attachments)',
    example: 'file-abc-123',
  })
  file_id?: string;

  @ApiPropertyOptional({
    description: 'URL (for url_attachment type)',
    example: 'https://example.com/document.pdf',
  })
  url?: string;

  @ApiPropertyOptional({
    description: 'Title/description',
    example: 'Permit Documents',
  })
  title?: string;

  @ApiPropertyOptional({
    description: 'QR code file ID (for url_attachment type)',
    example: 'qr-file-abc-123',
  })
  qr_code_file_id?: string;

  @ApiPropertyOptional({
    description: 'Grid layout (for grid_photo type)',
    enum: grid_layout,
    example: 'grid_4',
  })
  grid_layout?: grid_layout;

  @ApiProperty({ description: 'Display order index', example: 0 })
  order_index: number;

  @ApiProperty({ description: 'Creation timestamp', example: '2026-01-24T10:30:00.000Z' })
  created_at: Date;

  @ApiPropertyOptional({
    description: 'Related file data (for photo attachments)',
    type: FileInfoDto,
  })
  file?: FileInfoDto;

  @ApiPropertyOptional({
    description: 'QR code file data (for url_attachment type)',
    type: FileInfoDto,
  })
  qr_code_file?: FileInfoDto;
}
