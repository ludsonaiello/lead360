import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

/**
 * ApproveChangeOrderDto
 *
 * Request to approve a change order
 */
export class ApproveChangeOrderDto {
  @ApiPropertyOptional({
    description: 'Optional approval notes',
    example: 'Approved by project owner - proceed with additional work',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
