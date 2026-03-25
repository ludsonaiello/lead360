import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectEntryDto {
  @ApiProperty({
    description: 'Reason for rejection (required — must explain why)',
    example: 'Receipt is illegible. Please re-upload a clearer photo.',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason is required' })
  @MaxLength(500)
  rejection_reason: string;
}
