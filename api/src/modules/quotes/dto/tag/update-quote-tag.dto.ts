import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsHexColor,
  IsOptional,
  MinLength,
  MaxLength,
  IsBoolean,
} from 'class-validator';

/**
 * UpdateQuoteTagDto
 *
 * Updates an existing quote tag
 *
 * @author Backend Developer
 */
export class UpdateQuoteTagDto {
  @ApiPropertyOptional({
    description: 'Tag name',
    example: 'High Priority',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Tag color in hex format',
    example: '#FF5733',
    pattern: '^#[0-9A-Fa-f]{6}$',
  })
  @IsOptional()
  @IsString()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({
    description: 'Active status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
