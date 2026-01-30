import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber } from 'class-validator';

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
    enum: ['draft', 'pending_approval', 'ready', 'sent', 'delivered', 'read', 'opened', 'downloaded', 'approved', 'started', 'concluded', 'denied', 'lost', 'email_failed'],
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
    id: string;
    first_name: string;
    last_name: string;
    emails: { id: string; email: string; is_primary: boolean }[];
    phones: { id: string; phone: string; phone_type: string; is_primary: boolean }[];
  };

  @ApiPropertyOptional({
    description: 'Jobsite address information',
  })
  jobsite_address?: {
    id: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    zip_code: string;
    latitude: number;
    longitude: number;
    google_place_id?: string;
  };

  @ApiPropertyOptional({
    description: 'Vendor information',
  })
  vendor?: {
    name: string;
    phone?: string;
    email?: string;
    website?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    signature_file_id?: string;
    signature_url?: string;
  };

  @ApiProperty({
    description: 'Quote items with groups',
    type: 'array',
  })
  items: PublicQuoteItemDto[];

  @ApiPropertyOptional({
    description: 'Company branding (logo, colors, contact info)',
  })
  branding?: {
    company_name: string;
    logo_file_id?: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      zip_code: string;
      country: string;
    };
    social_media?: {
      instagram?: string;
      facebook?: string;
      tiktok?: string;
      youtube?: string;
    };
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
    file_id?: string;
    title?: string;
    attachment_type: string;
    filename?: string;
    url?: string;
    mime_type?: string;
    file_size?: number;
    order_index: number;
  }[];

  @ApiPropertyOptional({
    description: 'Quote notes visible to customer',
  })
  public_notes?: string;

  @ApiPropertyOptional({
    description: 'Terms and conditions',
  })
  terms_and_conditions?: string;

  @ApiPropertyOptional({
    description: 'Custom payment instructions',
  })
  payment_instructions?: string;

  @ApiPropertyOptional({
    description: 'PO number',
  })
  po_number?: string;

  @ApiPropertyOptional({
    description: 'Discount rules applied to this quote',
    type: 'array',
  })
  discount_rules?: {
    id: string;
    name: string;
    discount_type: string;
    discount_value: number;
    applies_to_item_id?: string;
    order_index: number;
  }[];

  @ApiPropertyOptional({
    description: 'Draw schedule entries',
    type: 'array',
  })
  draw_schedule?: {
    id: string;
    draw_number: number;
    name: string;
    description: string;
    calculation_type: string; // 'percentage' or 'fixed_amount'
    value: number; // The raw value (percentage or fixed amount)
    percentage: number; // Calculated percentage
    amount: number; // Calculated amount
    order_index: number;
  }[];

  @ApiPropertyOptional({
    description: 'PDF information',
  })
  pdf?: {
    file_id: string;
    url: string;
    content_hash?: string;
    last_generated_at?: string;
    generation_params?: any;
    filename: string;
    mime_type: string;
    file_size: number;
  };
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
    description: 'Material cost per unit',
    example: 100.00,
  })
  material_cost_per_unit: number;

  @ApiProperty({
    description: 'Labor cost per unit',
    example: 150.00,
  })
  labor_cost_per_unit: number;

  @ApiProperty({
    description: 'Equipment cost per unit',
    example: 50.00,
  })
  equipment_cost_per_unit: number;

  @ApiProperty({
    description: 'Subcontract cost per unit',
    example: 0.00,
  })
  subcontract_cost_per_unit: number;

  @ApiProperty({
    description: 'Other cost per unit',
    example: 0.00,
  })
  other_cost_per_unit: number;

  @ApiProperty({
    description: 'Total cost for this item',
    example: 300.00,
  })
  total_cost: number;

  @ApiPropertyOptional({
    description: 'Custom markup percentage',
    example: 25.5,
  })
  custom_markup_percent?: number;

  @ApiPropertyOptional({
    description: 'Custom discount amount',
    example: 50.00,
  })
  custom_discount_amount?: number;

  @ApiPropertyOptional({
    description: 'Custom tax rate',
    example: 8.5,
  })
  custom_tax_rate?: number;

  @ApiPropertyOptional({
    description: 'Group this item belongs to',
  })
  group?: {
    id: string;
    name: string;
    description?: string;
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
  @IsOptional()
  @IsString()
  referrer_url?: string;

  @ApiPropertyOptional({
    description: 'Time spent viewing the quote (in seconds)',
    example: 120,
  })
  @IsOptional()
  @IsNumber()
  duration_seconds?: number;
}

export class LogDownloadDto {
  @ApiPropertyOptional({
    description: 'File ID of the PDF being downloaded',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  file_id?: string;
}
