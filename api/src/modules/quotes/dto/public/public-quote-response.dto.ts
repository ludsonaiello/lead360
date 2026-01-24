import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Public-facing quote response DTO
 * Excludes sensitive information like costs, private notes, and internal approval data
 */
export class PublicQuoteResponseDto {
  @ApiProperty({
    description: 'Quote UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Quote number',
    example: 'Q-2026-001',
  })
  quote_number: string;

  @ApiProperty({
    description: 'Quote title',
    example: 'Bathroom Renovation',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'Quote description',
    example: 'Complete bathroom renovation including fixtures, tiling, and plumbing',
  })
  description?: string;

  @ApiProperty({
    description: 'Quote status',
    example: 'sent',
    enum: ['draft', 'ready', 'sent', 'read', 'approved', 'rejected', 'expired', 'cancelled'],
  })
  status: string;

  @ApiProperty({
    description: 'Total price (grand total including tax)',
    example: 15000.00,
  })
  total_price: number;

  @ApiPropertyOptional({
    description: 'Subtotal before tax and discounts',
    example: 13500.00,
  })
  subtotal?: number;

  @ApiPropertyOptional({
    description: 'Total tax amount',
    example: 1500.00,
  })
  total_tax?: number;

  @ApiPropertyOptional({
    description: 'Total discount amount',
    example: 500.00,
  })
  total_discount?: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  currency: string;

  @ApiPropertyOptional({
    description: 'Quote valid until date (ISO 8601)',
    example: '2026-02-28T23:59:59Z',
  })
  valid_until?: string;

  @ApiProperty({
    description: 'Quote created date (ISO 8601)',
    example: '2026-01-23T10:00:00Z',
  })
  created_at: string;

  @ApiProperty({
    description: 'Quote last updated date (ISO 8601)',
    example: '2026-01-23T15:30:00Z',
  })
  updated_at: string;

  @ApiPropertyOptional({
    description: 'Customer information',
  })
  customer?: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    company_name?: string;
  };

  @ApiPropertyOptional({
    description: 'Jobsite address information',
  })
  jobsite_address?: {
    street_address: string;
    city: string;
    state: string;
    zip_code: string;
    country?: string;
  };

  @ApiPropertyOptional({
    description: 'Vendor information',
  })
  vendor?: {
    name: string;
    phone?: string;
    email?: string;
    website?: string;
  };

  @ApiProperty({
    description: 'Quote items with groups',
    type: 'array',
  })
  items: PublicQuoteItemDto[];

  @ApiPropertyOptional({
    description: 'Company branding (logo, colors)',
  })
  branding?: {
    company_name: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
  };

  @ApiPropertyOptional({
    description: 'Cover page image URL',
  })
  cover_page_image_url?: string;

  @ApiPropertyOptional({
    description: 'Additional attachments (images, documents)',
    type: 'array',
  })
  attachments?: {
    id: string;
    filename: string;
    url: string;
    mime_type: string;
    file_size: number;
  }[];

  @ApiPropertyOptional({
    description: 'Quote notes visible to customer',
  })
  public_notes?: string;

  @ApiPropertyOptional({
    description: 'Terms and conditions',
  })
  terms_and_conditions?: string;
}

export class PublicQuoteItemDto {
  @ApiProperty({
    description: 'Item UUID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  id: string;

  @ApiProperty({
    description: 'Item title',
    example: 'Toilet Installation',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'Item description',
    example: 'Install new dual-flush toilet',
  })
  description?: string;

  @ApiProperty({
    description: 'Quantity',
    example: 1,
  })
  quantity: number;

  @ApiProperty({
    description: 'Unit of measurement',
    example: 'unit',
  })
  unit: string;

  @ApiProperty({
    description: 'Price per unit',
    example: 450.00,
  })
  unit_price: number;

  @ApiProperty({
    description: 'Total price for this item (quantity * unit_price)',
    example: 450.00,
  })
  total_price: number;

  @ApiPropertyOptional({
    description: 'Tax amount for this item',
    example: 45.00,
  })
  tax_amount?: number;

  @ApiPropertyOptional({
    description: 'Discount amount for this item',
    example: 0.00,
  })
  discount_amount?: number;

  @ApiPropertyOptional({
    description: 'Group this item belongs to',
  })
  group?: {
    id: string;
    name: string;
    display_order: number;
  };

  @ApiProperty({
    description: 'Display order within group or quote',
    example: 1,
  })
  display_order: number;

  @ApiPropertyOptional({
    description: 'Whether this item is optional',
    example: false,
  })
  is_optional?: boolean;

  @ApiPropertyOptional({
    description: 'Images for this item',
    type: 'array',
  })
  images?: {
    id: string;
    url: string;
    caption?: string;
  }[];
}

export class LogViewDto {
  @ApiPropertyOptional({
    description: 'Referrer URL (where the visitor came from)',
    example: 'https://google.com',
  })
  referrer_url?: string;

  @ApiPropertyOptional({
    description: 'Time spent viewing the quote (in seconds)',
    example: 120,
  })
  duration_seconds?: number;
}
