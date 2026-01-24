import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, Length } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({
    example: 'Flooring Materials',
    description: 'Group name',
  })
  @IsString()
  @Length(1, 200)
  name: string;

  @ApiPropertyOptional({
    example: 'All materials related to flooring installation',
    description: 'Group description (optional)',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
