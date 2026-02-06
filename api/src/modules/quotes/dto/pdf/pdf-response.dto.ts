import { ApiProperty } from '@nestjs/swagger';

export class PdfResponseDto {
  @ApiProperty({
    description: 'File ID in the file storage system',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  file_id: string;

  @ApiProperty({
    description: 'Presigned URL for downloading the PDF (expires in 1 hour)',
    example:
      'https://storage.lead360.app/quotes/quote-2026-001.pdf?signature=...',
  })
  download_url: string;

  @ApiProperty({
    description: 'Original filename',
    example: 'Q-2026-001.pdf',
  })
  filename: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 524288,
  })
  file_size: number;

  @ApiProperty({
    description: 'When the PDF was generated',
    example: '2026-01-24T10:00:00Z',
  })
  generated_at: string;

  @ApiProperty({
    description: 'Whether this PDF was regenerated or retrieved from cache',
    example: false,
  })
  regenerated: boolean;
}
