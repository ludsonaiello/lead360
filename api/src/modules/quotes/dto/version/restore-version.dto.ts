import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RestoreVersionDto {
  @ApiProperty({
    description: 'Optional reason for restoring this version',
    example: 'Reverting accidental changes',
    required: false,
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  reason?: string;
}
