import { IsString, IsOptional, IsUUID, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePunchListItemDto {
  @ApiPropertyOptional({
    description: 'New status for the punch list item',
    enum: ['open', 'in_progress', 'resolved'],
    example: 'resolved',
  })
  @IsString()
  @IsIn(['open', 'in_progress', 'resolved'])
  @IsOptional()
  status?: 'open' | 'in_progress' | 'resolved';

  @ApiPropertyOptional({
    description: 'Updated description',
    example: 'Paint fully stripped and recoated with primer + two finish coats',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Re-assign to a different crew member',
    example: 'c1d2e3f4-a5b6-7890-cdef-123456789012',
  })
  @IsUUID()
  @IsOptional()
  assigned_to_crew_id?: string;
}
