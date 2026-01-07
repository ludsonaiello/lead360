import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileStorageService } from './file-storage.service';
import { StorageProviderFactory } from './storage-provider.factory';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { ImageProcessorService } from './image-processor.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    FileStorageService,
    StorageProviderFactory,
    ImageProcessorService,
  ],
  exports: [FileStorageService, StorageProviderFactory, ImageProcessorService],
})
export class FileStorageModule {}
