import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ImpersonationService } from './impersonation.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

describe('ImpersonationService', () => {
  let service: ImpersonationService;
  let prismaService: jest.Mocked<PrismaService>;
  let auditLogger: jest.Mocked<AuditLoggerService>;

  const mockAdmin = {
    id: 'admin-123',
    email: 'admin@lead360.com',
    is_platform_admin: true,
    tenant_id: null,
  };

  const mockUser = {
    id: 'user-456',
    email: 'user@tenant.com',
    first_name: 'John',
    last_name: 'Doe',
    tenant_id: 'tenant-789',
    tenant: {
      id: 'tenant-789',
      subdomain: 'acme',
      company_name: 'Acme Inc',
    },
  };

  const mockSession = {
    id: 'session-123',
    admin_user_id: 'admin-123',
    impersonated_user_id: 'user-456',
    impersonated_tenant_id: 'tenant-789',
    session_token: 'a'.repeat(64),
    expires_at: new Date(Date.now() + 3600000),
    created_at: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
      },
      impersonation_session: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const mockAuditLogger = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImpersonationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLoggerService,
          useValue: mockAuditLogger,
        },
      ],
    }).compile();

    service = module.get<ImpersonationService>(ImpersonationService);
    prismaService = module.get(PrismaService);
    auditLogger = module.get(AuditLoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startImpersonation', () => {
    it('should create impersonation session', async () => {
      prismaService.user.findUnique
        .mockResolvedValueOnce(mockAdmin)
        .mockResolvedValueOnce(mockUser);
      prismaService.impersonation_session.deleteMany.mockResolvedValue({
        count: 0,
      });
      prismaService.impersonation_session.create.mockResolvedValue(mockSession);

      const result = await service.startImpersonation('admin-123', 'user-456');

      expect(result).toHaveProperty('session_token');
      expect(result).toHaveProperty('expires_at');
      expect(result).toHaveProperty('impersonated_user');
      expect(result.session_token).toHaveLength(64);
      expect(prismaService.impersonation_session.deleteMany).toHaveBeenCalled();
      expect(auditLogger.log).toHaveBeenCalled();
    });

    it('should throw error if admin not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.startImpersonation('admin-123', 'user-456'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if user is not platform admin', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        ...mockAdmin,
        is_platform_admin: false,
      });

      await expect(
        service.startImpersonation('admin-123', 'user-456'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw error if target user not found', async () => {
      prismaService.user.findUnique
        .mockResolvedValueOnce(mockAdmin)
        .mockResolvedValueOnce(null);

      await expect(
        service.startImpersonation('admin-123', 'user-456'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if trying to impersonate another platform admin', async () => {
      prismaService.user.findUnique
        .mockResolvedValueOnce(mockAdmin)
        .mockResolvedValueOnce({ ...mockUser, is_platform_admin: true });

      await expect(
        service.startImpersonation('admin-123', 'user-456'),
      ).rejects.toThrow('Cannot impersonate another Platform Admin');
    });
  });

  describe('validateImpersonationSession', () => {
    it('should validate active session', async () => {
      prismaService.impersonation_session.findUnique.mockResolvedValue({
        ...mockSession,
        impersonated_user: mockUser,
        admin_user: mockAdmin,
      });

      const result = await service.validateImpersonationSession(
        mockSession.session_token,
      );

      expect(result).toHaveProperty('impersonated_user');
      expect(result).toHaveProperty('admin_user');
    });

    it('should throw error if session not found', async () => {
      prismaService.impersonation_session.findUnique.mockResolvedValue(null);

      await expect(
        service.validateImpersonationSession('invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw error if session expired', async () => {
      prismaService.impersonation_session.findUnique.mockResolvedValue({
        ...mockSession,
        expires_at: new Date(Date.now() - 1000),
      });

      await expect(
        service.validateImpersonationSession(mockSession.session_token),
      ).rejects.toThrow('Impersonation session has expired');
    });
  });

  describe('endImpersonation', () => {
    it('should end impersonation session', async () => {
      prismaService.impersonation_session.findUnique.mockResolvedValue(
        mockSession,
      );
      prismaService.impersonation_session.delete.mockResolvedValue(mockSession);

      const result = await service.endImpersonation(mockSession.session_token);

      expect(result).toHaveProperty('message');
      expect(prismaService.impersonation_session.delete).toHaveBeenCalled();
      expect(auditLogger.log).toHaveBeenCalled();
    });

    it('should throw error if session not found', async () => {
      prismaService.impersonation_session.findUnique.mockResolvedValue(null);

      await expect(service.endImpersonation('invalid-token')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getActiveSession', () => {
    it('should return active session for admin', async () => {
      prismaService.impersonation_session.findFirst.mockResolvedValue({
        ...mockSession,
        impersonated_user: mockUser,
      });

      const result = await service.getActiveSession('admin-123');

      expect(result).toHaveProperty('impersonated_user');
    });

    it('should return null if no active session', async () => {
      prismaService.impersonation_session.findFirst.mockResolvedValue(null);

      const result = await service.getActiveSession('admin-123');

      expect(result).toBeNull();
    });
  });

  describe('listSessions', () => {
    it('should return all active sessions', async () => {
      prismaService.impersonation_session.findFirst.mockResolvedValue({
        ...mockSession,
        admin_user: mockAdmin,
        impersonated_user: mockUser,
      });

      const result = await service.listSessions();

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
