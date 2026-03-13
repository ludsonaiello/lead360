import {
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum ProjectDocumentType {
  CONTRACT = 'contract',
  PERMIT = 'permit',
  BLUEPRINT = 'blueprint',
  AGREEMENT = 'agreement',
  PHOTO = 'photo',
  OTHER = 'other',
}

export class UploadProjectDocumentDto {
  // File field from multipart/form-data — handled by @UploadedFile() decorator
  @IsOptional()
  file?: any;

  @ApiProperty({
    description: 'Document type',
    enum: ProjectDocumentType,
    example: ProjectDocumentType.CONTRACT,
  })
  @IsEnum(ProjectDocumentType)
  document_type: ProjectDocumentType;

  @ApiPropertyOptional({
    description: 'Description of the document',
    example: 'Signed contract for roofing project',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether this document is visible on the customer portal',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  is_public?: boolean;
}
