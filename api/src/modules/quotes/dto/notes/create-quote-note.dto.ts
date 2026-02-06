import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsBoolean,
  IsOptional,
} from 'class-validator';

/**
 * DTO for creating a new quote note
 */
export class CreateQuoteNoteDto {
  @ApiProperty({
    description: 'Note text content',
    example: 'Customer requested site visit before finalizing materials',
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000, { message: 'Note text cannot exceed 5000 characters' })
  note_text: string;

  @ApiPropertyOptional({
    description: 'Whether the note should be pinned to the top',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  is_pinned?: boolean;
}
