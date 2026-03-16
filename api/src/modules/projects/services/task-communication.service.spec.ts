import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TaskCommunicationService } from './task-communication.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { SmsSendingService } from '../../communication/services/sms-sending.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { ProjectActivityService } from './project-activity.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-001';
const TENANT_B_ID = 'tenant-uuid-002';
const USER_ID = 'user-uuid-001';
const PROJECT_ID = 'project-uuid-001';
const TASK_ID = 'task-uuid-001';
const LEAD_ID = 'lead-uuid-001';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockTask = (overrides: any = {}) => ({
  id: TASK_ID,
  title: 'Install new shingles',
  ...overrides,
});

const mockProject = (overrides: any = {}) => ({
  id: PROJECT_ID,
  name: 'Roof Repair Project',
  lead_id: LEAD_ID,
  ...overrides,
});

const mockLead = (overrides: any = {}) => ({
  id: LEAD_ID,
  phones: [{ phone: '+19781234567' }],
  ...overrides,
});

const mockSmsResponse = (overrides: any = {}) => ({
  communication_event_id: 'comm-event-uuid-001',
  job_id: '12345',
  status: 'queued',
  message: 'SMS queued for delivery',
  to_phone: '+19781234567',
  from_phone: '+18001234567',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  project_task: {
    findFirst: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
  },
  lead: {
    findFirst: jest.fn(),
  },
};

const mockSmsSendingService = {
  sendSms: jest.fn(),
};

const mockAuditLogger = {
  logTenantChange: jest.fn(),
};

const mockActivityService = {
  logActivity: jest.fn(),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('TaskCommunicationService', () => {
  let service: TaskCommunicationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskCommunicationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SmsSendingService, useValue: mockSmsSendingService },
        { provide: AuditLoggerService, useValue: mockAuditLogger },
        { provide: ProjectActivityService, useValue: mockActivityService },
      ],
    }).compile();

    service = module.get<TaskCommunicationService>(TaskCommunicationService);

    jest.clearAllMocks();
  });

  // =========================================================================
  // SEND SMS FROM TASK — Happy path with explicit phone
  // =========================================================================

  describe('sendSmsFromTask — explicit to_phone', () => {
    it('should send SMS with explicit to_phone and return response', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockSmsSendingService.sendSms.mockResolvedValue(mockSmsResponse());

      const dto = {
        to_phone: '+19781234567',
        text_body: 'Hi John, your roof installation starts tomorrow at 8 AM.',
      };

      const result = await service.sendSmsFromTask(
        TENANT_ID,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        dto,
      );

      expect(result).toEqual({
        message: 'SMS queued for delivery',
        communication_event_id: 'comm-event-uuid-001',
        to_phone: '+19781234567',
        status: 'queued',
      });

      // Verify SmsSendingService was called with correct params
      expect(mockSmsSendingService.sendSms).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        {
          to_phone: '+19781234567',
          text_body: dto.text_body,
          lead_id: LEAD_ID, // resolved from project
          related_entity_type: 'project_task',
          related_entity_id: TASK_ID,
        },
      );
    });

    it('should use dto.lead_id over project.lead_id when provided', async () => {
      const customLeadId = 'custom-lead-uuid';

      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockSmsSendingService.sendSms.mockResolvedValue(mockSmsResponse());

      const dto = {
        to_phone: '+19781234567',
        text_body: 'Test message',
        lead_id: customLeadId,
      };

      await service.sendSmsFromTask(
        TENANT_ID,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        dto,
      );

      expect(mockSmsSendingService.sendSms).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        expect.objectContaining({
          lead_id: customLeadId,
        }),
      );
    });
  });

  // =========================================================================
  // SEND SMS FROM TASK — Phone resolution from lead
  // =========================================================================

  describe('sendSmsFromTask — phone resolved from lead', () => {
    it('should resolve phone from lead primary phone when to_phone not provided', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.lead.findFirst.mockResolvedValue(mockLead());
      mockSmsSendingService.sendSms.mockResolvedValue(mockSmsResponse());

      const dto = {
        text_body: 'Hi John, your roof installation starts tomorrow.',
      };

      await service.sendSmsFromTask(
        TENANT_ID,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        dto,
      );

      // Should have looked up the lead
      expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith({
        where: {
          id: LEAD_ID,
          tenant_id: TENANT_ID,
        },
        select: {
          id: true,
          phones: {
            where: { is_primary: true },
            select: { phone: true },
            take: 1,
          },
        },
      });

      // Should have called SMS service with resolved phone
      expect(mockSmsSendingService.sendSms).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        expect.objectContaining({
          to_phone: '+19781234567',
          related_entity_type: 'project_task',
          related_entity_id: TASK_ID,
        }),
      );
    });

    it('should normalize 10-digit phone to E.164', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.lead.findFirst.mockResolvedValue(
        mockLead({ phones: [{ phone: '9781234567' }] }),
      );
      mockSmsSendingService.sendSms.mockResolvedValue(mockSmsResponse());

      await service.sendSmsFromTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        text_body: 'Test',
      });

      expect(mockSmsSendingService.sendSms).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        expect.objectContaining({
          to_phone: '+19781234567',
        }),
      );
    });

    it('should normalize 11-digit phone (1+) to E.164', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.lead.findFirst.mockResolvedValue(
        mockLead({ phones: [{ phone: '19781234567' }] }),
      );
      mockSmsSendingService.sendSms.mockResolvedValue(mockSmsResponse());

      await service.sendSmsFromTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        text_body: 'Test',
      });

      expect(mockSmsSendingService.sendSms).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        expect.objectContaining({
          to_phone: '+19781234567',
        }),
      );
    });

    it('should normalize formatted phone (with dashes/parens) to E.164', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.lead.findFirst.mockResolvedValue(
        mockLead({ phones: [{ phone: '(978) 123-4567' }] }),
      );
      mockSmsSendingService.sendSms.mockResolvedValue(mockSmsResponse());

      await service.sendSmsFromTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        text_body: 'Test',
      });

      expect(mockSmsSendingService.sendSms).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        expect.objectContaining({
          to_phone: '+19781234567',
        }),
      );
    });
  });

  // =========================================================================
  // ERROR CASES
  // =========================================================================

  describe('sendSmsFromTask — error cases', () => {
    it('should throw NotFoundException when task not found', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.sendSmsFromTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          to_phone: '+19781234567',
          text_body: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockSmsSendingService.sendSms).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.sendSmsFromTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          to_phone: '+19781234567',
          text_body: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockSmsSendingService.sendSms).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for standalone project without to_phone', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(
        mockProject({ lead_id: null }),
      );

      await expect(
        service.sendSmsFromTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          text_body: 'Test',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.sendSmsFromTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          text_body: 'Test',
        }),
      ).rejects.toThrow('Standalone projects require an explicit to_phone');

      expect(mockSmsSendingService.sendSms).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when lead not found during phone resolution', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.lead.findFirst.mockResolvedValue(null);

      await expect(
        service.sendSmsFromTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          text_body: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.sendSmsFromTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          text_body: 'Test',
        }),
      ).rejects.toThrow('Lead not found');

      expect(mockSmsSendingService.sendSms).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when lead has no primary phone', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.lead.findFirst.mockResolvedValue(
        mockLead({ phones: [] }),
      );

      await expect(
        service.sendSmsFromTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          text_body: 'Test',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.sendSmsFromTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          text_body: 'Test',
        }),
      ).rejects.toThrow('No phone number available for this lead');
    });
  });

  // =========================================================================
  // TENANT ISOLATION
  // =========================================================================

  describe('tenant isolation', () => {
    it('should not find task from another tenant', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.sendSmsFromTask(TENANT_B_ID, PROJECT_ID, TASK_ID, USER_ID, {
          to_phone: '+19781234567',
          text_body: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.project_task.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_B_ID,
          }),
        }),
      );
    });

    it('should not find project from another tenant', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.sendSmsFromTask(TENANT_B_ID, PROJECT_ID, TASK_ID, USER_ID, {
          to_phone: '+19781234567',
          text_body: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_B_ID,
          }),
        }),
      );
    });

    it('should not resolve phone from lead of another tenant', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.lead.findFirst.mockResolvedValue(null);

      await expect(
        service.sendSmsFromTask(TENANT_B_ID, PROJECT_ID, TASK_ID, USER_ID, {
          text_body: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_B_ID,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // SMS METADATA — correct related_entity linking
  // =========================================================================

  describe('SMS metadata and entity linking', () => {
    it('should pass related_entity_type=project_task and related_entity_id=taskId', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockSmsSendingService.sendSms.mockResolvedValue(mockSmsResponse());

      await service.sendSmsFromTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        to_phone: '+19781234567',
        text_body: 'Test',
      });

      expect(mockSmsSendingService.sendSms).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        expect.objectContaining({
          related_entity_type: 'project_task',
          related_entity_id: TASK_ID,
        }),
      );
    });

    it('should pass lead_id from project when not in dto', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(
        mockProject({ lead_id: 'project-lead-uuid' }),
      );
      mockSmsSendingService.sendSms.mockResolvedValue(mockSmsResponse());

      await service.sendSmsFromTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        to_phone: '+19781234567',
        text_body: 'Test',
      });

      expect(mockSmsSendingService.sendSms).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        expect.objectContaining({
          lead_id: 'project-lead-uuid',
        }),
      );
    });

    it('should pass null lead_id for standalone project with explicit phone', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(
        mockProject({ lead_id: null }),
      );
      mockSmsSendingService.sendSms.mockResolvedValue(mockSmsResponse());

      await service.sendSmsFromTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        to_phone: '+19781234567',
        text_body: 'Test',
      });

      expect(mockSmsSendingService.sendSms).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        expect.objectContaining({
          lead_id: undefined,
        }),
      );
    });
  });

  // =========================================================================
  // AUDIT AND ACTIVITY LOGGING
  // =========================================================================

  describe('audit and activity logging', () => {
    it('should create audit log on successful SMS', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockSmsSendingService.sendSms.mockResolvedValue(mockSmsResponse());

      await service.sendSmsFromTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        to_phone: '+19781234567',
        text_body: 'Test',
      });

      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'task_sms',
          entityId: 'comm-event-uuid-001',
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
        }),
      );
    });

    it('should create activity log on successful SMS', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockSmsSendingService.sendSms.mockResolvedValue(mockSmsResponse());

      await service.sendSmsFromTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        to_phone: '+19781234567',
        text_body: 'Test',
      });

      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          project_id: PROJECT_ID,
          user_id: USER_ID,
          activity_type: 'sms_sent',
          metadata: expect.objectContaining({
            task_id: TASK_ID,
            to_phone: '+19781234567',
            communication_event_id: 'comm-event-uuid-001',
          }),
        }),
      );
    });

    it('should not create audit/activity logs when task not found', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.sendSmsFromTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          to_phone: '+19781234567',
          text_body: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockAuditLogger.logTenantChange).not.toHaveBeenCalled();
      expect(mockActivityService.logActivity).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // EDGE CASES
  // =========================================================================

  describe('edge cases', () => {
    it('should skip phone resolution when explicit to_phone is provided even if project has lead_id', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockSmsSendingService.sendSms.mockResolvedValue(mockSmsResponse());

      await service.sendSmsFromTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
        to_phone: '+15551234567',
        text_body: 'Test',
      });

      // Should NOT look up lead phone
      expect(mockPrisma.lead.findFirst).not.toHaveBeenCalled();

      // Should use explicit phone
      expect(mockSmsSendingService.sendSms).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        expect.objectContaining({
          to_phone: '+15551234567',
        }),
      );
    });

    it('should handle standalone project with explicit to_phone (no lead_id)', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(
        mockProject({ lead_id: null }),
      );
      mockSmsSendingService.sendSms.mockResolvedValue(mockSmsResponse());

      const result = await service.sendSmsFromTask(
        TENANT_ID,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        {
          to_phone: '+19781234567',
          text_body: 'Test standalone',
        },
      );

      expect(result.status).toBe('queued');
      expect(mockPrisma.lead.findFirst).not.toHaveBeenCalled();
    });

    it('should validate soft-deleted tasks are not found', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.sendSmsFromTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          to_phone: '+19781234567',
          text_body: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);

      // Verify the query includes deleted_at: null
      expect(mockPrisma.project_task.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deleted_at: null,
          }),
        }),
      );
    });
  });
});
