import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EmailSettingsController } from './email-settings.controller';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { SmtpService } from '../services/smtp.service';
import { EmailService } from '../services/email.service';

describe('EmailSettingsController', () => {
  let controller: EmailSettingsController;
  let prisma: PrismaService;
  let encryption: EncryptionService;
  let smtpService: SmtpService;
  let emailService: EmailService;

  const mockPrismaService = {
    platform_email_config: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockEncryptionService = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };

  const mockSmtpService = {
    initializeTransporter: jest.fn(),
  };

  const mockEmailService = {
    sendTemplatedEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailSettingsController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
        {
          provide: SmtpService,
          useValue: mockSmtpService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    controller = module.get<EmailSettingsController>(EmailSettingsController);
    prisma = module.get<PrismaService>(PrismaService);
    encryption = module.get<EncryptionService>(EncryptionService);
    smtpService = module.get<SmtpService>(SmtpService);
    emailService = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEmailConfig', () => {
    it('should return email config with masked password', async () => {
      const mockConfig = {
        id: 'config-1',
        smtp_host: 'smtp.gmail.com',
        smtp_port: 587,
        smtp_encryption: 'tls',
        smtp_username: 'test@gmail.com',
        smtp_password: 'encrypted-password-here',
        from_email: 'noreply@lead360.app',
        from_name: 'Lead360 Platform',
        is_verified: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaService.platform_email_config.findFirst.mockResolvedValue(
        mockConfig,
      );

      const result = await controller.getEmailConfig();

      expect(result).toEqual({
        ...mockConfig,
        smtp_password: '********',
      });
      expect(result.smtp_password).toBe('********');
    });

    it('should return null when no config exists', async () => {
      mockPrismaService.platform_email_config.findFirst.mockResolvedValue(null);

      const result = await controller.getEmailConfig();

      expect(result).toBeNull();
    });
  });

  describe('updateEmailConfig', () => {
    it('should update existing email config', async () => {
      const updateDto = {
        smtp_host: 'smtp.sendgrid.net',
        smtp_port: 587,
        smtp_encryption: 'tls',
        smtp_username: 'apikey',
        smtp_password: 'new-password-123',
        from_email: 'support@lead360.app',
        from_name: 'Lead360 Support',
      };

      const existingConfig = {
        id: 'config-1',
        smtp_host: 'smtp.gmail.com',
        smtp_port: 587,
        smtp_encryption: 'tls',
        smtp_username: 'old@gmail.com',
        smtp_password: 'old-encrypted-password',
        from_email: 'noreply@lead360.app',
        from_name: 'Lead360',
        is_verified: true,
      };

      const updatedConfig = {
        id: 'config-1',
        ...updateDto,
        smtp_password: 'encrypted-new-password',
        is_verified: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaService.platform_email_config.findFirst.mockResolvedValue(
        existingConfig,
      );
      mockEncryptionService.encrypt.mockReturnValue('encrypted-new-password');
      mockPrismaService.platform_email_config.update.mockResolvedValue(
        updatedConfig,
      );
      mockSmtpService.initializeTransporter.mockResolvedValue(undefined);

      const result = await controller.updateEmailConfig(updateDto);

      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(
        updateDto.smtp_password,
      );
      expect(
        mockPrismaService.platform_email_config.update,
      ).toHaveBeenCalledWith({
        where: { id: existingConfig.id },
        data: {
          smtp_host: updateDto.smtp_host,
          smtp_port: updateDto.smtp_port,
          smtp_encryption: updateDto.smtp_encryption,
          smtp_username: updateDto.smtp_username,
          smtp_password: 'encrypted-new-password',
          from_email: updateDto.from_email,
          from_name: updateDto.from_name,
          is_verified: false,
        },
      });
      expect(mockSmtpService.initializeTransporter).toHaveBeenCalled();
      expect(result.smtp_password).toBe('********');
    });

    it('should create new email config if none exists', async () => {
      const createDto = {
        smtp_host: 'smtp.gmail.com',
        smtp_port: 587,
        smtp_encryption: 'tls',
        smtp_username: 'test@gmail.com',
        smtp_password: 'password123',
        from_email: 'noreply@lead360.app',
        from_name: 'Lead360',
      };

      mockPrismaService.platform_email_config.findFirst.mockResolvedValue(null);
      mockEncryptionService.encrypt.mockReturnValue('encrypted-password');
      mockPrismaService.platform_email_config.create.mockResolvedValue({
        id: 'new-config-id',
        ...createDto,
        smtp_password: 'encrypted-password',
        is_verified: false,
        created_at: new Date(),
        updated_at: new Date(),
      });
      mockSmtpService.initializeTransporter.mockResolvedValue(undefined);

      const result = await controller.updateEmailConfig(createDto);

      expect(mockPrismaService.platform_email_config.create).toHaveBeenCalled();
      expect(mockSmtpService.initializeTransporter).toHaveBeenCalled();
      expect(result.smtp_password).toBe('********');
    });

    it('should reset is_verified to false when updating config', async () => {
      const updateDto = {
        smtp_host: 'smtp.gmail.com',
        smtp_port: 587,
        smtp_encryption: 'tls',
        smtp_username: 'test@gmail.com',
        smtp_password: 'new-password',
        from_email: 'noreply@lead360.app',
        from_name: 'Lead360',
      };

      const existingConfig = {
        id: 'config-1',
        is_verified: true,
      };

      mockPrismaService.platform_email_config.findFirst.mockResolvedValue(
        existingConfig,
      );
      mockEncryptionService.encrypt.mockReturnValue('encrypted-password');
      mockPrismaService.platform_email_config.update.mockResolvedValue({
        ...updateDto,
        smtp_password: 'encrypted-password',
        is_verified: false,
      });
      mockSmtpService.initializeTransporter.mockResolvedValue(undefined);

      await controller.updateEmailConfig(updateDto);

      const updateCall =
        mockPrismaService.platform_email_config.update.mock.calls[0][0];
      expect(updateCall.data.is_verified).toBe(false);
    });
  });

  describe('sendTestEmail', () => {
    it('should send test email and mark config as verified', async () => {
      const testEmailDto = {
        to_email: 'test@example.com',
      };

      const mockConfig = {
        id: 'config-1',
        is_verified: false,
      };

      mockEmailService.sendTemplatedEmail.mockResolvedValue({
        messageId: 'test-message-id-123',
      });
      mockPrismaService.platform_email_config.findFirst.mockResolvedValue(
        mockConfig,
      );
      mockPrismaService.platform_email_config.update.mockResolvedValue({
        ...mockConfig,
        is_verified: true,
      });

      const result = await controller.sendTestEmail(testEmailDto);

      expect(mockEmailService.sendTemplatedEmail).toHaveBeenCalledWith({
        to: testEmailDto.to_email,
        templateKey: 'test-email',
        variables: {},
      });
      expect(
        mockPrismaService.platform_email_config.update,
      ).toHaveBeenCalledWith({
        where: { id: mockConfig.id },
        data: { is_verified: true },
      });
      expect(result).toEqual({
        message: 'Test email sent successfully',
        messageId: 'test-message-id-123',
      });
    });

    it('should throw BadRequestException when SMTP test fails', async () => {
      const testEmailDto = {
        to_email: 'test@example.com',
      };

      mockEmailService.sendTemplatedEmail.mockRejectedValue(
        new Error('SMTP connection failed'),
      );

      await expect(controller.sendTestEmail(testEmailDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.sendTestEmail(testEmailDto)).rejects.toThrow(
        'SMTP test failed: SMTP connection failed',
      );
    });

    it('should not update verification status if email fails', async () => {
      const testEmailDto = {
        to_email: 'test@example.com',
      };

      mockEmailService.sendTemplatedEmail.mockRejectedValue(
        new Error('SMTP error'),
      );

      await expect(controller.sendTestEmail(testEmailDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(
        mockPrismaService.platform_email_config.update,
      ).not.toHaveBeenCalled();
    });
  });
});
