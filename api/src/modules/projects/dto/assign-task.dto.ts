import {
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AssigneeTypeEnum {
  crew_member = 'crew_member',
  subcontractor = 'subcontractor',
  user = 'user',
}

export class AssignTaskDto {
  @ApiProperty({
    enum: AssigneeTypeEnum,
    description: 'Type of assignee',
    example: 'crew_member',
  })
  @IsEnum(AssigneeTypeEnum)
  assignee_type: AssigneeTypeEnum;

  @ApiPropertyOptional({
    description: 'Crew member UUID — required when assignee_type = crew_member',
  })
  @ValidateIf((o) => o.assignee_type === AssigneeTypeEnum.crew_member)
  @IsUUID()
  @IsOptional()
  crew_member_id?: string;

  @ApiPropertyOptional({
    description:
      'Subcontractor UUID — required when assignee_type = subcontractor',
  })
  @ValidateIf((o) => o.assignee_type === AssigneeTypeEnum.subcontractor)
  @IsUUID()
  @IsOptional()
  subcontractor_id?: string;

  @ApiPropertyOptional({
    description: 'User UUID — required when assignee_type = user',
  })
  @ValidateIf((o) => o.assignee_type === AssigneeTypeEnum.user)
  @IsUUID()
  @IsOptional()
  user_id?: string;
}
