import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BypassApprovalDto {
  @ApiProperty({
    description:
      'Required reason for bypassing approval process (minimum 10 characters)',
    example: 'Emergency project - customer needs quote ASAP',
    minLength: 10,
    maxLength: 500,
  })
  @IsString()
  @MinLength(10, {
    message: 'reason required for bypassing approval (minimum 10 characters)',
  })
  @MaxLength(500, { message: 'reason must be at most 500 characters' })
  reason: string;
}
