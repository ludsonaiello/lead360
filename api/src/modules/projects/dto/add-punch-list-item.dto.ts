import { IsString, IsOptional, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddPunchListItemDto {
  @ApiProperty({
    description: 'Punch list item title',
    example: 'Touch up paint on trim',
    maxLength: 300,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the deficiency',
    example: 'Paint chipping on north-side window trim, needs scraping and two coats',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Crew member UUID to assign this item to',
    example: 'c1d2e3f4-a5b6-7890-cdef-123456789012',
  })
  @IsUUID()
  @IsOptional()
  assigned_to_crew_id?: string;
}
