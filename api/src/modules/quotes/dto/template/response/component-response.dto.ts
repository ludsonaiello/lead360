import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ComponentResponseDto {
  @ApiProperty({
    description: 'Component unique identifier',
    example: 'comp-uuid-here',
  })
  id: string;

  @ApiProperty({
    description: 'Component name',
    example: 'Modern Header',
    maxLength: 200,
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Component description',
    example:
      'Clean, modern header with logo and company details in a horizontal layout',
    type: String,
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description:
      'Component type (header, customer_info, line_items, totals, footer, signature, payment_schedule, custom)',
    example: 'header',
    maxLength: 50,
  })
  component_type: string;

  @ApiProperty({
    description: 'Component structure definition (JSON)',
    example: {
      sections: ['logo', 'company_info', 'quote_info'],
      layout: 'horizontal',
    },
  })
  structure: any;

  @ApiPropertyOptional({
    description: 'Default component properties (JSON)',
    example: {
      show_logo: true,
      logo_width: 120,
      show_company_name: true,
      background_color: '#ffffff',
    },
    nullable: true,
  })
  default_props: any | null;

  @ApiProperty({
    description: 'Handlebars HTML template',
    example: '<div class="header-modern">...</div>',
    type: String,
  })
  html_template: string;

  @ApiPropertyOptional({
    description: 'CSS styles template',
    example: '.header-modern { display: flex; ... }',
    type: String,
    nullable: true,
  })
  css_template: string | null;

  @ApiPropertyOptional({
    description: 'Thumbnail preview image URL',
    example: 'https://cdn.example.com/components/header-1.png',
    maxLength: 500,
    type: String,
    nullable: true,
  })
  thumbnail_url: string | null;

  @ApiPropertyOptional({
    description: 'Pre-rendered preview HTML (for quick previews)',
    example: '<div class="preview">...</div>',
    type: String,
    nullable: true,
  })
  preview_html: string | null;

  @ApiPropertyOptional({
    description: 'Usage documentation and notes',
    example:
      'Perfect for modern, professional quotes. Displays logo, company info, and quote details.',
    type: String,
    nullable: true,
  })
  usage_notes: string | null;

  @ApiProperty({
    description: 'Component category (layout, content, custom)',
    example: 'layout',
    maxLength: 50,
  })
  category: string;

  @ApiPropertyOptional({
    description: 'Component tags array',
    example: ['modern', 'professional', 'horizontal'],
    type: [String],
    nullable: true,
  })
  tags: string[] | null;

  @ApiProperty({
    description:
      'Is this a global/platform component accessible to all tenants?',
    example: true,
    type: Boolean,
  })
  is_global: boolean;

  @ApiPropertyOptional({
    description: 'Tenant UUID (NULL for global/platform components)',
    example: 'tenant-uuid-here',
    type: String,
    nullable: true,
  })
  tenant_id: string | null;

  @ApiProperty({
    description: 'Is this component active and available for use?',
    example: true,
    type: Boolean,
  })
  is_active: boolean;

  @ApiProperty({
    description: 'Display sort order',
    example: 1,
    type: Number,
  })
  sort_order: number;

  @ApiPropertyOptional({
    description: 'Creator user UUID (NULL for platform components)',
    example: 'user-uuid-here',
    type: String,
    nullable: true,
  })
  created_by_user_id: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2026-02-04T10:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  created_at: string;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2026-02-04T10:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  updated_at: string;
}
