import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFinancialEntryDto {
  @ApiProperty({
    description: 'Project ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID()
  project_id: string;

  @ApiPropertyOptional({
    description: 'Task ID (optional)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiProperty({
    description: 'Financial category ID (must belong to same tenant)',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsString()
  @IsUUID()
  category_id: string;

  @ApiProperty({
    description: 'Entry amount (must be greater than 0)',
    example: 450.0,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount: number;

  @ApiProperty({
    description: 'Entry date in ISO format (cannot be a future date)',
    example: '2026-03-10',
  })
  @IsDateString()
  entry_date: string;

  @ApiPropertyOptional({
    description: 'Vendor name',
    example: 'Home Depot',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor_name?: string;

  @ApiPropertyOptional({
    description: 'Crew member ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  crew_member_id?: string;

  @ApiPropertyOptional({
    description: 'Subcontractor ID',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  subcontractor_id?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: '2x4 studs for framing',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
