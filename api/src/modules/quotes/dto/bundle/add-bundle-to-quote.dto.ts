import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * AddBundleToQuoteDto
 *
 * Request body for adding a bundle template to a quote
 */
export class AddBundleToQuoteDto {
  @ApiPropertyOptional({
    description: 'Whether to apply bundle discount as quote discount rule',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  apply_discount?: boolean = true;

  @ApiPropertyOptional({
    description: 'Whether to create a quote group for bundle items',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  create_group?: boolean = true;

  @ApiPropertyOptional({
    description: 'Custom name for the quote group (defaults to bundle name)',
    example: 'Kitchen Package - Custom',
  })
  @IsString()
  @Length(1, 200)
  @IsOptional()
  group_name?: string;
}

/**
 * AddBundleToQuoteResponseDto
 *
 * Response when bundle is successfully added to quote
 */
export class AddBundleToQuoteResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: "Bundle 'Complete Kitchen Remodel' added to quote" })
  message: string;

  @ApiPropertyOptional({ example: 'uuid-of-group' })
  quote_group_id?: string;

  @ApiProperty({ example: 5 })
  items_created: number;

  @ApiProperty({ example: true })
  discount_applied: boolean;

  @ApiPropertyOptional({ example: 'uuid-of-discount-rule' })
  discount_rule_id?: string;
}
