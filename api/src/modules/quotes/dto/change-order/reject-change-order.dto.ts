import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * RejectChangeOrderDto
 *
 * Request to reject/deny a change order
 */
export class RejectChangeOrderDto {
  @ApiProperty({
    description: 'REQUIRED: Reason for rejection',
    example: 'Customer declined additional cost - staying with original scope',
  })
  @IsString()
  @MinLength(10, { message: 'Rejection reason must be at least 10 characters' })
  reason: string;
}
