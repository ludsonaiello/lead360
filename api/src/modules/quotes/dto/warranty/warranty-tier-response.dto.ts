import { ApiProperty } from '@nestjs/swagger';

/**
 * WarrantyTierResponseDto
 *
 * Response format for warranty tier data
 *
 * @author Backend Developer
 */
export class WarrantyTierResponseDto {
  @ApiProperty({ description: 'Warranty tier ID', example: 'warranty-abc-123' })
  id: string;

  @ApiProperty({
    description: 'Warranty tier name',
    example: '1-Year Standard',
  })
  tier_name: string;

  @ApiProperty({
    description: 'Warranty description',
    example: 'Standard 1-year warranty covering defects',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: 'Price type',
    enum: ['fixed', 'percentage'],
    example: 'fixed',
  })
  price_type: 'fixed' | 'percentage';

  @ApiProperty({
    description: 'Price value',
    example: 199.99,
  })
  price_value: number;

  @ApiProperty({
    description: 'Warranty duration in months',
    example: 12,
  })
  duration_months: number;

  @ApiProperty({ description: 'Active status', example: true })
  is_active: boolean;

  @ApiProperty({
    description: 'Number of quote items using this warranty tier',
    example: 5,
  })
  usage_count?: number;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-01-24T10:00:00.000Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-01-24T10:00:00.000Z',
  })
  updated_at: Date;
}
