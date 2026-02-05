import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * User information embedded in note response
 */
export class QuoteNoteUserDto {
  @ApiProperty({
    description: 'User UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  first_name: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  last_name: string;

  @ApiProperty({
    description: 'User email',
    example: 'john.doe@example.com',
  })
  email: string;
}

/**
 * Quote note response DTO
 */
export class QuoteNoteResponseDto {
  @ApiProperty({
    description: 'Note UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Quote UUID',
    example: '987e6543-e89b-12d3-a456-426614174111',
  })
  quote_id: string;

  @ApiProperty({
    description: 'Note text content',
    example: 'Customer requested site visit before finalizing materials',
  })
  note_text: string;

  @ApiProperty({
    description: 'Whether the note is pinned',
    example: false,
  })
  is_pinned: boolean;

  @ApiPropertyOptional({
    description: 'User who created the note (null if user was deleted)',
    type: QuoteNoteUserDto,
  })
  user?: QuoteNoteUserDto;

  @ApiProperty({
    description: 'ISO 8601 timestamp when note was created',
    example: '2026-02-01T10:30:00.000Z',
  })
  created_at: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp when note was last updated',
    example: '2026-02-01T14:45:00.000Z',
  })
  updated_at: string;
}

/**
 * List of quote notes response
 */
export class QuoteNotesListResponseDto {
  @ApiProperty({
    description: 'Array of quote notes',
    type: [QuoteNoteResponseDto],
  })
  notes: QuoteNoteResponseDto[];

  @ApiProperty({
    description: 'Total number of notes',
    example: 5,
  })
  total: number;
}
