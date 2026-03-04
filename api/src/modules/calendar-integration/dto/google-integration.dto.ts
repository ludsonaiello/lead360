import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsUrl,
} from 'class-validator';

/**
 * Response DTO for Google OAuth authorization URL generation
 */
export class GoogleAuthUrlResponseDto {
  @ApiProperty({
    description: 'Google OAuth consent screen URL',
    example:
      'https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&response_type=code&scope=...&state=uuid',
  })
  @IsUrl()
  authUrl: string;

  @ApiProperty({
    description:
      'State parameter for CSRF protection (stored in session for verification)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  state: string;
}

/**
 * Query parameters received in OAuth callback
 */
export class GoogleOAuthCallbackQueryDto {
  @ApiProperty({
    description: 'Authorization code from Google OAuth',
    example: '4/0AQlEd8yV...',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: 'State parameter for CSRF validation',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiPropertyOptional({
    description: 'Error code if OAuth failed',
    example: 'access_denied',
  })
  @IsString()
  @IsOptional()
  error?: string;

  @ApiPropertyOptional({
    description: 'Issuer (Google OAuth server)',
    example: 'https://accounts.google.com',
  })
  @IsString()
  @IsOptional()
  iss?: string;

  @ApiPropertyOptional({
    description: 'Granted OAuth scopes (space-separated)',
    example: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
  })
  @IsString()
  @IsOptional()
  scope?: string;
}

/**
 * Response DTO for OAuth callback (success)
 */
export class GoogleOAuthCallbackResponseDto {
  @ApiProperty({
    description: 'Callback status',
    example: 'success',
  })
  @IsString()
  status: string;

  @ApiProperty({
    description: 'Message for the user',
    example: 'Google Calendar connection authorized. Please select a calendar.',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description:
      'URL to redirect to for calendar selection (frontend route)',
    example: '/settings/calendar/select-calendar',
  })
  @IsString()
  nextStep: string;
}

/**
 * DTO representing a Google Calendar in the list
 */
export class GoogleCalendarItemDto {
  @ApiProperty({
    description: 'Calendar ID',
    example: 'primary',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Calendar display name',
    example: 'My Calendar',
  })
  @IsString()
  summary: string;

  @ApiPropertyOptional({
    description: 'Calendar description',
    example: 'Personal calendar',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Whether this is the primary calendar',
    example: true,
  })
  @IsBoolean()
  primary: boolean;

  @ApiPropertyOptional({
    description: 'Calendar timezone',
    example: 'America/New_York',
  })
  @IsString()
  @IsOptional()
  timeZone?: string;

  @ApiPropertyOptional({
    description: 'Background color',
    example: '#9fe1e7',
  })
  @IsString()
  @IsOptional()
  backgroundColor?: string;
}

/**
 * Response DTO for listing available Google Calendars
 */
export class GoogleCalendarListResponseDto {
  @ApiProperty({
    description: 'List of available calendars',
    type: [GoogleCalendarItemDto],
  })
  calendars: GoogleCalendarItemDto[];

  @ApiProperty({
    description: 'Total number of calendars',
    example: 3,
  })
  total: number;
}

/**
 * Request DTO for finalizing calendar connection
 */
export class ConnectGoogleCalendarDto {
  @ApiProperty({
    description: 'Google Calendar ID to connect',
    example: 'primary',
  })
  @IsString()
  @IsNotEmpty()
  calendarId: string;

  @ApiPropertyOptional({
    description: 'Calendar display name (optional - auto-fetched if not provided)',
    example: 'My Calendar',
  })
  @IsString()
  @IsOptional()
  calendarName?: string;
}

/**
 * Response DTO for connection finalization
 */
export class ConnectGoogleCalendarResponseDto {
  @ApiProperty({
    description: 'Connection ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Connection status',
    example: 'success',
  })
  @IsString()
  status: string;

  @ApiProperty({
    description: 'Message for the user',
    example: 'Google Calendar connected successfully.',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Connected calendar ID',
    example: 'primary',
  })
  @IsString()
  connectedCalendarId: string;

  @ApiProperty({
    description: 'Connected calendar name',
    example: 'My Calendar',
  })
  @IsString()
  connectedCalendarName: string;

  @ApiProperty({
    description: 'Provider type',
    example: 'google_calendar',
  })
  @IsString()
  providerType: string;
}

/**
 * Response DTO for connection status
 */
export class CalendarConnectionStatusDto {
  @ApiProperty({
    description: 'Whether a calendar is connected',
    example: true,
  })
  @IsBoolean()
  connected: boolean;

  @ApiPropertyOptional({
    description: 'Provider type (if connected)',
    example: 'google_calendar',
  })
  @IsString()
  @IsOptional()
  providerType?: string;

  @ApiPropertyOptional({
    description: 'Connected calendar ID',
    example: 'primary',
  })
  @IsString()
  @IsOptional()
  connectedCalendarId?: string;

  @ApiPropertyOptional({
    description: 'Connected calendar name',
    example: 'My Calendar',
  })
  @IsString()
  @IsOptional()
  connectedCalendarName?: string;

  @ApiPropertyOptional({
    description: 'Current sync status',
    example: 'active',
  })
  @IsString()
  @IsOptional()
  syncStatus?: string;

  @ApiPropertyOptional({
    description: 'Last successful sync timestamp',
    example: '2026-03-03T10:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  lastSyncAt?: string;

  @ApiPropertyOptional({
    description: 'Error message if sync status is error',
    example: null,
  })
  @IsString()
  @IsOptional()
  errorMessage?: string;

  @ApiPropertyOptional({
    description: 'Connection creation timestamp',
    example: '2026-03-01T15:30:00Z',
  })
  @IsDateString()
  @IsOptional()
  createdAt?: string;
}

/**
 * Response DTO for disconnect operation
 */
export class DisconnectCalendarResponseDto {
  @ApiProperty({
    description: 'Operation status',
    example: 'success',
  })
  @IsString()
  status: string;

  @ApiProperty({
    description: 'Message for the user',
    example: 'Google Calendar disconnected successfully.',
  })
  @IsString()
  message: string;
}

/**
 * Response DTO for manual sync trigger
 */
export class TriggerSyncResponseDto {
  @ApiProperty({
    description: 'Operation status',
    example: 'success',
  })
  @IsString()
  status: string;

  @ApiProperty({
    description: 'Message for the user',
    example: 'Manual sync has been queued. This may take a few moments.',
  })
  @IsString()
  message: string;
}

/**
 * Response DTO for connection test
 */
export class TestConnectionResponseDto {
  @ApiProperty({
    description: 'Test status',
    example: 'success',
  })
  @IsString()
  status: string;

  @ApiProperty({
    description: 'Test result message',
    example: 'Connection is healthy. Successfully retrieved calendar metadata.',
  })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'Additional test details',
    example: { calendarId: 'primary', timezone: 'America/New_York' },
  })
  @IsOptional()
  details?: Record<string, any>;
}

/**
 * Response DTO for health check endpoint
 * Sprint 16: Health Monitoring
 */
export class CalendarHealthResponseDto {
  @ApiProperty({
    description: 'Whether the calendar connection is active',
    example: true,
  })
  @IsBoolean()
  connected: boolean;

  @ApiProperty({
    description: 'Current sync status',
    example: 'active',
    enum: ['active', 'inactive', 'error'],
  })
  @IsString()
  syncStatus: string;

  @ApiPropertyOptional({
    description: 'Timestamp of the last successful sync',
    example: '2026-03-02T10:30:00Z',
  })
  @IsDateString()
  @IsOptional()
  lastSyncAt?: string;

  @ApiPropertyOptional({
    description: 'Webhook channel expiration timestamp',
    example: '2026-03-09T10:30:00Z',
  })
  @IsDateString()
  @IsOptional()
  webhookExpiration?: string;

  @ApiProperty({
    description: 'Number of failed sync operations in the last 24 hours',
    example: 0,
  })
  recentErrors: number;

  @ApiProperty({
    description: 'Number of successful sync operations in the last 24 hours',
    example: 125,
  })
  recentSuccesses: number;
}

/**
 * Single sync log entry
 * Sprint 16: Sync Logs
 */
export class SyncLogEntryDto {
  @ApiProperty({
    description: 'Sync log ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Connection ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsString()
  connectionId: string;

  @ApiProperty({
    description: 'Sync direction',
    example: 'outbound',
    enum: ['outbound', 'inbound'],
  })
  @IsString()
  direction: string;

  @ApiProperty({
    description: 'Sync action type',
    example: 'event_created',
  })
  @IsString()
  action: string;

  @ApiPropertyOptional({
    description: 'Appointment ID (if applicable)',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsString()
  @IsOptional()
  appointmentId?: string | null;

  @ApiPropertyOptional({
    description: 'External Google Calendar event ID',
    example: 'abc123xyz',
  })
  @IsString()
  @IsOptional()
  externalEventId?: string | null;

  @ApiProperty({
    description: 'Sync status',
    example: 'success',
    enum: ['success', 'failed', 'skipped'],
  })
  @IsString()
  status: string;

  @ApiPropertyOptional({
    description: 'Error message (if failed)',
    example: null,
  })
  @IsString()
  @IsOptional()
  errorMessage?: string | null;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { htmlLink: 'https://calendar.google.com/...' },
  })
  @IsOptional()
  metadata?: any;

  @ApiProperty({
    description: 'Timestamp when the sync occurred',
    example: '2026-03-03T10:00:00Z',
  })
  @IsDateString()
  createdAt: string;
}

/**
 * Pagination metadata
 * Sprint 16: Sync Logs
 */
export class PaginationMetadataDto {
  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 50,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of items',
    example: 234,
  })
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 5,
  })
  totalPages: number;
}

/**
 * Response DTO for paginated sync logs
 * Sprint 16: Sync Logs
 */
export class SyncLogsResponseDto {
  @ApiProperty({
    description: 'Array of sync log entries',
    type: [SyncLogEntryDto],
  })
  data: SyncLogEntryDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetadataDto,
  })
  pagination: PaginationMetadataDto;
}
