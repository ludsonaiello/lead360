import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompareVersionsDto {
  @ApiProperty({
    description: 'Source version number (from)',
    example: '1.0',
  })
  @IsString()
  from_version: string;

  @ApiProperty({
    description: 'Target version number (to)',
    example: '1.5',
  })
  @IsString()
  to_version: string;
}
