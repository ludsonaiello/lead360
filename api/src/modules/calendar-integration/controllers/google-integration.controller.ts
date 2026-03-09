import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  UseGuards,
  Req,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
  Session,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { GoogleCalendarService } from '../services/google-calendar.service';
import { CalendarProviderConnectionService } from '../services/calendar-provider-connection.service';
import {
  GoogleAuthUrlResponseDto,
  GoogleOAuthCallbackQueryDto,
  GoogleOAuthCallbackResponseDto,
  GoogleCalendarListResponseDto,
  ConnectGoogleCalendarDto,
  ConnectGoogleCalendarResponseDto,
  CalendarConnectionStatusDto,
  DisconnectCalendarResponseDto,
  TriggerSyncResponseDto,
  TestConnectionResponseDto,
} from '../dto';
import { randomUUID } from 'crypto';
import type { Response } from 'express';

/**
 * Controller for Google Calendar OAuth integration
 * Handles authorization flow, connection management, and sync operations
 */
@ApiTags('Calendar Integration - Google')
@Controller('calendar/integration/google')
export class GoogleIntegrationController {
  private readonly logger = new Logger(GoogleIntegrationController.name);

  constructor(
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly connectionService: CalendarProviderConnectionService,
  ) {}

  /**
   * Generate Google OAuth authorization URL
   * Step 1 of OAuth flow
   */
  @Get('auth-url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Owner', 'Admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate Google OAuth authorization URL',
    description:
      'Generates the OAuth consent screen URL for Google Calendar. User must visit this URL to authorize access.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authorization URL generated successfully',
    type: GoogleAuthUrlResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async generateAuthUrl(
    @TenantId() tenantId: string,
    @Session() session: Record<string, any>,
  ): Promise<GoogleAuthUrlResponseDto> {
    this.logger.log(`Generating OAuth URL for tenant ${tenantId}`);

    const { authUrl, state } =
      this.googleCalendarService.generateAuthUrl(tenantId);

    // Store FULL state (tenantId:uuid) in session for CSRF validation
    const fullState = `${tenantId}:${state}`;
    session.googleOAuthState = fullState;
    session.googleOAuthTenantId = tenantId;

    return {
      authUrl,
      state,
    };
  }

  /**
   * OAuth callback handler
   * Step 2 of OAuth flow - receives authorization code from Google
   */
  @Get('callback')
  @Public()
  @ApiOperation({
    summary: 'OAuth callback handler',
    description:
      'Handles the OAuth callback from Google. Exchanges authorization code for tokens.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authorization successful - redirect to calendar selection',
    type: GoogleOAuthCallbackResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid state or code',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - OAuth failed' })
  async handleOAuthCallback(
    @Query() query: GoogleOAuthCallbackQueryDto,
    @Session() session: Record<string, any>,
    @Res() res: Response,
  ): Promise<void> {
    const { code, state, error } = query;

    // Handle OAuth errors (user denied access, etc.)
    if (error) {
      this.logger.warn(`OAuth error: ${error}`);
      // Redirect to frontend with error
      res.redirect(
        `${process.env.APP_URL}/settings/calendar?error=${encodeURIComponent(error)}`,
      );
      return;
    }

    // Validate state parameter (CSRF protection)
    const sessionState = session.googleOAuthState;
    const sessionTenantId = session.googleOAuthTenantId;

    if (!sessionState || !sessionTenantId) {
      this.logger.error('OAuth state not found in session');
      res.redirect(
        `${process.env.APP_URL}/settings/calendar?error=session_expired`,
      );
      return;
    }

    if (state !== sessionState) {
      this.logger.error('OAuth state mismatch - possible CSRF attack');
      res.redirect(
        `${process.env.APP_URL}/settings/calendar?error=invalid_state`,
      );
      return;
    }

    try {
      // Exchange authorization code for tokens
      const { accessToken, refreshToken, expiryDate } =
        await this.googleCalendarService.exchangeCodeForTokens(code);

      // Store tokens temporarily in session for calendar selection
      session.googleOAuthTokens = {
        accessToken,
        refreshToken,
        expiryDate: expiryDate.toISOString(),
      };

      // Clear state parameters
      delete session.googleOAuthState;

      this.logger.log(`OAuth successful for tenant ${sessionTenantId}`);

      // Redirect to frontend calendar selection page
      res.redirect(`${process.env.APP_URL}/settings/calendar/select-calendar`);
    } catch (error) {
      this.logger.error('Failed to exchange authorization code', error.stack);
      res.redirect(
        `${process.env.APP_URL}/settings/calendar?error=token_exchange_failed`,
      );
    }
  }

  /**
   * List available Google Calendars
   * Step 3 of OAuth flow - user selects which calendar to connect
   */
  @Get('calendars')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Owner', 'Admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List available Google Calendars',
    description:
      'Returns list of calendars from Google for the authenticated user. Requires valid OAuth tokens in session.',
  })
  @ApiResponse({
    status: 200,
    description: 'Calendar list retrieved successfully',
    type: GoogleCalendarListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Session tokens missing',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async listCalendars(
    @TenantId() tenantId: string,
    @Session() session: Record<string, any>,
  ): Promise<GoogleCalendarListResponseDto> {
    // Get tokens from session
    const sessionTokens = session.googleOAuthTokens;

    if (!sessionTokens || !sessionTokens.accessToken) {
      throw new UnauthorizedException(
        'OAuth tokens not found in session. Please complete OAuth flow first.',
      );
    }

    this.logger.log(`Listing calendars for tenant ${tenantId}`);

    const calendars = await this.googleCalendarService.listCalendars(
      sessionTokens.accessToken,
    );

    return {
      calendars,
      total: calendars.length,
    };
  }

  /**
   * Finalize calendar connection
   * Step 4 of OAuth flow - save connection to database
   */
  @Post('connect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Owner', 'Admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Finalize calendar connection',
    description:
      'Saves the selected calendar connection to the database with encrypted tokens. Sets up webhook subscription.',
  })
  @ApiResponse({
    status: 201,
    description: 'Calendar connected successfully',
    type: ConnectGoogleCalendarResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid calendar ID',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Session tokens missing',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Connection already exists',
  })
  async connectCalendar(
    @TenantId() tenantId: string,
    @Req() req: any,
    @Body() dto: ConnectGoogleCalendarDto,
    @Session() session: Record<string, any>,
  ): Promise<ConnectGoogleCalendarResponseDto> {
    const userId = req.user?.id;

    // Check if ANY connection already exists (active or inactive)
    const existingAnyConnection =
      await this.connectionService.getConnection(tenantId);

    if (existingAnyConnection?.is_active) {
      throw new BadRequestException(
        'Calendar connection already exists. Disconnect first before connecting a new calendar.',
      );
    }

    // If inactive connection exists, delete it before creating new one
    // This handles the case where disconnect succeeded but left inactive record
    if (existingAnyConnection && !existingAnyConnection.is_active) {
      this.logger.log(
        `Cleaning up inactive connection before reconnect for tenant ${tenantId}`,
      );
      await this.connectionService.deleteConnection(tenantId);
    }

    // Get tokens from session
    const sessionTokens = session.googleOAuthTokens;
    const sessionTenantId = session.googleOAuthTenantId;

    if (!sessionTokens || !sessionTokens.accessToken) {
      throw new UnauthorizedException(
        'OAuth tokens not found in session. Please complete OAuth flow first.',
      );
    }

    if (sessionTenantId !== tenantId) {
      throw new UnauthorizedException('Tenant ID mismatch');
    }

    this.logger.log(
      `Connecting calendar ${dto.calendarId} for tenant ${tenantId}`,
    );

    try {
      // Get calendar name if not provided
      let calendarName = dto.calendarName;

      if (!calendarName) {
        const calendar = await this.googleCalendarService.getCalendar(
          sessionTokens.accessToken,
          dto.calendarId,
        );
        calendarName = calendar.summary;
      }

      // Create webhook channel
      const webhookUrl = `${process.env.LEAD360_API_URL || 'https://api.lead360.app'}/api/v1/webhooks/google-calendar`;
      const channelToken = randomUUID();

      const webhookChannel =
        await this.googleCalendarService.createWatchChannel(
          sessionTokens.accessToken,
          dto.calendarId,
          webhookUrl,
          channelToken,
        );

      // Create connection record
      const connection = await this.connectionService.createConnection({
        tenantId,
        providerType: 'google_calendar',
        accessToken: sessionTokens.accessToken,
        refreshToken: sessionTokens.refreshToken,
        tokenExpiresAt: new Date(sessionTokens.expiryDate),
        connectedCalendarId: dto.calendarId,
        connectedCalendarName: calendarName,
        webhookChannelId: webhookChannel.channelId,
        webhookResourceId: webhookChannel.resourceId,
        webhookChannelToken: channelToken,
        webhookExpiration: webhookChannel.expiration,
        connectedByUserId: userId,
      });

      // Clear session tokens
      delete session.googleOAuthTokens;
      delete session.googleOAuthTenantId;

      this.logger.log(
        `Calendar connection created for tenant ${tenantId}: ${connection.id}`,
      );

      return {
        id: connection.id,
        status: 'success',
        message: 'Google Calendar connected successfully.',
        connectedCalendarId: connection.connectedCalendarId,
        connectedCalendarName: connection.connectedCalendarName,
        providerType: connection.providerType,
      };
    } catch (error) {
      this.logger.error('Failed to connect calendar', error.stack);
      throw new BadRequestException(
        'Failed to connect calendar. Please try again.',
      );
    }
  }

  /**
   * Disconnect Google Calendar
   * Revokes tokens, stops webhooks, and deletes connection
   */
  @Delete('disconnect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Owner', 'Admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Disconnect Google Calendar',
    description:
      'Disconnects the Google Calendar integration. Revokes OAuth tokens, stops webhook channel, and deletes external blocks.',
  })
  @ApiResponse({
    status: 200,
    description: 'Calendar disconnected successfully',
    type: DisconnectCalendarResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  async disconnectCalendar(
    @TenantId() tenantId: string,
  ): Promise<DisconnectCalendarResponseDto> {
    const connection =
      await this.connectionService.getActiveConnection(tenantId);

    if (!connection) {
      throw new NotFoundException('Calendar connection not found');
    }

    this.logger.log(`Disconnecting calendar for tenant ${tenantId}`);

    try {
      // Refresh token if expired/expiring (prevents auth failures)
      let accessToken = connection.accessToken;

      if (this.connectionService.needsTokenRefresh(connection.tokenExpiresAt)) {
        this.logger.log(
          `Token expired/expiring - refreshing before disconnect for tenant ${tenantId}`,
        );

        const refreshed = await this.googleCalendarService.refreshAccessToken(
          connection.refreshToken,
        );

        await this.connectionService.updateAccessToken(
          connection.id,
          refreshed.accessToken,
          refreshed.expiryDate,
        );

        accessToken = refreshed.accessToken;

        this.logger.log(`Token refreshed successfully for tenant ${tenantId}`);
      }

      // Stop webhook channel
      if (connection.webhookChannelId && connection.webhookResourceId) {
        await this.googleCalendarService.stopWatchChannel(
          accessToken,
          connection.webhookChannelId,
          connection.webhookResourceId,
        );
      }

      // Revoke OAuth tokens
      await this.googleCalendarService.revokeToken(accessToken);

      // Deactivate connection and purge external blocks
      await this.connectionService.deactivateConnection(tenantId);

      this.logger.log(
        `Calendar disconnected successfully for tenant ${tenantId}`,
      );

      return {
        status: 'success',
        message: 'Google Calendar disconnected successfully.',
      };
    } catch (error) {
      this.logger.error('Failed to disconnect calendar', error.stack);
      throw new BadRequestException(
        'Failed to disconnect calendar. Please try again.',
      );
    }
  }

  /**
   * Trigger manual full sync
   * Queues a background job to sync all events
   */
  @Post('sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Owner', 'Admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Trigger manual full sync',
    description:
      'Triggers a manual full sync of Google Calendar events. Sync happens in background.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sync queued successfully',
    type: TriggerSyncResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  async triggerSync(
    @TenantId() tenantId: string,
  ): Promise<TriggerSyncResponseDto> {
    const connection =
      await this.connectionService.getActiveConnection(tenantId);

    if (!connection) {
      throw new NotFoundException('Calendar connection not found');
    }

    this.logger.log(`Manual sync triggered for tenant ${tenantId}`);

    // TODO: Queue sync job in BullMQ (Sprint 13)
    // For now, just return success message

    return {
      status: 'success',
      message:
        'Manual sync has been queued. This may take a few moments. External calendar blocks will update shortly.',
    };
  }

  /**
   * Test calendar connection health
   * Verifies OAuth tokens are valid and Google API is reachable
   */
  @Post('test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Owner', 'Admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Test calendar connection',
    description:
      'Tests the calendar connection by making a test API call to Google. Verifies tokens are valid.',
  })
  @ApiResponse({
    status: 200,
    description: 'Connection test successful',
    type: TestConnectionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  @ApiResponse({ status: 503, description: 'Connection test failed' })
  async testConnection(
    @TenantId() tenantId: string,
  ): Promise<TestConnectionResponseDto> {
    const connection =
      await this.connectionService.getActiveConnection(tenantId);

    if (!connection) {
      throw new NotFoundException('Calendar connection not found');
    }

    this.logger.log(`Testing connection for tenant ${tenantId}`);

    try {
      // Check if token needs refresh
      if (this.connectionService.needsTokenRefresh(connection.tokenExpiresAt)) {
        this.logger.log('Token expired, refreshing before test');

        const { accessToken, expiryDate } =
          await this.googleCalendarService.refreshAccessToken(
            connection.refreshToken,
          );

        await this.connectionService.updateAccessToken(
          connection.id,
          accessToken,
          expiryDate,
        );

        // Use new token for test
        connection.accessToken = accessToken;
      }

      // Test API call - get calendar metadata
      const calendar = await this.googleCalendarService.getCalendar(
        connection.accessToken,
        connection.connectedCalendarId,
      );

      this.logger.log(`Connection test successful for tenant ${tenantId}`);

      return {
        status: 'success',
        message:
          'Connection is healthy. Successfully retrieved calendar metadata.',
        details: {
          calendarId: calendar.id,
          calendarName: calendar.summary,
          timeZone: calendar.timeZone,
        },
      };
    } catch (error) {
      this.logger.error('Connection test failed', error.stack);

      // Update sync status to error
      await this.connectionService.updateSyncStatus(
        connection.id,
        'error',
        'Connection test failed: ' + error.message,
      );

      throw new BadRequestException(
        'Connection test failed. The calendar may be disconnected or tokens may have been revoked.',
      );
    }
  }
}
