import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'crypto';

/**
 * Service for interacting with Google Calendar API
 * Handles OAuth 2.0 flow and calendar operations
 */
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly oauth2Client: OAuth2Client;
  private readonly scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
  ];

  constructor(private readonly configService: ConfigService) {
    const clientId = this.configService.get<string>('GOOGLE_CALENDAR_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'GOOGLE_CALENDAR_CLIENT_SECRET',
    );
    const redirectUri = this.configService.get<string>(
      'GOOGLE_CALENDAR_REDIRECT_URL',
    );

    if (!clientId || !clientSecret || !redirectUri) {
      this.logger.error(
        'Google Calendar OAuth credentials not configured in environment variables',
      );
      throw new Error('Google Calendar OAuth credentials missing');
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );
  }

  /**
   * Generate Google OAuth authorization URL with CSRF state parameter
   * @param tenantId - Tenant ID for session state storage
   * @returns Authorization URL and state parameter
   */
  generateAuthUrl(tenantId: string): { authUrl: string; state: string } {
    const state = randomUUID();

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Request refresh token
      scope: this.scopes,
      state: `${tenantId}:${state}`, // Embed tenant ID in state
      prompt: 'consent', // Force consent screen to ensure refresh token
    });

    return { authUrl, state };
  }

  /**
   * Exchange authorization code for access and refresh tokens
   * @param code - Authorization code from OAuth callback
   * @returns Token response with access_token, refresh_token, and expiry
   */
  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiryDate: Date;
  }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Failed to obtain access or refresh token from Google');
      }

      const expiryDate = new Date(tokens.expiry_date || Date.now() + 3600 * 1000);

      this.logger.log('Successfully exchanged authorization code for tokens');

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate,
      };
    } catch (error) {
      this.logger.error('Failed to exchange authorization code', error.stack);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken - Refresh token
   * @returns New access token and expiry date
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiryDate: Date;
  }> {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
      }

      const expiryDate = new Date(credentials.expiry_date || Date.now() + 3600 * 1000);

      this.logger.log('Successfully refreshed access token');

      return {
        accessToken: credentials.access_token,
        expiryDate,
      };
    } catch (error) {
      this.logger.error('Failed to refresh access token', error.stack);
      throw new Error(
        'Failed to refresh access token. User may have revoked access.',
      );
    }
  }

  /**
   * List available calendars for the authenticated user
   * @param accessToken - Valid access token
   * @returns List of calendars
   */
  async listCalendars(accessToken: string): Promise<
    Array<{
      id: string;
      summary: string;
      description?: string;
      primary: boolean;
      timeZone?: string;
      backgroundColor?: string;
    }>
  > {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      const response = await calendar.calendarList.list();

      const calendars = response.data.items || [];

      return calendars.map((cal) => ({
        id: cal.id || '',
        summary: cal.summary || '',
        description: cal.description || undefined,
        primary: cal.primary || false,
        timeZone: cal.timeZone || undefined,
        backgroundColor: cal.backgroundColor || undefined,
      }));
    } catch (error) {
      this.logger.error('Failed to list calendars', error.stack);
      throw new Error('Failed to retrieve calendar list from Google');
    }
  }

  /**
   * Get calendar metadata (for connection testing)
   * @param accessToken - Valid access token
   * @param calendarId - Calendar ID
   * @returns Calendar metadata
   */
  async getCalendar(
    accessToken: string,
    calendarId: string,
  ): Promise<{
    id: string;
    summary: string;
    timeZone: string;
  }> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      const response = await calendar.calendars.get({ calendarId });

      return {
        id: response.data.id || '',
        summary: response.data.summary || '',
        timeZone: response.data.timeZone || 'UTC',
      };
    } catch (error) {
      this.logger.error('Failed to get calendar metadata', error.stack);
      throw new Error('Failed to retrieve calendar metadata from Google');
    }
  }

  /**
   * Create a watch channel for push notifications (webhooks)
   * @param accessToken - Valid access token
   * @param calendarId - Calendar ID to watch
   * @param webhookUrl - Webhook URL to receive notifications
   * @param channelToken - Verification token for webhook security
   * @returns Channel information
   */
  async createWatchChannel(
    accessToken: string,
    calendarId: string,
    webhookUrl: string,
    channelToken: string,
  ): Promise<{
    channelId: string;
    resourceId: string;
    expiration: Date;
  }> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const channelId = randomUUID();
      const expiration = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

      const response = await calendar.events.watch({
        calendarId,
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          token: channelToken,
          expiration: expiration.toString(),
        },
      });

      this.logger.log(
        `Created watch channel ${channelId} for calendar ${calendarId}`,
      );

      return {
        channelId,
        resourceId: response.data.resourceId || '',
        expiration: new Date(expiration),
      };
    } catch (error) {
      this.logger.error('Failed to create watch channel', error.stack);
      throw new Error('Failed to create Google Calendar watch channel');
    }
  }

  /**
   * Stop a watch channel (for disconnection)
   * @param accessToken - Valid access token
   * @param channelId - Channel ID to stop
   * @param resourceId - Resource ID of the channel
   */
  async stopWatchChannel(
    accessToken: string,
    channelId: string,
    resourceId: string,
  ): Promise<void> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      await calendar.channels.stop({
        requestBody: {
          id: channelId,
          resourceId,
        },
      });

      this.logger.log(`Stopped watch channel ${channelId}`);
    } catch (error) {
      // 404 is acceptable (channel already expired/stopped)
      if (error.code === 404) {
        this.logger.warn(`Watch channel ${channelId} not found (already stopped)`);
        return;
      }

      this.logger.error('Failed to stop watch channel', error.stack);
      throw new Error('Failed to stop Google Calendar watch channel');
    }
  }

  /**
   * Revoke OAuth tokens (for disconnection)
   * @param accessToken - Access token to revoke
   */
  async revokeToken(accessToken: string): Promise<void> {
    try {
      await this.oauth2Client.revokeToken(accessToken);
      this.logger.log('Successfully revoked Google Calendar access token');
    } catch (error) {
      this.logger.warn('Failed to revoke token (may already be revoked)', error.stack);
      // Don't throw - disconnection should proceed even if revocation fails
    }
  }

  /**
   * Create a calendar event
   * Sprint 12: Outbound Sync
   * @param accessToken - Valid access token
   * @param calendarId - Calendar ID
   * @param eventData - Event data
   * @returns Created event with ID
   */
  async createEvent(
    accessToken: string,
    calendarId: string,
    eventData: {
      summary: string;
      location?: string;
      description?: string;
      start: {
        dateTime: string;
        timeZone: string;
      };
      end: {
        dateTime: string;
        timeZone: string;
      };
    },
  ): Promise<{
    eventId: string;
    htmlLink: string;
  }> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const response = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: eventData.summary,
          location: eventData.location,
          description: eventData.description,
          start: eventData.start,
          end: eventData.end,
        },
      });

      this.logger.log(
        `Created Google Calendar event ${response.data.id} in calendar ${calendarId}`,
      );

      return {
        eventId: response.data.id || '',
        htmlLink: response.data.htmlLink || '',
      };
    } catch (error) {
      this.logger.error('Failed to create calendar event', error.stack);
      throw new Error('Failed to create Google Calendar event');
    }
  }

  /**
   * Update a calendar event
   * Sprint 12: Outbound Sync
   * @param accessToken - Valid access token
   * @param calendarId - Calendar ID
   * @param eventId - Event ID to update
   * @param eventData - Updated event data
   * @returns Updated event
   */
  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    eventData: {
      summary: string;
      location?: string;
      description?: string;
      start: {
        dateTime: string;
        timeZone: string;
      };
      end: {
        dateTime: string;
        timeZone: string;
      };
    },
  ): Promise<{
    eventId: string;
    htmlLink: string;
  }> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const response = await calendar.events.update({
        calendarId,
        eventId,
        requestBody: {
          summary: eventData.summary,
          location: eventData.location,
          description: eventData.description,
          start: eventData.start,
          end: eventData.end,
        },
      });

      this.logger.log(
        `Updated Google Calendar event ${eventId} in calendar ${calendarId}`,
      );

      return {
        eventId: response.data.id || '',
        htmlLink: response.data.htmlLink || '',
      };
    } catch (error) {
      this.logger.error(`Failed to update calendar event ${eventId}`, error.stack);
      throw new Error('Failed to update Google Calendar event');
    }
  }

  /**
   * Delete a calendar event
   * Sprint 12: Outbound Sync
   * @param accessToken - Valid access token
   * @param calendarId - Calendar ID
   * @param eventId - Event ID to delete
   */
  async deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<void> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      await calendar.events.delete({
        calendarId,
        eventId,
      });

      this.logger.log(
        `Deleted Google Calendar event ${eventId} from calendar ${calendarId}`,
      );
    } catch (error) {
      // 404 is acceptable - event already deleted
      if (error.code === 404) {
        this.logger.warn(
          `Calendar event ${eventId} not found (already deleted)`,
        );
        return;
      }

      this.logger.error(`Failed to delete calendar event ${eventId}`, error.stack);
      throw new Error('Failed to delete Google Calendar event');
    }
  }

  /**
   * Fetch calendar events with incremental sync support
   * Sprint 13a: Inbound Sync - Webhook Handler
   *
   * Uses Google Calendar sync tokens for incremental sync when available.
   * If syncToken is provided, only fetches events changed since last sync.
   * If syncToken is null or invalid, performs full sync.
   *
   * @param accessToken - Valid access token
   * @param calendarId - Calendar ID
   * @param syncToken - Sync token from previous sync (optional)
   * @param timeMin - Minimum time for initial sync (optional)
   * @param timeMax - Maximum time for initial sync (optional)
   * @returns Events and new sync token
   */
  async listEventsIncremental(
    accessToken: string,
    calendarId: string,
    syncToken?: string,
    timeMin?: Date,
    timeMax?: Date,
  ): Promise<{
    events: Array<{
      id: string;
      status: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
    nextSyncToken: string;
  }> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const requestParams: any = {
        calendarId,
        singleEvents: true,
      };

      if (syncToken) {
        // Incremental sync - fetch only changes since last sync
        requestParams.syncToken = syncToken;
        this.logger.log(`Fetching incremental changes for calendar ${calendarId}`);
      } else {
        // Full sync - fetch all events in time range
        if (timeMin) {
          requestParams.timeMin = timeMin.toISOString();
        }
        if (timeMax) {
          requestParams.timeMax = timeMax.toISOString();
        }
        this.logger.log(
          `Performing full sync for calendar ${calendarId} (timeMin: ${timeMin?.toISOString()}, timeMax: ${timeMax?.toISOString()})`,
        );
      }

      const response = await calendar.events.list(requestParams);

      const events = (response.data.items || []).map((event) => ({
        id: event.id || '',
        status: event.status || 'confirmed',
        start: event.start
          ? {
              dateTime: event.start.dateTime || undefined,
              date: event.start.date || undefined,
            }
          : undefined,
        end: event.end
          ? {
              dateTime: event.end.dateTime || undefined,
              date: event.end.date || undefined,
            }
          : undefined,
      }));

      const nextSyncToken = response.data.nextSyncToken || '';

      this.logger.log(
        `Fetched ${events.length} events from calendar ${calendarId}`,
      );

      return {
        events,
        nextSyncToken,
      };
    } catch (error) {
      // Sync token invalid or expired - fall back to full sync
      if (error.code === 410 && syncToken) {
        this.logger.warn(
          `Sync token expired for calendar ${calendarId} - falling back to full sync`,
        );
        // Retry without sync token (full sync)
        return this.listEventsIncremental(
          accessToken,
          calendarId,
          undefined,
          timeMin,
          timeMax,
        );
      }

      this.logger.error('Failed to list calendar events', error.stack);
      throw new Error('Failed to fetch Google Calendar events');
    }
  }
}
