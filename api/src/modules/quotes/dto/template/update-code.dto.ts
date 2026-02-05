import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCodeDto {
  @ApiPropertyOptional({ description: 'Updated Handlebars HTML content', example: '<div>Updated HTML</div>' })
  @IsString()
  @IsOptional()
  html_content?: string;

  @ApiPropertyOptional({ description: 'Updated CSS styles', example: 'body { color: #333; }' })
  @IsString()
  @IsOptional()
  css_content?: string;

  @ApiPropertyOptional({
    description: 'Summary of changes (for version history)',
    example: 'Updated header styling and added footer section',
    maxLength: 500
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  changes_summary?: string;
}
