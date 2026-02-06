import { ApiPropertyOptional } from '@nestjs/swagger';
import { ComponentResponseDto } from './component-response.dto';
import { UserBasicInfoDto } from './user-basic-info.dto';

export class ComponentDetailResponseDto extends ComponentResponseDto {
  @ApiPropertyOptional({
    description:
      'Creator user details (included if created_by_user_id is not null)',
    type: () => UserBasicInfoDto,
  })
  created_by_user?: UserBasicInfoDto;
}
