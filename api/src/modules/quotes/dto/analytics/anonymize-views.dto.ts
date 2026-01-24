import { ApiProperty } from '@nestjs/swagger';

/**
 * AnonymizeViewsResponseDto
 *
 * Response from anonymizing old view logs (GDPR compliance)
 */
export class AnonymizeViewsResponseDto {
  @ApiProperty({
    description: 'Number of view logs anonymized',
    example: 142,
  })
  anonymized_count: number;

  @ApiProperty({
    description: 'Timestamp when anonymization ran',
    example: '2024-01-20T10:30:00.000Z',
  })
  anonymized_at: string;

  @ApiProperty({
    description: 'Cutoff date (views older than this were anonymized)',
    example: '2023-10-22T00:00:00.000Z',
  })
  cutoff_date: string;
}
