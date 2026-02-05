import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TemplateResponseDto {
  @ApiProperty({
    description: 'Template unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'Tenant UUID (NULL for global/platform templates)',
    example: 'tenant-uuid-here',
    type: String,
    nullable: true,
  })
  tenant_id: string | null;

  @ApiProperty({
    description: 'Template name',
    example: 'Modern Professional Quote',
    maxLength: 200,
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Detailed template description',
    example: 'Clean, contemporary template with horizontal header and card-style customer info',
    type: String,
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: 'Template type',
    example: 'visual',
    enum: ['visual', 'code'],
  })
  template_type: string;

  @ApiPropertyOptional({
    description: 'Visual template JSON structure (NULL for code templates)',
    example: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 50, right: 50, bottom: 50, left: 50 },
        header: { enabled: true, height: 120, components: [] },
        body: { components: [] },
        footer: { enabled: false },
      },
      theme: {
        primaryColor: '#2563eb',
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: 14,
      },
    },
    nullable: true,
  })
  visual_structure: any | null;

  @ApiPropertyOptional({
    description: 'Handlebars HTML content (NULL for visual templates)',
    example: '<!DOCTYPE html><html><body>{{quote.quote_number}}</body></html>',
    type: String,
    nullable: true,
  })
  html_content: string | null;

  @ApiPropertyOptional({
    description: 'CSS styles (optional for both template types)',
    example: 'body { font-family: Arial, sans-serif; }',
    type: String,
    nullable: true,
  })
  css_content: string | null;

  @ApiPropertyOptional({
    description: 'Category UUID (NULL if uncategorized)',
    example: 'cat-uuid-here',
    type: String,
    nullable: true,
  })
  category_id: string | null;

  @ApiPropertyOptional({
    description: 'Template tags array (NULL if no tags)',
    example: ['modern', 'professional', 'clean'],
    type: [String],
    nullable: true,
  })
  tags: string[] | null;

  @ApiPropertyOptional({
    description: 'Thumbnail preview image URL (NULL if no thumbnail)',
    example: 'https://cdn.example.com/thumbnails/template-123.png',
    maxLength: 500,
    type: String,
    nullable: true,
  })
  thumbnail_url: string | null;

  @ApiProperty({
    description: 'Is this a platform pre-built template?',
    example: false,
    type: Boolean,
  })
  is_prebuilt: boolean;

  @ApiPropertyOptional({
    description: 'Source template UUID if this was cloned from another template (NULL if original)',
    example: 'source-template-uuid',
    type: String,
    nullable: true,
  })
  source_template_id: string | null;

  @ApiProperty({
    description: 'Is this a global/platform template accessible to all tenants?',
    example: false,
    type: Boolean,
  })
  is_global: boolean;

  @ApiProperty({
    description: 'Is this template active and available for use?',
    example: true,
    type: Boolean,
  })
  is_active: boolean;

  @ApiProperty({
    description: "Is this the tenant's default template for quotes?",
    example: false,
    type: Boolean,
  })
  is_default: boolean;

  @ApiPropertyOptional({
    description: 'Creator user UUID (NULL for system/platform templates)',
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

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2026-02-04T12:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  updated_at: string;
}
