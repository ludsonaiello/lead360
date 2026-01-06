import { IsString, IsOptional, IsEnum, IsUUID, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAuditLogDto {
  @ApiPropertyOptional({
    description: 'Tenant ID (auto-injected, do not send from client)',
    example: 'tenant-uuid-123',
  })
  @IsUUID()
  @IsOptional()
  tenant_id?: string;

  @ApiPropertyOptional({
    description: 'User ID who performed the action (auto-injected)',
    example: 'user-uuid-456',
  })
  @IsUUID()
  @IsOptional()
  actor_user_id?: string;

  @ApiProperty({
    description: 'Type of actor performing the action',
    example: 'user',
    enum: ['user', 'system', 'platform_admin', 'cron_job'],
  })
  @IsEnum(['user', 'system', 'platform_admin', 'cron_job'])
  actor_type: string;

  @ApiProperty({
    description: 'Type of entity being acted upon',
    example: 'tenant',
  })
  @IsString()
  entity_type: string;

  @ApiProperty({
    description: 'ID of the entity being acted upon',
    example: 'entity-uuid-789',
  })
  @IsString()
  entity_id: string;

  @ApiProperty({
    description: 'Human-readable description of the action',
    example: 'Updated business profile - legal name changed',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Type of action performed',
    example: 'updated',
    enum: ['created', 'updated', 'deleted', 'accessed', 'failed'],
  })
  @IsEnum(['created', 'updated', 'deleted', 'accessed', 'failed'])
  action_type: string;

  @ApiPropertyOptional({
    description: 'State before the change (for updates/deletes)',
    example: { legal_name: 'ABC Painting Inc' },
  })
  @IsObject()
  @IsOptional()
  before_json?: object;

  @ApiPropertyOptional({
    description: 'State after the change (for creates/updates)',
    example: { legal_name: 'ABC Painting LLC' },
  })
  @IsObject()
  @IsOptional()
  after_json?: object;

  @ApiPropertyOptional({
    description: 'Additional metadata as JSON',
    example: { fields_changed: ['legal_name'], change_reason: 'Legal entity conversion' },
  })
  @IsObject()
  @IsOptional()
  metadata_json?: object;

  @ApiPropertyOptional({
    description: 'IP address of the actor',
    example: '192.168.1.1',
  })
  @IsString()
  @IsOptional()
  ip_address?: string;

  @ApiPropertyOptional({
    description: 'User agent string',
    example: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
  })
  @IsString()
  @IsOptional()
  user_agent?: string;

  @ApiProperty({
    description: 'Status of the action',
    example: 'success',
    enum: ['success', 'failure'],
    default: 'success',
  })
  @IsEnum(['success', 'failure'])
  @IsOptional()
  status?: string = 'success';

  @ApiPropertyOptional({
    description: 'Error message (only for failed actions)',
    example: 'Permission denied: insufficient privileges',
  })
  @IsString()
  @IsOptional()
  error_message?: string;
}
