import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

/**
 * CreateChangeOrderDto
 *
 * Request to create a change order
 */
export class CreateChangeOrderDto {
  @ApiProperty({ description: 'Change order title', example: 'Additional work - upgraded materials' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Description of changes', example: 'Customer requested premium materials', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * ChangeOrderDto
 *
 * Change order response (quote object)
 */
export class ChangeOrderDto {
  @ApiProperty({ description: 'Change order ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ description: 'Quote number (CO- prefix)', example: 'CO-2024-001' })
  quote_number: string;

  @ApiProperty({ description: 'Title', example: 'Additional work' })
  title: string;

  @ApiProperty({ description: 'Status', example: 'draft' })
  status: string;

  @ApiProperty({ description: 'Total amount', example: 5000.00 })
  total: number;

  @ApiProperty({ description: 'Created at', example: '2024-01-20T10:30:00.000Z' })
  created_at: string;
}

/**
 * ListChangeOrdersResponseDto
 *
 * List of change orders for a parent quote
 */
export class ListChangeOrdersResponseDto {
  @ApiProperty({ description: 'Change orders', type: [ChangeOrderDto] })
  change_orders: ChangeOrderDto[];

  @ApiProperty({ description: 'Total count', example: 3 })
  total_count: number;
}
