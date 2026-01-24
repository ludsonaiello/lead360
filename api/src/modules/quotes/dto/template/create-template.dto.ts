import {
  IsString,
  IsBoolean,
  IsOptional,
  IsUUID,
  Length,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Modern Professional Quote' })
  @IsString()
  @Length(1, 200)
  name: string;

  @ApiPropertyOptional({ example: 'Clean modern design with company branding' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '<html>...</html>' })
  @IsString()
  @MinLength(1)
  html_content: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/thumb.png' })
  @IsString()
  @IsOptional()
  thumbnail_url?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716' })
  @IsUUID()
  @IsOptional()
  tenant_id?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  is_global?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  is_default?: boolean;
}
