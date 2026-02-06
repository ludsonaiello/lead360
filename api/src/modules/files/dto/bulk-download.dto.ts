import {
  IsArray,
  IsUUID,
  ArrayMinSize,
  IsString,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkDownloadDto {
  @ApiProperty({
    description: 'Array of file IDs to download',
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
    ],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  file_ids: string[];

  @ApiPropertyOptional({
    description: 'Name of the ZIP file (optional, defaults to "files.zip")',
    example: 'my_files.zip',
  })
  @IsString()
  @IsOptional()
  zip_name?: string;
}
