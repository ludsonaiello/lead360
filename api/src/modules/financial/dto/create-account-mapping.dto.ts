import {
  IsString,
  IsUUID,
  IsOptional,
  IsIn,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAccountMappingDto {
  @ApiProperty({
    description: 'Financial category ID to map',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID()
  category_id: string;

  @ApiProperty({
    description: 'Target accounting platform',
    enum: ['quickbooks', 'xero'],
    example: 'quickbooks',
  })
  @IsString()
  @IsIn(['quickbooks', 'xero'], { message: 'platform must be quickbooks or xero' })
  platform: 'quickbooks' | 'xero';

  @ApiProperty({
    description: 'Account name as it appears in QB/Xero chart of accounts',
    example: 'Office Supplies',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty({ message: 'account_name must not be empty' })
  @MaxLength(200)
  account_name: string;

  @ApiPropertyOptional({
    description: 'Account code in QB/Xero (optional)',
    example: '6100',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  account_code?: string;
}
