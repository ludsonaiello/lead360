import { ApiPropertyOptional } from '@nestjs/swagger';
import { TemplateResponseDto } from './template-response.dto';
import { CategoryResponseDto } from './category-response.dto';
import { UserBasicInfoDto } from './user-basic-info.dto';
import { TemplateBasicInfoDto } from './template-basic-info.dto';

export class TemplateDetailResponseDto extends TemplateResponseDto {
  @ApiPropertyOptional({
    description: 'Category details (included if category_id is not null)',
    type: () => CategoryResponseDto,
  })
  category?: CategoryResponseDto;

  @ApiPropertyOptional({
    description:
      'Creator user details (included if created_by_user_id is not null)',
    type: () => UserBasicInfoDto,
  })
  created_by_user?: UserBasicInfoDto;

  @ApiPropertyOptional({
    description:
      'Source template basic info (included if source_template_id is not null)',
    type: () => TemplateBasicInfoDto,
  })
  source_template?: TemplateBasicInfoDto;
}
