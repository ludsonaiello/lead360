import { ApiProperty } from '@nestjs/swagger';

/**
 * QuoteTagResponseDto
 *
 * Response format for quote tag data
 *
 * @author Backend Developer
 */
export class QuoteTagResponseDto {
  @ApiProperty({ description: 'Tag ID', example: 'tag-abc-123' })
  id: string;

  @ApiProperty({ description: 'Tag name', example: 'High Priority' })
  name: string;

  @ApiProperty({ description: 'Tag color (hex)', example: '#FF5733' })
  color: string;

  @ApiProperty({ description: 'Active status', example: true })
  is_active: boolean;

  @ApiProperty({ description: 'Number of quotes using this tag', example: 15 })
  usage_count?: number;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-01-24T10:00:00.000Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-01-24T10:00:00.000Z',
  })
  updated_at: Date;
}
