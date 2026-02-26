import {
  IsString,
  IsIn,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  IsInt,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTransferNumberDto {
  @ApiProperty({
    description: 'Human-readable label for this transfer destination',
    example: 'Sales',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;

  @ApiProperty({
    description: 'Phone number in E.164 format',
    example: '+15551234567',
  })
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'Phone must be in E.164 format (+15551234567)',
  })
  phone_number: string;

  @ApiPropertyOptional({
    description: 'Category of this transfer destination',
    enum: ['primary', 'overflow', 'after_hours', 'emergency'],
    default: 'primary',
  })
  @IsOptional()
  @IsString()
  @IsIn(['primary', 'overflow', 'after_hours', 'emergency'])
  transfer_type?: string;

  @ApiPropertyOptional({
    description: 'Optional description of when to use this number',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether this is the default transfer number for the tenant',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @ApiPropertyOptional({
    description:
      'JSON string defining availability windows per day. ' +
      'Example: {"mon":[["09:00","17:00"]],"tue":[["09:00","17:00"]]}. ' +
      'Null means always available.',
    example: '{"mon":[["09:00","17:00"]],"fri":[["09:00","12:00"]]}',
  })
  @IsOptional()
  @IsString()
  available_hours?: string;

  @ApiPropertyOptional({
    description:
      'Sort order in the UI — lower value = higher priority. Default 0.',
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  display_order?: number;
}
