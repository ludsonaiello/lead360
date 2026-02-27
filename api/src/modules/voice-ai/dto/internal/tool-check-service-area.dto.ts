import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckServiceAreaToolDto {
  @ApiProperty({ example: '01420', description: 'ZIP code to check' })
  @IsString()
  @IsNotEmpty()
  zip_code: string;

  @ApiPropertyOptional({ example: 'Fitchburg' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'MA' })
  @IsString()
  @IsOptional()
  state?: string;
}

export class CheckServiceAreaToolResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  in_service_area: boolean;

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional()
  error?: string;
}
