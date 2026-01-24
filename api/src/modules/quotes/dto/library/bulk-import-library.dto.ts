import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateLibraryItemDto } from './create-library-item.dto';

export class BulkImportLibraryDto {
  @ApiProperty({
    type: [CreateLibraryItemDto],
    description: 'Array of library items to import (transaction: all or nothing)',
    example: [
      {
        name: 'Standard drywall',
        unit_measurement_id: '550e8400-e29b-41d4-a716-446655440000',
        default_quantity: 1,
        default_material_cost: 2.5,
        default_labor_cost: 1.75,
      },
      {
        name: 'Premium paint',
        unit_measurement_id: '660e9511-f39c-52e5-b827-557766551111',
        default_quantity: 1,
        default_material_cost: 35.0,
        default_labor_cost: 25.0,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLibraryItemDto)
  items: CreateLibraryItemDto[];
}
