import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ExportService } from './export.service';
import { PrismaService } from '../../../core/database/prisma.service';

describe('ExportService', () => {
  let service: ExportService;
  let prismaService: jest.Mocked<PrismaService>;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        {
          provide: PrismaService,
          useValue: {
            export_job: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
            tenant: {
              findMany: jest.fn(),
            },
            user: {
              findMany: jest.fn(),
            },
            audit_log: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: getQueueToken('export'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);
    prismaService = module.get(PrismaService);
  });

  describe('exportTenants', () => {
    it('should queue export job', async () => {
      prismaService.export_job.create.mockResolvedValue({
        id: 'export-123',
        status: 'pending',
      });

      const result = await service.exportTenants({}, 'csv', 'admin-123');

      expect(result.status).toBe('pending');
      expect(mockQueue.add).toHaveBeenCalled();
    });
  });

  describe('processExportJob', () => {
    it('should process CSV export', async () => {
      prismaService.export_job.findUnique.mockResolvedValue({
        id: 'export-123',
        export_type: 'tenants',
        format: 'csv',
        filters: {},
      });
      prismaService.tenant.findMany.mockResolvedValue([
        { id: 'tenant-1', company_name: 'Test Co' },
      ]);
      prismaService.export_job.update.mockResolvedValue({
        id: 'export-123',
        status: 'completed',
      });

      const result = await service.processExportJob('export-123');

      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('rowCount');
    });
  });

  describe('getExportHistory', () => {
    it('should return user export history', async () => {
      prismaService.export_job.findMany.mockResolvedValue([
        {
          id: 'export-1',
          status: 'completed',
          created_at: new Date(),
        },
      ]);

      const result = await service.getExportHistory('admin-123', 10);

      expect(result).toHaveLength(1);
    });
  });
});
