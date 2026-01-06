import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { AuditLoggerService } from './audit-logger.service';
import { PrismaService } from '../../../core/database/prisma.service';

describe('AuditLoggerService', () => {
  let service: AuditLoggerService;
  let prismaService: jest.Mocked<PrismaService>;
  let mockQueue: any;

  const mockLogData = {
    tenant_id: 'tenant-123',
    actor_user_id: 'user-456',
    actor_type: 'user' as const,
    entity_type: 'lead',
    entity_id: 'lead-789',
    description: 'Lead created',
    action_type: 'created' as const,
    status: 'success' as const,
    ip_address: '192.168.1.1',
    user_agent: 'Mozilla/5.0',
  };

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
    };

    const mockPrismaService = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-123' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLoggerService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: getQueueToken('audit-log-write'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<AuditLoggerService>(AuditLoggerService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should queue log entry when queue is available', async () => {
      await service.log(mockLogData);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'write-log',
        mockLogData,
        expect.objectContaining({
          attempts: 3,
          backoff: expect.any(Object),
        }),
      );
      expect(prismaService.auditLog.create).not.toHaveBeenCalled();
    });

    it('should fall back to direct DB write if queue fails', async () => {
      mockQueue.add.mockRejectedValueOnce(new Error('Queue unavailable'));

      await service.log(mockLogData);

      expect(mockQueue.add).toHaveBeenCalled();
      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: mockLogData,
      });
    });

    it('should not throw error even if direct write fails', async () => {
      mockQueue.add.mockRejectedValueOnce(new Error('Queue unavailable'));
      prismaService.auditLog.create.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.log(mockLogData)).resolves.not.toThrow();
    });
  });

  describe('logAuth', () => {
    it('should log successful login', async () => {
      await service.logAuth({
        event: 'login',
        userId: 'user-123',
        tenantId: 'tenant-456',
        status: 'success',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'write-log',
        expect.objectContaining({
          tenant_id: 'tenant-456',
          actor_user_id: 'user-123',
          actor_type: 'user',
          entity_type: 'auth_session',
          description: 'User logged in',
          action_type: 'accessed',
          status: 'success',
        }),
        expect.any(Object),
      );
    });

    it('should log failed login', async () => {
      await service.logAuth({
        event: 'login',
        userId: 'user-123',
        tenantId: 'tenant-456',
        status: 'failure',
        errorMessage: 'Invalid credentials',
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'write-log',
        expect.objectContaining({
          entity_type: 'auth_attempt',
          description: 'Login failed',
          status: 'failure',
          error_message: 'Invalid credentials',
        }),
        expect.any(Object),
      );
    });

    it('should log registration', async () => {
      await service.logAuth({
        event: 'register',
        userId: 'user-new',
        tenantId: 'tenant-456',
        status: 'success',
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'write-log',
        expect.objectContaining({
          description: 'User registered successfully',
          action_type: 'created',
        }),
        expect.any(Object),
      );
    });
  });

  describe('logTenantChange', () => {
    it('should log tenant creation with after data', async () => {
      const afterData = {
        id: 'tenant-new',
        legal_name: 'New Company LLC',
        subdomain: 'newco',
      };

      await service.logTenantChange({
        action: 'created',
        entityType: 'tenant',
        entityId: 'tenant-new',
        tenantId: 'tenant-new',
        actorUserId: 'user-123',
        after: afterData,
        description: 'Tenant created',
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'write-log',
        expect.objectContaining({
          action_type: 'created',
          entity_type: 'tenant',
          after_json: afterData,
          before_json: undefined,
        }),
        expect.any(Object),
      );
    });

    it('should log tenant update with before and after data', async () => {
      const beforeData = { legal_name: 'Old Name' };
      const afterData = { legal_name: 'New Name' };

      await service.logTenantChange({
        action: 'updated',
        entityType: 'tenant',
        entityId: 'tenant-123',
        tenantId: 'tenant-123',
        actorUserId: 'user-456',
        before: beforeData,
        after: afterData,
        description: 'Tenant name updated',
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'write-log',
        expect.objectContaining({
          action_type: 'updated',
          before_json: beforeData,
          after_json: afterData,
        }),
        expect.any(Object),
      );
    });

    it('should sanitize sensitive data in before/after', async () => {
      const beforeData = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'secret123',
        password_hash: 'hashed',
        api_key: 'key123',
      };

      await service.logTenantChange({
        action: 'updated',
        entityType: 'user',
        entityId: 'user-123',
        tenantId: 'tenant-456',
        actorUserId: 'user-admin',
        before: beforeData,
        description: 'User updated',
      });

      const callArgs = mockQueue.add.mock.calls[0][1];
      expect(callArgs.before_json.password).toBe('[REDACTED]');
      expect(callArgs.before_json.password_hash).toBe('[REDACTED]');
      expect(callArgs.before_json.api_key).toBe('[REDACTED]');
      expect(callArgs.before_json.email).toBe('test@example.com');
    });
  });

  describe('logRBACChange', () => {
    it('should log role assignment', async () => {
      await service.logRBACChange({
        action: 'created',
        entityType: 'user_role',
        entityId: 'user-role-123',
        tenantId: 'tenant-456',
        actorUserId: 'user-admin',
        description: 'Role assigned to user',
        metadata: {
          userId: 'user-789',
          roleId: 'role-admin',
        },
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'write-log',
        expect.objectContaining({
          entity_type: 'user_role',
          action_type: 'created',
          metadata_json: expect.objectContaining({
            userId: 'user-789',
            roleId: 'role-admin',
          }),
        }),
        expect.any(Object),
      );
    });
  });

  describe('logFailedAction', () => {
    it('should log permission denied error', async () => {
      await service.logFailedAction({
        entityType: 'lead',
        actorUserId: 'user-123',
        tenantId: 'tenant-456',
        errorMessage: 'Permission denied: leads.delete',
        description: 'Failed to delete lead',
        metadata: {
          endpoint: '/api/v1/leads/lead-789',
          method: 'DELETE',
        },
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'write-log',
        expect.objectContaining({
          action_type: 'failed',
          status: 'failure',
          error_message: 'Permission denied: leads.delete',
          entity_id: 'N/A',
        }),
        expect.any(Object),
      );
    });

    it('should log system error without user', async () => {
      await service.logFailedAction({
        entityType: 'system',
        errorMessage: 'Database connection failed',
        description: 'System error',
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'write-log',
        expect.objectContaining({
          actor_type: 'system',
          actor_user_id: undefined,
        }),
        expect.any(Object),
      );
    });
  });
});
