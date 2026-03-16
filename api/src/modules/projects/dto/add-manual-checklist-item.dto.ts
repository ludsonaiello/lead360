import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddManualChecklistItemDto {
  @ApiProperty({
    description: 'Item title',
    example: 'Customer walkthrough completed',
    maxLength: 300,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;

  @ApiPropertyOptional({
    description: 'Whether this item is required for completion',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  is_required?: boolean;

  @ApiProperty({ description: 'Display order (0-based)', example: 5 })
  @IsInt()
  @Min(0)
  order_index: number;
}
