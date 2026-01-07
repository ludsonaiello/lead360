import { IsEnum, IsOptional, IsUUID, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum FileCategory {
  QUOTE = 'quote',
  INVOICE = 'invoice',
  LICENSE = 'license',
  INSURANCE = 'insurance',
  LOGO = 'logo',
  CONTRACT = 'contract',
  RECEIPT = 'receipt',
  PHOTO = 'photo',
  REPORT = 'report',
  SIGNATURE = 'signature',
  MISC = 'misc',
}

export class UploadFileDto {
  @ApiProperty({
    description: 'File category',
    enum: FileCategory,
    example: FileCategory.MISC,
  })
  @IsEnum(FileCategory)
  category: FileCategory;

  @ApiPropertyOptional({
    description: 'Entity type this file is attached to',
    example: 'quote',
  })
  @IsString()
  @IsOptional()
  entity_type?: string;

  @ApiPropertyOptional({
    description: 'Entity ID this file is attached to',
    example: 'uuid-of-entity',
  })
  @IsUUID()
  @IsOptional()
  entity_id?: string;
}
