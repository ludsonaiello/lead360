import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional } from 'class-validator';

export enum QuoteStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  READY = 'ready',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  OPENED = 'opened',
  DOWNLOADED = 'downloaded',
  APPROVED = 'approved',
  STARTED = 'started',
  CONCLUDED = 'concluded',
  DENIED = 'denied',
  LOST = 'lost',
  EMAIL_FAILED = 'email_failed',
}

export class UpdateQuoteStatusDto {
  @ApiProperty({
    enum: QuoteStatus,
    example: QuoteStatus.READY,
    description:
      'New quote status. Valid transitions: draft→pending_approval→ready→sent→delivered→opened→read→downloaded→approved→started→concluded. Also: approved/denied/lost from sent/read/downloaded. Email events: opened (email opened), read (public URL viewed), downloaded (PDF downloaded), delivered, email_failed.',
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
