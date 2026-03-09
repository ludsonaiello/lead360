import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleCalendarService } from './google-calendar.service';

// Mock uuid module
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123'),
}));

describe('GoogleCalendarService', () => {
  let service: GoogleCalendarService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        GOOGLE_CALENDAR_CLIENT_ID: 'test-client-id',
        GOOGLE_CALENDAR_CLIENT_SECRET: 'test-client-secret',
        GOOGLE_CALENDAR_REDIRECT_URL:
          'https://api.lead360.app/api/v1/calendar/integration/google/callback',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleCalendarService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<GoogleCalendarService>(GoogleCalendarService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateAuthUrl', () => {
    it('should generate OAuth authorization URL with state parameter', () => {
      const tenantId = 'tenant-123';
      const result = service.generateAuthUrl(tenantId);

      expect(result).toHaveProperty('authUrl');
      expect(result).toHaveProperty('state');
      expect(result.authUrl).toContain('accounts.google.com/o/oauth2');
      expect(result.authUrl).toContain('client_id=test-client-id');
      expect(result.authUrl).toContain('access_type=offline');
      // State is URL-encoded in the URL (: becomes %3A)
      expect(result.authUrl).toContain(
        `state=${encodeURIComponent(tenantId + ':' + result.state)}`,
      );
    });

    it('should generate state parameter', () => {
      const tenantId = 'tenant-123';
      const result = service.generateAuthUrl(tenantId);

      expect(result.state).toBe('mock-uuid-123');
    });
  });

  describe('configuration', () => {
    it('should load configuration from environment', () => {
      expect(configService.get('GOOGLE_CALENDAR_CLIENT_ID')).toBe(
        'test-client-id',
      );
      expect(configService.get('GOOGLE_CALENDAR_CLIENT_SECRET')).toBe(
        'test-client-secret',
      );
      expect(configService.get('GOOGLE_CALENDAR_REDIRECT_URL')).toContain(
        'callback',
      );
    });
  });

  // Note: exchangeCodeForTokens, refreshAccessToken, listCalendars, getCalendar,
  // createWatchChannel, stopWatchChannel, and revokeToken require mocking the
  // Google OAuth2Client and Calendar API. These would be tested in integration tests
  // or with comprehensive mocking of googleapis. For unit tests, we focus on
  // business logic that doesn't require external API calls.
});
