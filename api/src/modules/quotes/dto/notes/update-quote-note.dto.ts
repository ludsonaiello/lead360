import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsBoolean } from 'class-validator';

/**
 * DTO for updating an existing quote note
 */
export class UpdateQuoteNoteDto {
  @ApiPropertyOptional({
    description: 'Updated note text content',
    example: 'Customer confirmed site visit scheduled for next week',
    maxLength: 5000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(5000, { message: 'Note text cannot exceed 5000 characters' })
  note_text?: string;

  @ApiPropertyOptional({
    description: 'Whether the note should be pinned to the top',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  is_pinned?: boolean;
}
