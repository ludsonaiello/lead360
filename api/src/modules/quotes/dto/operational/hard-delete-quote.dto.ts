import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, MinLength } from 'class-validator';

export class HardDeleteQuoteDto {
  @ApiProperty({
    description: 'Reason for hard deletion (mandatory for audit trail)',
    example: 'Quote created by mistake and contains test data',
    minLength: 10,
  })
  @IsString()
  @MinLength(10, { message: 'Reason must be at least 10 characters long' })
  reason: string;

  @ApiProperty({
    description: 'Confirmation flag - must be true to proceed with deletion',
    example: true,
    required: true,
  })
  @IsBoolean()
  confirm: boolean;
}

export class HardDeleteQuoteResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Quote deleted permanently',
  })
  message: string;

  @ApiProperty({
    description: 'Quote UUID that was deleted',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  quote_id: string;

  @ApiProperty({
    description: 'Tenant ID the quote belonged to',
    example: '660e8400-e29b-41d4-a716-446655440001',
  })
  tenant_id: string;

  @ApiProperty({
    description: 'Deletion timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  deleted_at: string;

  @ApiProperty({
    description: 'Admin user ID who performed the deletion',
    example: '770e8400-e29b-41d4-a716-446655440002',
  })
  deleted_by: string;

  @ApiProperty({
    description: 'Reason provided for deletion',
    example: 'Quote created by mistake and contains test data',
  })
  reason: string;
}
