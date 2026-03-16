import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CompleteChecklistItemDto {
  @ApiPropertyOptional({
    description: 'Optional notes for this checklist item',
    example: 'Passed by Inspector Smith on 2026-06-14',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
