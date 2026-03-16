import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PortalAuthService } from './portal-auth.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { JobQueueService } from '../../jobs/services/job-queue.service';

describe('PortalAuthService', () => {
  let service: PortalAuthService;
  let prisma: any;
  let jwtService: any;
  let jobQueue: any;

  const TENANT_ID = 'tenant-aaa';
  const TENANT_ID_B = 'tenant-bbb';
  const LEAD_ID = 'lead-111';
  const PORTAL_ACCOUNT_ID = 'portal-001';

  beforeEach(async () => {
    const mockPrisma = {
      portal_account: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      lead: {
        findFirst: jest.fn(),
      },
      lead_email: {
        findFirst: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
      },
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-portal-jwt-token'),
    };

    const mockJobQueue = {
      queueEmail: jest.fn().mockResolvedValue(undefined),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'PORTAL_JWT_SECRET') return 'test-portal-secret';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortalAuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JobQueueService, useValue: mockJobQueue },
      ],
    }).compile();

    service = module.get<PortalAuthService>(PortalAuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
    jobQueue = module.get(JobQueueService);
  });

  // -----------------------------------------------------------------------
  // createForLead
  // -----------------------------------------------------------------------
  describe('createForLead', () => {
    it('should create a portal account for a lead with email', async () => {
      prisma.portal_account.findUnique.mockResolvedValue(null); // no existing
      prisma.lead.findFirst.mockResolvedValue({
        id: LEAD_ID,
        tenant_id: TENANT_ID,
        first_name: 'John',
        last_name: 'Smith',
        emails: [{ email: 'john@example.com', is_primary: true }],
      });
      prisma.portal_account.create.mockResolvedValue({
        id: PORTAL_ACCOUNT_ID,
        tenant_id: TENANT_ID,
        lead_id: LEAD_ID,
        email: 'john@example.com',
        customer_slug: 'john-smith',
      });
      prisma.tenant.findUnique.mockResolvedValue({
        subdomain: 'acme',
        company_name: 'ACME',
      });

      const result = await service.createForLead(TENANT_ID, LEAD_ID);

      expect(result).not.toBeNull();
      expect(result!.customer_slug).toBe('john-smith');
      expect(result!.temporary_password).toBeDefined();
      expect(result!.temporary_password.length).toBeGreaterThanOrEqual(12);
      expect(prisma.portal_account.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: TENANT_ID,
          lead_id: LEAD_ID,
          email: 'john@example.com',
          must_change_password: true,
        }),
      });
    });

    it('should return null if portal account already exists (idempotent)', async () => {
      prisma.portal_account.findUnique.mockResolvedValue({
        id: PORTAL_ACCOUNT_ID,
        tenant_id: TENANT_ID,
        lead_id: LEAD_ID,
      });

      const result = await service.createForLead(TENANT_ID, LEAD_ID);

      expect(result).toBeNull();
      expect(prisma.portal_account.create).not.toHaveBeenCalled();
    });

    it('should return null if lead has no email', async () => {
      prisma.portal_account.findUnique.mockResolvedValue(null);
      prisma.lead.findFirst.mockResolvedValue({
        id: LEAD_ID,
        tenant_id: TENANT_ID,
        first_name: 'No',
        last_name: 'Email',
        emails: [],
      });
      prisma.lead_email.findFirst.mockResolvedValue(null);

      const result = await service.createForLead(TENANT_ID, LEAD_ID);

      expect(result).toBeNull();
      expect(prisma.portal_account.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if lead does not exist', async () => {
      prisma.portal_account.findUnique.mockResolvedValue(null);
      prisma.lead.findFirst.mockResolvedValue(null);

      await expect(service.createForLead(TENANT_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should queue welcome email after account creation', async () => {
      prisma.portal_account.findUnique.mockResolvedValue(null);
      prisma.lead.findFirst.mockResolvedValue({
        id: LEAD_ID,
        tenant_id: TENANT_ID,
        first_name: 'John',
        last_name: 'Smith',
        emails: [{ email: 'john@example.com', is_primary: true }],
      });
      prisma.portal_account.create.mockResolvedValue({ id: PORTAL_ACCOUNT_ID });
      prisma.tenant.findUnique.mockResolvedValue({
        subdomain: 'acme',
        company_name: 'ACME Plumbing',
      });

      await service.createForLead(TENANT_ID, LEAD_ID);

      expect(jobQueue.queueEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john@example.com',
          templateKey: 'portal-welcome',
          tenantId: TENANT_ID,
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // login
  // -----------------------------------------------------------------------
  describe('login', () => {
    const mockAccount = {
      id: PORTAL_ACCOUNT_ID,
      tenant_id: TENANT_ID,
      lead_id: LEAD_ID,
      email: 'john@example.com',
      customer_slug: 'john-smith',
      password_hash: '', // will be set in beforeEach
      must_change_password: true,
      is_active: true,
    };

    beforeEach(async () => {
      mockAccount.password_hash = await bcrypt.hash('Correct@Pass1', 10);
      prisma.tenant.findUnique.mockResolvedValue({
        id: TENANT_ID,
        subdomain: 'acme',
        is_active: true,
      });
    });

    it('should return token and customer_slug on valid login', async () => {
      prisma.portal_account.findUnique.mockResolvedValue(mockAccount);
      prisma.portal_account.update.mockResolvedValue(mockAccount);
      prisma.lead.findFirst.mockResolvedValue({
        first_name: 'John',
        last_name: 'Smith',
      });

      const result = await service.login('acme', 'john@example.com', 'Correct@Pass1');

      expect(result.token).toBe('mock-portal-jwt-token');
      expect(result.customer_slug).toBe('john-smith');
      expect(result.must_change_password).toBe(true);
      expect(result.lead).toEqual({ first_name: 'John', last_name: 'Smith' });
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: PORTAL_ACCOUNT_ID,
          tenant_id: TENANT_ID,
          lead_id: LEAD_ID,
          customer_slug: 'john-smith',
        }),
        expect.any(Object),
      );
    });

    it('should update last_login_at on successful login', async () => {
      prisma.portal_account.findUnique.mockResolvedValue(mockAccount);
      prisma.portal_account.update.mockResolvedValue(mockAccount);
      prisma.lead.findFirst.mockResolvedValue({
        first_name: 'John',
        last_name: 'Smith',
      });

      await service.login('acme', 'john@example.com', 'Correct@Pass1');

      expect(prisma.portal_account.update).toHaveBeenCalledWith({
        where: { id: PORTAL_ACCOUNT_ID },
        data: { last_login_at: expect.any(Date) },
      });
    });

    it('should throw UnauthorizedException for invalid tenant slug', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.login('nonexistent', 'john@example.com', 'Correct@Pass1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: TENANT_ID,
        subdomain: 'acme',
        is_active: false,
      });

      await expect(
        service.login('acme', 'john@example.com', 'Correct@Pass1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong email', async () => {
      prisma.portal_account.findUnique.mockResolvedValue(null);

      await expect(
        service.login('acme', 'wrong@example.com', 'Correct@Pass1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      prisma.portal_account.findUnique.mockResolvedValue(mockAccount);

      await expect(
        service.login('acme', 'john@example.com', 'WrongPassword1!'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive account', async () => {
      prisma.portal_account.findUnique.mockResolvedValue({
        ...mockAccount,
        is_active: false,
      });

      await expect(
        service.login('acme', 'john@example.com', 'Correct@Pass1'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // -----------------------------------------------------------------------
  // changePassword
  // -----------------------------------------------------------------------
  describe('changePassword', () => {
    it('should change password and set must_change_password to false', async () => {
      const hash = await bcrypt.hash('OldP@ss1', 10);
      prisma.portal_account.findFirst.mockResolvedValue({
        id: PORTAL_ACCOUNT_ID,
        password_hash: hash,
        is_active: true,
      });
      prisma.portal_account.update.mockResolvedValue({});

      const result = await service.changePassword(
        PORTAL_ACCOUNT_ID,
        TENANT_ID,
        'OldP@ss1',
        'NewP@ss1!',
      );

      expect(result.message).toBe('Password changed successfully');
      expect(prisma.portal_account.findFirst).toHaveBeenCalledWith({
        where: { id: PORTAL_ACCOUNT_ID, tenant_id: TENANT_ID, is_active: true },
      });
      expect(prisma.portal_account.update).toHaveBeenCalledWith({
        where: { id: PORTAL_ACCOUNT_ID },
        data: expect.objectContaining({
          must_change_password: false,
        }),
      });
    });

    it('should throw BadRequestException for incorrect old password', async () => {
      const hash = await bcrypt.hash('OldP@ss1', 10);
      prisma.portal_account.findFirst.mockResolvedValue({
        id: PORTAL_ACCOUNT_ID,
        password_hash: hash,
        is_active: true,
      });

      await expect(
        service.changePassword(PORTAL_ACCOUNT_ID, TENANT_ID, 'WrongOld!1', 'NewP@ss1!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if new password equals old', async () => {
      const hash = await bcrypt.hash('SameP@ss1', 10);
      prisma.portal_account.findFirst.mockResolvedValue({
        id: PORTAL_ACCOUNT_ID,
        password_hash: hash,
        is_active: true,
      });

      await expect(
        service.changePassword(PORTAL_ACCOUNT_ID, TENANT_ID, 'SameP@ss1', 'SameP@ss1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if portal account not found', async () => {
      prisma.portal_account.findFirst.mockResolvedValue(null);

      await expect(
        service.changePassword('nonexistent', TENANT_ID, 'OldP@ss1', 'NewP@ss1!'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // requestPasswordReset
  // -----------------------------------------------------------------------
  describe('requestPasswordReset', () => {
    it('should generate reset token and queue email', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: TENANT_ID,
        subdomain: 'acme',
        company_name: 'ACME',
        is_active: true,
      });
      prisma.portal_account.findUnique.mockResolvedValue({
        id: PORTAL_ACCOUNT_ID,
        lead_id: LEAD_ID,
        is_active: true,
      });
      prisma.portal_account.update.mockResolvedValue({});
      prisma.lead.findFirst.mockResolvedValue({
        first_name: 'John',
        last_name: 'Smith',
      });

      const result = await service.requestPasswordReset('acme', 'john@example.com');

      expect(result.message).toContain('password reset link');
      expect(prisma.portal_account.update).toHaveBeenCalledWith({
        where: { id: PORTAL_ACCOUNT_ID },
        data: expect.objectContaining({
          reset_token: expect.any(String),
          reset_token_expires_at: expect.any(Date),
        }),
      });
      expect(jobQueue.queueEmail).toHaveBeenCalled();
    });

    it('should return success even for non-existent email (prevent enumeration)', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: TENANT_ID,
        subdomain: 'acme',
        company_name: 'ACME',
        is_active: true,
      });
      prisma.portal_account.findUnique.mockResolvedValue(null);

      const result = await service.requestPasswordReset('acme', 'fake@example.com');

      expect(result.message).toContain('password reset link');
      expect(prisma.portal_account.update).not.toHaveBeenCalled();
    });

    it('should return success for non-existent tenant (prevent enumeration)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      const result = await service.requestPasswordReset('fake', 'john@example.com');

      expect(result.message).toContain('password reset link');
    });
  });

  // -----------------------------------------------------------------------
  // resetPassword
  // -----------------------------------------------------------------------
  describe('resetPassword', () => {
    it('should reset password and clear reset token', async () => {
      prisma.portal_account.findFirst.mockResolvedValue({
        id: PORTAL_ACCOUNT_ID,
        reset_token: 'valid-token',
        reset_token_expires_at: new Date(Date.now() + 3600000),
        is_active: true,
      });
      prisma.portal_account.update.mockResolvedValue({});

      const result = await service.resetPassword('valid-token', 'NewP@ss1!');

      expect(result.message).toContain('Password reset successfully');
      expect(prisma.portal_account.update).toHaveBeenCalledWith({
        where: { id: PORTAL_ACCOUNT_ID },
        data: expect.objectContaining({
          must_change_password: false,
          reset_token: null,
          reset_token_expires_at: null,
        }),
      });
    });

    it('should throw BadRequestException for invalid token', async () => {
      prisma.portal_account.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword('invalid-token', 'NewP@ss1!'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -----------------------------------------------------------------------
  // Tenant isolation — portal accounts are always scoped to tenant
  // -----------------------------------------------------------------------
  describe('Tenant Isolation', () => {
    it('should not login with wrong tenant slug', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.login('wrong-tenant', 'john@example.com', 'Correct@Pass1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should not find portal account across tenants', async () => {
      // Tenant B exists but has no account for this email
      prisma.tenant.findUnique.mockResolvedValue({
        id: TENANT_ID_B,
        subdomain: 'other',
        is_active: true,
      });
      prisma.portal_account.findUnique.mockResolvedValue(null); // not found in tenant B

      await expect(
        service.login('other', 'john@example.com', 'Correct@Pass1'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
