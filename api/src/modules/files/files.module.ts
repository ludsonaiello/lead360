import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { PrismaModule } from '../../core/database/prisma.module';
import { FileStorageModule } from '../../core/file-storage/file-storage.module';
import { AuditModule } from '../audit/audit.module';
import { FileCleanupProcessor } from './processors/file-cleanup.processor';
import { FileCleanupScheduler } from './schedulers/file-cleanup.scheduler';

@Module({
  imports: [
    PrismaModule,
    FileStorageModule,
    AuditModule,
    BullModule.registerQueue({
      name: 'file-cleanup',
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService, FileCleanupProcessor, FileCleanupScheduler],
  exports: [FilesService],
})
export class FilesModule {}
