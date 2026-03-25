import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsIn,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExportExpenseQueryDto {
  @ApiProperty({
    description: 'Start of export period (required)',
    example: '2026-01-01',
  })
  @IsDateString()
  date_from: string;

  @ApiProperty({
    description: 'End of export period (required)',
    example: '2026-03-31',
  })
  @IsDateString()
  date_to: string;

  @ApiPropertyOptional({
    description: 'Filter to specific category',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by classification',
    enum: ['cost_of_goods_sold', 'operating_expense'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['cost_of_goods_sold', 'operating_expense'])
  classification?: string;

  @ApiPropertyOptional({
    description: 'Filter to project-linked entries',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({
    description: 'Include recurring instance entries (default false)',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  include_recurring?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include pending_review entries (default false)',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  include_pending?: boolean = false;
}
