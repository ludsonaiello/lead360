import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateCrewMemberDto } from './create-crew-member.dto';

export class UpdateCrewMemberDto extends PartialType(CreateCrewMemberDto) {
  @ApiPropertyOptional({
    description: 'Whether the crew member is active (soft deactivation)',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
