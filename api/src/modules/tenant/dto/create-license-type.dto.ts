import { IsString, IsBoolean, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLicenseTypeDto {
  @ApiProperty({
    description: 'License type name',
    example: 'General Contractor License',
  })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({
    description: 'License type description',
    example: 'Required for general construction work',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Is this license type active?',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
