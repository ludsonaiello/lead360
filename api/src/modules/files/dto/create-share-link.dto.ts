import { IsOptional, IsString, IsInt, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShareLinkDto {
  @ApiProperty({
    description: 'File ID to share',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  file_id: string;

  @ApiPropertyOptional({
    description: 'Password to protect the share link (optional)',
    example: 'SecurePass123!',
  })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({
    description: 'Expiration date/time for the share link (ISO 8601)',
    example: '2026-12-31T23:59:59Z',
  })
  @IsDateString()
  @IsOptional()
  expires_at?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of downloads allowed (optional)',
    example: 10,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  max_downloads?: number;
}
