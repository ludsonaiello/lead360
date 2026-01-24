import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional } from 'class-validator';

export enum QuoteStatus {
  DRAFT = 'draft',
  READY = 'ready',
  SENT = 'sent',
  READ = 'read',
  APPROVED = 'approved',
  DENIED = 'denied',
  LOST = 'lost',
}

export class UpdateQuoteStatusDto {
  @ApiProperty({
    enum: QuoteStatus,
    example: QuoteStatus.READY,
    description:
      'New quote status (must follow valid transitions: draft→ready→sent→read→approved/denied/lost)',
  })
  @IsEnum(QuoteStatus)
  status: QuoteStatus;

  @ApiPropertyOptional({
    example: 'Customer requested changes',
    description: 'Optional reason for status change (logged in version history)',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
