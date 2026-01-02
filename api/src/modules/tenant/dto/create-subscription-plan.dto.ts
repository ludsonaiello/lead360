import {
  IsString,
  IsNumber,
  IsBoolean,
  IsInt,
  IsOptional,
  IsObject,
  Min,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubscriptionPlanDto {
  @ApiProperty({
    description: 'Plan name (unique)',
    example: 'Professional',
  })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({
    description: 'Plan description',
    example: 'Full-featured plan for growing businesses',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Monthly price in dollars',
    example: 99.99,
  })
  @IsNumber()
  @Min(0)
  monthly_price: number;

  @ApiProperty({
    description: 'Annual price in dollars (usually discounted)',
    example: 999.99,
  })
  @IsNumber()
  @Min(0)
  annual_price: number;

  @ApiProperty({
    description: 'Maximum number of users allowed',
    example: 10,
  })
  @IsInt()
  @Min(1)
  max_users: number;

  @ApiProperty({
    description: 'Feature flags (JSON object with boolean flags)',
    example: {
      leads_module: true,
      quotes_module: true,
      invoices_module: true,
      scheduling_module: true,
      time_tracking_module: true,
      inventory_module: false,
      advanced_reporting: true,
    },
  })
  @IsObject()
  feature_flags: Record<string, boolean>;

  @ApiPropertyOptional({
    description: 'Is this plan active and available for purchase?',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Is this the default plan for new tenants?',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  is_default?: boolean;
}
