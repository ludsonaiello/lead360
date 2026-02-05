import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class RepairQuoteDto {
  @ApiProperty({
    description: 'Type of repair to perform on the quote',
    enum: ['recalculate_totals', 'fix_relationships', 'reset_status'],
    example: 'recalculate_totals',
  })
  @IsEnum(['recalculate_totals', 'fix_relationships', 'reset_status'], {
    message:
      'Invalid issue type. Must be: recalculate_totals, fix_relationships, or reset_status',
  })
  issue_type: 'recalculate_totals' | 'fix_relationships' | 'reset_status';

  @ApiProperty({
    description: 'Optional notes about the repair',
    example: 'Totals were incorrect after manual item edit',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RepairQuoteResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Quote repaired successfully',
  })
  message: string;

  @ApiProperty({
    description: 'List of repairs that were applied',
    example: ['Recalculated subtotal', 'Updated tax amount', 'Updated total'],
    type: [String],
  })
  repairs_made: string[];

  @ApiProperty({
    description: 'Quote state before repair',
    example: {
      subtotal: 1000.0,
      tax: 80.0,
      total: 1080.0,
    },
  })
  before: object;

  @ApiProperty({
    description: 'Quote state after repair',
    example: {
      subtotal: 1000.0,
      tax: 100.0,
      total: 1100.0,
    },
  })
  after: object;
}
