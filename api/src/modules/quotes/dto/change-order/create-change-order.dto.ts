import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsUUID, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { JobsiteAddressDto } from '../quote/jobsite-address.dto';

/**
 * CreateChangeOrderDto
 *
 * Request to create a change order from an approved parent quote
 */
export class CreateChangeOrderDto {
  @ApiProperty({
    description: 'Change order title',
    example: 'Additional foundation repairs',
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'Detailed description of changes',
    example: 'Customer requested upgraded materials for deck',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Override jobsite address (defaults to parent quote address)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => JobsiteAddressDto)
  jobsite_address?: JobsiteAddressDto;

  @ApiPropertyOptional({
    description: 'Override vendor (defaults to parent quote vendor)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  vendor_id?: string;

  @ApiPropertyOptional({
    description: 'Expiration days (defaults to 30)',
    example: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  expiration_days?: number;

  @ApiPropertyOptional({
    description: 'Custom profit percentage (overrides parent quote setting)',
    example: 20.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  custom_profit_percent?: number;

  @ApiPropertyOptional({
    description: 'Custom overhead percentage (overrides parent quote setting)',
    example: 15.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  custom_overhead_percent?: number;

  @ApiPropertyOptional({
    description: 'Custom contingency percentage (overrides parent quote setting)',
    example: 5.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  custom_contingency_percent?: number;
}
