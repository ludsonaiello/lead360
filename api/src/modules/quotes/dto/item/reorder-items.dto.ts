import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, IsNumber, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ItemOrderDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Item UUID',
  })
  @IsUUID()
  item_id: string;

  @ApiProperty({
    example: 1,
    description: 'New order index (1-based)',
  })
  @IsNumber()
  @Min(1)
  order_index: number;
}

export class ReorderItemsDto {
  @ApiProperty({
    type: [ItemOrderDto],
    description: 'Array of items with their new order indices',
    example: [
      { item_id: '550e8400-e29b-41d4-a716-446655440000', order_index: 1 },
      { item_id: '660e9511-f39c-52e5-b827-557766551111', order_index: 2 },
      { item_id: '770e0622-g40d-63f6-c938-668877662222', order_index: 3 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemOrderDto)
  items: ItemOrderDto[];
}
