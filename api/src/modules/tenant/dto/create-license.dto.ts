import {
  IsString,
  IsOptional,
  IsDateString,
  Length,
  Matches,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateLicenseDto {
  @ApiPropertyOptional({
    description: 'License type ID (null if "Other")',
    example: 'uuid-of-license-type',
  })
  @IsUUID()
  @IsOptional()
  license_type_id?: string;

  @ApiPropertyOptional({
    description: 'Custom license type (if license_type_id is null)',
    example: 'Custom Contractor License',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  custom_license_type?: string;

  @ApiProperty({
    description: 'License number',
    example: 'LIC-123456',
  })
  @IsString()
  @Length(1, 100)
  license_number: string;

  @ApiProperty({
    description: 'Issuing state (2-letter code)',
    example: 'CA',
  })
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, { message: 'Must be a valid 2-letter state code' })
  @Transform(({ value }) => value?.toUpperCase())
  issuing_state: string;

  @ApiPropertyOptional({
    description: 'Issue date',
    example: '2020-01-15',
  })
  @IsDateString()
  @IsOptional()
  issue_date?: string;

  @ApiProperty({
    description: 'Expiry date',
    example: '2025-01-15',
  })
  @IsDateString()
  expiry_date: string;

  @ApiPropertyOptional({
    description: 'Document file ID',
    example: 'file-uuid',
  })
  @IsString()
  @IsOptional()
  document_file_id?: string;
}
