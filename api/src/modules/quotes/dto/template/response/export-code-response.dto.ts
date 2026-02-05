import { ApiProperty } from '@nestjs/swagger';

export class ExportCodeResponseDto {
  @ApiProperty({
    description: 'Template UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  template_id: string;

  @ApiProperty({
    description: 'Template name',
    example: 'Modern Professional Quote',
  })
  template_name: string;

  @ApiProperty({
    description: 'Compiled Handlebars HTML',
    example: '<!DOCTYPE html><html><body>...</body></html>',
  })
  html: string;

  @ApiProperty({
    description: 'Compiled CSS styles',
    example: 'body { font-family: Inter, Arial, sans-serif; ... }',
  })
  css: string;

  @ApiProperty({
    description: 'Compilation timestamp (ISO 8601)',
    example: '2026-02-04T12:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  compiled_at: string;
}
