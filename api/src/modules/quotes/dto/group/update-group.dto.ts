import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, Length } from 'class-validator';

export class UpdateGroupDto {
  @ApiPropertyOptional({
    example: 'Flooring Materials - Updated',
    description: 'Group name',
  })
  @IsString()
  @IsOptional()
  @Length(1, 200)
  name?: string;

  @ApiPropertyOptional({
    example: 'All materials related to flooring installation',
    description: 'Group description',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
