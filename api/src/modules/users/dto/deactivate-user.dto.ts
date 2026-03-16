import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DeactivateUserDto {
  @ApiPropertyOptional({ example: 'User left the company' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
