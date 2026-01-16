import { Test, TestingModule } from '@nestjs/testing';
import { ExportProcessorProcessor } from './export-processor.processor';
import { ExportService } from '../services/export.service';

describe('ExportProcessorProcessor', () => {
  let processor: ExportProcessorProcessor;
  let exportService: jest.Mocked<ExportService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportProcessorProcessor,
        {
          provide: ExportService,
          useValue: {
            processExportJob: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<ExportProcessorProcessor>(ExportProcessorProcessor);
    exportService = module.get(ExportService);
  });

  it('should process export job', async () => {
    const mockJob = {
      id: 'job-123',
      data: {
        exportJobId: 'export-123',
        exportType: 'tenants',
        filters: {},
        format: 'csv',
      },
    };

    exportService.processExportJob.mockResolvedValue({
      filePath: '/exports/tenants-123.csv',
      rowCount: 150,
    });

    const result = await processor.process(mockJob as any);

    expect(result.success).toBe(true);
    expect(result.filePath).toBeDefined();
    expect(result.rowCount).toBe(150);
  });

  it('should throw error on failure', async () => {
    const mockJob = {
      id: 'job-123',
      data: { exportJobId: 'export-123' },
    };

    exportService.processExportJob.mockRejectedValue(new Error('Export failed'));

    await expect(processor.process(mockJob as any)).rejects.toThrow('Export failed');
  });
});
