import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferCallToolDto {
  @ApiProperty({ example: 'Customer requested to speak with a person' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({ example: 'sales', description: 'Department: sales, support, etc.' })
  @IsString()
  @IsOptional()
  destination?: string;
}

export class TransferCallToolResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiPropertyOptional()
  transfer_to?: string;

  @ApiPropertyOptional()
  label?: string;

  @ApiPropertyOptional()
  reason?: string;

  @ApiPropertyOptional()
  action?: string; // 'TRANSFER'

  @ApiPropertyOptional()
  error?: string;
}
