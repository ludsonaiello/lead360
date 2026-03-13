import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubcontractorContactDto {
  @ApiProperty({
    description: 'Contact name',
    example: 'Mike Johnson',
    maxLength: 200,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  contact_name: string;

  @ApiProperty({
    description: 'Phone number',
    example: '555-0101',
    maxLength: 20,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  phone: string;

  @ApiPropertyOptional({
    description: 'Role or title',
    example: 'Owner',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'mike@abc-electrical.com',
  })
  @IsEmail()
  @MaxLength(255)
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Whether this is the primary contact',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  is_primary?: boolean;
}
