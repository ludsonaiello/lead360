import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsHexColor, MinLength, MaxLength } from 'class-validator';

/**
 * CreateQuoteTagDto
 *
 * Creates a new quote tag for organizing and categorizing quotes
 *
 * @author Backend Developer
 */
export class CreateQuoteTagDto {
  @ApiProperty({
    description: 'Tag name',
    example: 'High Priority',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Tag color in hex format',
    example: '#FF5733',
    pattern: '^#[0-9A-Fa-f]{6}$',
  })
  @IsString()
  @IsHexColor()
  color: string;
}
