import {
  IsArray,
  IsString,
  IsInt,
  IsNotEmpty,
  Min,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderItemDto {
  @ApiProperty({
    description: 'UUID of the transfer number to reorder',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'New display order position (0-based, lower = higher priority)',
    minimum: 0,
    example: 0,
  })
  @IsInt()
  @Min(0)
  display_order: number;
}

export class ReorderTransferNumbersDto {
  @ApiProperty({
    description:
      'Array of {id, display_order} pairs to bulk-update. ' +
      'All IDs must belong to the authenticated tenant.',
    type: [ReorderItemDto],
    minItems: 1,
    maxItems: 10,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
