import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VoiceAiSipService } from './voice-ai-sip.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { VoiceAiSettingsService } from './voice-ai-settings.service';
import { VoiceUsageService } from './voice-usage.service';

describe('VoiceAiSipService', () => {
  let service: VoiceAiSipService;
  let configService: ConfigService;
  let prismaService: PrismaService;
  let settingsService: VoiceAiSettingsService;
  let usageService: VoiceUsageService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'LIVEKIT_SIP_TRUNK_URL') {
        return 'livekit.example.com';
      }
      return null;
    }),
  };

  const mockPrismaService = {
    tenant: {
      findUnique: jest.fn(),
    },
    voice_ai_global_config: {
      findUnique: jest.fn(),
    },
  };

  const mockSettingsService = {
    getTenantSettings: jest.fn(),
  };

  const mockUsageService = {
    getQuota: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceAiSipService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: VoiceAiSettingsService,
          useValue: mockSettingsService,
        },
        {
          provide: VoiceUsageService,
          useValue: mockUsageService,
        },
      ],
    }).compile();

    service = module.get<VoiceAiSipService>(VoiceAiSipService);
    configService = module.get<ConfigService>(ConfigService);
    prismaService = module.get<PrismaService>(PrismaService);
    settingsService = module.get<VoiceAiSettingsService>(
      VoiceAiSettingsService,
    );
    usageService = module.get<VoiceUsageService>(VoiceUsageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildSipTwiml', () => {
    beforeEach(() => {
      mockPrismaService.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        subdomain: 'test-tenant',
      });

      mockPrismaService.voice_ai_global_config.findUnique.mockResolvedValue({
        id: 'default',
        livekit_sip_trunk_url: 'livekit.example.com',
      });
    });

    it('should include X-Agent-Profile-Id header when agentProfileId provided', async () => {
      const tenantId = 'tenant-123';
      const callSid = 'CA123';
      const toNumber = '+15551234567';
      const agentProfileId = 'profile-uuid-123';

      const twiml = await service.buildSipTwiml(
        tenantId,
        callSid,
        toNumber,
        agentProfileId,
      );

      expect(twiml).toContain(
        '<SipHeader name="X-Agent-Profile-Id">profile-uuid-123</SipHeader>',
      );
      // Verify toNumber is passed as query parameter in SIP URI
      expect(twiml).toContain('?X-Called-Number=%2B15551234567');
    });

    it('should not include X-Agent-Profile-Id header when agentProfileId not provided', async () => {
      const tenantId = 'tenant-123';
      const callSid = 'CA123';
      const toNumber = '+15551234567';

      const twiml = await service.buildSipTwiml(tenantId, callSid, toNumber);

      expect(twiml).not.toContain('X-Agent-Profile-Id');
      expect(twiml).not.toContain('X-Twilio-Number');
      // Verify toNumber is passed as query parameter in SIP URI
      expect(twiml).toContain('?X-Called-Number=%2B15551234567');
    });

    it('should escape XML special characters in profile ID', async () => {
      const agentProfileId = 'profile<>&"\'123'; // Malicious input

      const twiml = await service.buildSipTwiml(
        'tenant-123',
        'CA123',
        '+15551234567',
        agentProfileId,
      );

      expect(twiml).toContain('&lt;'); // < escaped
      expect(twiml).toContain('&gt;'); // > escaped
      expect(twiml).toContain('&amp;'); // & escaped
      expect(twiml).toContain('&quot;'); // " escaped
      expect(twiml).toContain('&apos;'); // ' escaped
    });

    it('should generate valid TwiML with both toNumber and agentProfileId', async () => {
      const tenantId = 'tenant-123';
      const callSid = 'CA123';
      const toNumber = '+15551234567';
      const agentProfileId = 'profile-uuid-abc';

      const twiml = await service.buildSipTwiml(
        tenantId,
        callSid,
        toNumber,
        agentProfileId,
      );

      // Check XML declaration
      expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');

      // Check Response element
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('</Response>');

      // Check Dial element with recording
      expect(twiml).toContain('<Dial');
      expect(twiml).toContain('record="record-from-answer-dual"');
      expect(twiml).toContain('</Dial>');

      // Check Sip element
      expect(twiml).toContain('<Sip>');
      expect(twiml).toContain('sip:voice-ai@livekit.example.com');
      expect(twiml).toContain('</Sip>');

      // Check SIP headers are inside Sip element
      expect(twiml).toContain(
        '<SipHeader name="X-Agent-Profile-Id">profile-uuid-abc</SipHeader>',
      );

      // Verify toNumber is passed as query parameter in SIP URI
      expect(twiml).toContain('?X-Called-Number=%2B15551234567');

      // Check consent message
      expect(twiml).toContain(
        'This call will be recorded for quality and training purposes',
      );
    });

    it('should generate valid TwiML without agentProfileId', async () => {
      const tenantId = 'tenant-123';
      const callSid = 'CA123';
      const toNumber = '+15551234567';

      const twiml = await service.buildSipTwiml(tenantId, callSid, toNumber);

      // Check XML structure
      expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('</Response>');

      // Check Sip element
      expect(twiml).toContain('<Sip>');
      expect(twiml).toContain('sip:voice-ai@livekit.example.com');
      expect(twiml).toContain('</Sip>');

      // Verify no SIP headers present
      expect(twiml).not.toContain('X-Twilio-Number');
      expect(twiml).not.toContain('X-Agent-Profile-Id');

      // Verify toNumber is passed as query parameter in SIP URI
      expect(twiml).toContain('?X-Called-Number=%2B15551234567');
    });

    it('should generate valid TwiML with neither toNumber nor agentProfileId', async () => {
      const tenantId = 'tenant-123';
      const callSid = 'CA123';

      const twiml = await service.buildSipTwiml(tenantId, callSid);

      // Check XML structure
      expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('</Response>');

      // Check Sip element without headers
      expect(twiml).toContain('<Sip>');
      expect(twiml).toContain('sip:voice-ai@livekit.example.com');
      expect(twiml).toContain('</Sip>');

      // No SIP headers should be present
      expect(twiml).not.toContain('<SipHeader');

      // Verify no query parameter when toNumber not provided
      expect(twiml).not.toContain('X-Called-Number');
    });

    it('should properly separate SIP URI and headers with newlines', async () => {
      const tenantId = 'tenant-123';
      const callSid = 'CA123';
      const agentProfileId = 'profile-uuid-123';

      const twiml = await service.buildSipTwiml(
        tenantId,
        callSid,
        undefined,
        agentProfileId,
      );

      // Extract Sip element content
      const sipMatch = twiml.match(/<Sip>([\s\S]*?)<\/Sip>/);
      expect(sipMatch).toBeTruthy();

      const sipContent = sipMatch[1];

      // Verify structure: URI and header on separate lines with whitespace
      expect(sipContent).toMatch(/sip:voice-ai@[\w.-]+\s+<SipHeader/);

      // Verify URI is not immediately followed by tag (no concatenation)
      expect(sipContent).not.toMatch(/sip:voice-ai@[\w.-]+<SipHeader/);

      // Verify multiple lines exist
      expect(sipContent.split('\n').length).toBeGreaterThan(1);

      // Verify no query parameter when toNumber not provided
      expect(twiml).not.toContain('X-Called-Number');
    });

    it('should properly indent SIP URI and headers', async () => {
      const tenantId = 'tenant-123';
      const callSid = 'CA123';
      const agentProfileId = 'profile-uuid-123';

      const twiml = await service.buildSipTwiml(
        tenantId,
        callSid,
        undefined,
        agentProfileId,
      );

      // Verify proper indentation (6 spaces for nested content)
      expect(twiml).toContain('    <Sip>\n      sip:voice-ai@');
      expect(twiml).toContain('      <SipHeader name="X-Agent-Profile-Id">');
      expect(twiml).toContain('\n    </Sip>');

      // Verify no query parameter when toNumber not provided
      expect(twiml).not.toContain('X-Called-Number');
    });

    it('should properly structure Sip element when no headers present', async () => {
      const tenantId = 'tenant-123';
      const callSid = 'CA123';

      const twiml = await service.buildSipTwiml(tenantId, callSid);

      // Verify structure without headers
      const sipMatch = twiml.match(/<Sip>([\s\S]*?)<\/Sip>/);
      expect(sipMatch).toBeTruthy();

      const sipContent = sipMatch[1];

      // Should still have newlines even without headers
      expect(sipContent).toContain('\n');
      expect(sipContent).toContain('sip:voice-ai@livekit.example.com');

      // Verify no SipHeader tags present
      expect(sipContent).not.toContain('<SipHeader');
    });

    it('should include X-Agent-Profile-Id but never X-Twilio-Number', async () => {
      const tenantId = 'tenant-123';
      const callSid = 'CA123';
      const toNumber = '+15551234567';
      const agentProfileId = 'profile-uuid-123';

      const twiml = await service.buildSipTwiml(
        tenantId,
        callSid,
        toNumber,
        agentProfileId,
      );

      // X-Agent-Profile-Id should be present
      expect(twiml).toContain(
        '<SipHeader name="X-Agent-Profile-Id">profile-uuid-123</SipHeader>',
      );

      // X-Twilio-Number should NEVER be present (even when toNumber provided)
      expect(twiml).not.toContain('X-Twilio-Number');

      // Verify toNumber is passed as query parameter in SIP URI
      expect(twiml).toContain('?X-Called-Number=%2B15551234567');
    });

    it('should handle missing LiveKit SIP trunk URL gracefully', async () => {
      mockPrismaService.voice_ai_global_config.findUnique.mockResolvedValue({
        id: 'default',
        livekit_sip_trunk_url: null,
      });

      const twiml = await service.buildSipTwiml(
        'tenant-123',
        'CA123',
        '+15551234567',
        'profile-123',
      );

      // Should return fallback TwiML with error message
      expect(twiml).toContain('Our AI assistant is temporarily unavailable');
      expect(twiml).toContain('<Hangup/>');
    });
  });

  describe('canHandleCall', () => {
    it('should return false when Voice AI is disabled for tenant', async () => {
      mockSettingsService.getTenantSettings.mockResolvedValue({
        is_enabled: false,
      });

      const result = await service.canHandleCall('tenant-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('disabled');
    });

    it('should return false when plan does not include Voice AI', async () => {
      mockSettingsService.getTenantSettings.mockResolvedValue({
        is_enabled: true,
      });

      mockPrismaService.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        subscription_plan: {
          voice_ai_enabled: false,
        },
      });

      const result = await service.canHandleCall('tenant-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('plan_not_included');
    });

    it('should return false when quota is exceeded', async () => {
      mockSettingsService.getTenantSettings.mockResolvedValue({
        is_enabled: true,
      });

      mockPrismaService.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        subscription_plan: {
          voice_ai_enabled: true,
        },
      });

      mockUsageService.getQuota.mockResolvedValue({
        quota_exceeded: true,
        minutes_used: 100,
        minutes_included: 100,
      });

      const result = await service.canHandleCall('tenant-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('quota_exceeded');
    });

    it('should return true when all checks pass', async () => {
      mockSettingsService.getTenantSettings.mockResolvedValue({
        is_enabled: true,
      });

      mockPrismaService.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        subscription_plan: {
          voice_ai_enabled: true,
        },
      });

      mockUsageService.getQuota.mockResolvedValue({
        quota_exceeded: false,
        minutes_used: 50,
        minutes_included: 100,
      });

      const result = await service.canHandleCall('tenant-123');

      expect(result.allowed).toBe(true);
    });
  });

  describe('buildFallbackTwiml', () => {
    it('should generate fallback TwiML with custom message', () => {
      const transferNumber = '+15551234567';
      const message = 'Transferring to support';

      const twiml = service.buildFallbackTwiml(transferNumber, message);

      expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain(
        '<Say voice="Polly.Joanna" language="en-US">Transferring to support</Say>',
      );
      expect(twiml).toContain('<Dial>+15551234567</Dial>');
      expect(twiml).toContain('</Response>');
    });

    it('should generate fallback TwiML with default message', () => {
      const transferNumber = '+15551234567';

      const twiml = service.buildFallbackTwiml(transferNumber);

      expect(twiml).toContain('Transferring you now. Please hold.');
    });

    it('should escape XML special characters in message', () => {
      const transferNumber = '+15551234567';
      const message = 'Transfer <test> & "quote"';

      const twiml = service.buildFallbackTwiml(transferNumber, message);

      expect(twiml).toContain('&lt;');
      expect(twiml).toContain('&gt;');
      expect(twiml).toContain('&amp;');
      expect(twiml).toContain('&quot;');
    });
  });
});
