import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsEnum, ArrayMinSize, MinLength } from 'class-validator';

export class BulkUpdateQuoteStatusDto {
  @ApiProperty({
    description: 'Array of quote UUIDs to update',
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
    ],
    type: [String],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one quote ID is required' })
  @IsString({ each: true })
  quote_ids: string[];

  @ApiProperty({
    description: 'New status to apply to all quotes',
    enum: [
      'draft',
      'pending',
      'sent',
      'delivered',
      'read',
      'opened',
      'downloaded',
      'approved',
      'denied',
      'expired',
      'started',
      'concluded',
      'lost',
    ],
    example: 'approved',
  })
  @IsEnum(
    [
      'draft',
      'pending',
      'sent',
      'delivered',
      'read',
      'opened',
      'downloaded',
      'approved',
      'denied',
      'expired',
      'started',
      'concluded',
      'lost',
    ],
    { message: 'Invalid quote status' },
  )
  new_status: string;

  @ApiProperty({
    description: 'Reason for bulk update (mandatory for audit trail)',
    example: 'Correcting status after system error',
    minLength: 10,
  })
  @IsString()
  @MinLength(10, { message: 'Reason must be at least 10 characters long' })
  reason: string;
}

export class BulkUpdateErrorDto {
  @ApiProperty({
    description: 'Quote ID that failed to update',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  quote_id: string;

  @ApiProperty({
    description: 'Error message explaining why update failed',
    example: 'Quote not found',
  })
  error: string;
}

export class BulkUpdateResponseDto {
  @ApiProperty({
    description: 'Number of quotes successfully updated',
    example: 5,
  })
  updated_count: number;

  @ApiProperty({
    description: 'Number of quotes that failed to update',
    example: 2,
  })
  failed_count: number;

  @ApiProperty({
    description: 'Array of errors for failed updates',
    type: [BulkUpdateErrorDto],
  })
  errors: BulkUpdateErrorDto[];
}
