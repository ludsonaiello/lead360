import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserBasicInfoDto } from './user-basic-info.dto';

export class TemplateVersionResponseDto {
  @ApiProperty({
    description: 'Version unique identifier',
    example: 'version-uuid-here',
  })
  id: string;

  @ApiProperty({
    description: 'Template UUID this version belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  template_id: string;

  @ApiProperty({
    description: 'Version number (sequential: 1, 2, 3...)',
    example: 1,
    type: Number,
  })
  version_number: number;

  @ApiProperty({
    description: 'Template type (visual or code)',
    example: 'visual',
    enum: ['visual', 'code'],
  })
  template_type: string;

  @ApiPropertyOptional({
    description: 'Visual template JSON structure (NULL for code templates)',
    example: {
      version: '1.0',
      layout: { pageSize: 'letter', orientation: 'portrait' },
    },
    nullable: true,
  })
  visual_structure: any | null;

  @ApiPropertyOptional({
    description: 'Handlebars HTML content (NULL for visual templates)',
    example: '<!DOCTYPE html><html>...</html>',
    type: String,
    nullable: true,
  })
  html_content: string | null;

  @ApiPropertyOptional({
    description: 'CSS styles',
    example: 'body { font-family: Arial; }',
    type: String,
    nullable: true,
  })
  css_content: string | null;

  @ApiPropertyOptional({
    description: 'Summary of changes in this version',
    example: 'Updated header layout and added new footer component',
    maxLength: 500,
    type: String,
    nullable: true,
  })
  changes_summary: string | null;

  @ApiPropertyOptional({
    description: 'Template render time in milliseconds (performance tracking)',
    example: 250,
    type: Number,
    nullable: true,
  })
  render_time_ms: number | null;

  @ApiPropertyOptional({
    description: 'Generated PDF size in kilobytes (performance tracking)',
    example: 145,
    type: Number,
    nullable: true,
  })
  pdf_size_kb: number | null;

  @ApiPropertyOptional({
    description: 'Creator user UUID (NULL for system versions)',
    example: 'user-uuid-here',
    type: String,
    nullable: true,
  })
  created_by_user_id: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2026-02-04T12:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  created_at: string;

  @ApiPropertyOptional({
    description:
      'Creator user details (included if created_by_user_id is not null)',
    type: () => UserBasicInfoDto,
  })
  created_by_user?: UserBasicInfoDto;
}
