import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidateHandlebarsDto {
  @ApiProperty({ description: 'Handlebars HTML content to validate', example: '<div>{{quote.total}}</div>' })
  @IsString()
  html_content: string;

  @ApiPropertyOptional({ description: 'CSS content to validate (optional)', example: 'div { color: red; }' })
  @IsString()
  @IsOptional()
  css_content?: string;
}
