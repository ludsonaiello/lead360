import {
  IsOptional,
  IsString,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccountMappingQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by platform',
    enum: ['quickbooks', 'xero'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['quickbooks', 'xero'])
  platform?: 'quickbooks' | 'xero';
}

export class AccountMappingDefaultsQueryDto {
  @ApiProperty({
    description: 'Target platform (required)',
    enum: ['quickbooks', 'xero'],
    example: 'quickbooks',
  })
  @IsString()
  @IsIn(['quickbooks', 'xero'], { message: 'platform must be quickbooks or xero' })
  platform: 'quickbooks' | 'xero';
}
