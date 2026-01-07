import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AccessShareLinkDto {
  @ApiPropertyOptional({
    description: 'Password to access the share link (if password-protected)',
    example: 'SecurePass123!',
  })
  @IsString()
  @IsOptional()
  password?: string;
}
