import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class StartCompletionDto {
  @ApiPropertyOptional({
    description: 'Checklist template ID to copy items from (optional — omit for empty checklist)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  @IsOptional()
  template_id?: string;
}
