import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SubcontractorDocumentType {
  INSURANCE = 'insurance',
  AGREEMENT = 'agreement',
  COI = 'coi',
  CONTRACT = 'contract',
  LICENSE = 'license',
  OTHER = 'other',
}

export class UploadSubcontractorDocumentDto {
  // File field from multipart/form-data — handled by @UploadedFile() decorator
  @IsOptional()
  file?: any;

  @ApiProperty({
    description: 'Document type',
    enum: SubcontractorDocumentType,
    example: SubcontractorDocumentType.COI,
  })
  @IsEnum(SubcontractorDocumentType)
  document_type: SubcontractorDocumentType;

  @ApiPropertyOptional({
    description: 'Description of the document',
    example: 'Certificate of Insurance 2026',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;
}
