import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsBoolean,
  IsArray,
  IsUUID,
  IsOptional,
  MaxLength,
} from 'class-validator';

export enum NotificationRecipientType {
  OWNER = 'owner',
  ASSIGNED_USER = 'assigned_user',
  SPECIFIC_USERS = 'specific_users',
  ALL_USERS = 'all_users',
}

/**
 * DTO for creating notification rule
 */
export class CreateNotificationRuleDto {
  @ApiProperty({
    description: 'Event type that triggers notification',
    example: 'lead_created',
  })
  @IsString()
  event_type: string;

  @ApiProperty({
    description: 'Send in-app notification',
    example: true,
  })
  @IsBoolean()
  notify_in_app: boolean;

  @ApiProperty({
    description: 'Send email notification',
    example: false,
  })
  @IsBoolean()
  notify_email: boolean;

  @ApiPropertyOptional({
    description: 'Email template key (required if notify_email is true)',
    example: 'lead-created',
  })
  @IsString()
  @IsOptional()
  email_template_key?: string;

  @ApiProperty({
    description: 'Who should receive the notification',
    enum: NotificationRecipientType,
    example: NotificationRecipientType.ALL_USERS,
  })
  @IsEnum(NotificationRecipientType)
  recipient_type: NotificationRecipientType;

  @ApiPropertyOptional({
    description: 'Specific user IDs (required if recipient_type is specific_users)',
    example: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  specific_user_ids?: string[];

  @ApiProperty({
    description: 'Whether rule is active',
    example: true,
  })
  @IsBoolean()
  is_active: boolean;
}

/**
 * DTO for updating notification rule
 */
export class UpdateNotificationRuleDto {
  @ApiPropertyOptional({
    description: 'Send in-app notification',
  })
  @IsBoolean()
  @IsOptional()
  notify_in_app?: boolean;

  @ApiPropertyOptional({
    description: 'Send email notification',
  })
  @IsBoolean()
  @IsOptional()
  notify_email?: boolean;

  @ApiPropertyOptional({
    description: 'Email template key',
  })
  @IsString()
  @IsOptional()
  email_template_key?: string;

  @ApiPropertyOptional({
    description: 'Who should receive the notification',
    enum: NotificationRecipientType,
  })
  @IsEnum(NotificationRecipientType)
  @IsOptional()
  recipient_type?: NotificationRecipientType;

  @ApiPropertyOptional({
    description: 'Specific user IDs',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  specific_user_ids?: string[];

  @ApiPropertyOptional({
    description: 'Whether rule is active',
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

/**
 * DTO for creating manual notification (for testing)
 */
export class CreateNotificationDto {
  @ApiProperty({
    description: 'Notification type',
    example: 'info',
  })
  @IsString()
  type: string;

  @ApiProperty({
    description: 'Notification title',
    example: 'New Lead Created',
  })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({
    description: 'Notification message',
    example: 'John Doe submitted a service request',
  })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'Action URL (where to navigate when clicked)',
    example: '/leads/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  @IsOptional()
  action_url?: string;

  @ApiPropertyOptional({
    description: 'Related entity type',
    example: 'lead',
  })
  @IsString()
  @IsOptional()
  related_entity_type?: string;

  @ApiPropertyOptional({
    description: 'Related entity ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  @IsOptional()
  related_entity_id?: string;

  @ApiPropertyOptional({
    description: 'User ID (null = broadcast to all users)',
  })
  @IsUUID()
  @IsOptional()
  user_id?: string;
}

/**
 * DTO for listing notifications
 */
export class ListNotificationsDto {
  @ApiPropertyOptional({
    description: 'Filter by read status',
  })
  @IsBoolean()
  @IsOptional()
  is_read?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by notification type',
  })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({
    description: 'Limit number of results',
    example: 20,
  })
  @IsOptional()
  limit?: number;
}
