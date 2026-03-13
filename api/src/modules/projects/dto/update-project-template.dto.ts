import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateProjectTemplateDto } from './create-project-template.dto';

export class UpdateProjectTemplateDto extends PartialType(CreateProjectTemplateDto) {
  @ApiPropertyOptional({ description: 'Whether the template is active', example: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
