import { S3StorageProvider } from './s3-storage.provider';
import type { StorageProviderConfig } from '../interfaces/storage-provider.interface';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mockClient } from 'aws-sdk-client-mock';

// Mock getSignedUrl
jest.mock('@aws-sdk/s3-request-presigner');

const s3Mock = mockClient(S3Client);

describe('S3StorageProvider', () => {
  let provider: S3StorageProvider;

  const mockConfig: StorageProviderConfig = {
    provider: 's3',
    s3Endpoint: 'https://s3.amazonaws.com',
    s3Region: 'us-east-1',
    s3Bucket: 'test-bucket',
    s3AccessKeyId: 'test-access-key',
    s3SecretKey: 'test-secret-key',
    s3UseSsl: true,
  };

  beforeEach(() => {
    s3Mock.reset();
    provider = new S3StorageProvider(mockConfig);
    (getSignedUrl as jest.Mock).mockResolvedValue(
      'https://signed-url.com/file',
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with S3 configuration', () => {
      expect(provider).toBeDefined();
      expect(provider.getProviderType()).toBe('s3');
    });

    it('should throw error if configuration is incomplete', () => {
      expect(() => {
        new S3StorageProvider({
          provider: 's3',
          s3Bucket: undefined,
          s3AccessKeyId: 'key',
          s3SecretKey: 'secret',
        });
      }).toThrow('S3 configuration is incomplete');
    });

    it('should use default region if not provided', () => {
      const configWithoutRegion: StorageProviderConfig = {
        provider: 's3',
        s3Bucket: 'test-bucket',
        s3AccessKeyId: 'key',
        s3SecretKey: 'secret',
      };

      const providerWithoutRegion = new S3StorageProvider(configWithoutRegion);
      expect(providerWithoutRegion).toBeDefined();
    });
  });

  describe('upload', () => {
    it('should upload file to S3 with correct key', async () => {
      const mockBuffer = Buffer.from('test file content');
      s3Mock.on(PutObjectCommand).resolves({});

      const result = await provider.upload({
        tenantId: 'tenant-123',
        category: 'invoice',
        originalFilename: 'document.pdf',
        buffer: mockBuffer,
        mimeType: 'application/pdf',
      });

      expect(s3Mock.commandCalls(PutObjectCommand).length).toBe(1);
      const call = s3Mock.commandCalls(PutObjectCommand)[0];
      expect(call.args[0].input.Bucket).toBe('test-bucket');
      expect(call.args[0].input.Key).toMatch(/^tenant-123\/files\/.+\.pdf$/);
      expect(call.args[0].input.Body).toBe(mockBuffer);
      expect(call.args[0].input.ContentType).toBe('application/pdf');

      expect(result.fileId).toBeDefined();
      expect(result.size).toBe(mockBuffer.length);
      expect(result.url).toContain('signed-url.com');
    });

    it('should upload logo files to images folder', async () => {
      const mockBuffer = Buffer.from('logo content');
      s3Mock.on(PutObjectCommand).resolves({});

      await provider.upload({
        tenantId: 'tenant-456',
        category: 'logo',
        originalFilename: 'company-logo.png',
        buffer: mockBuffer,
        mimeType: 'image/png',
      });

      const call = s3Mock.commandCalls(PutObjectCommand)[0];
      expect(call.args[0].input.Bucket).toBe('test-bucket');
      expect(call.args[0].input.Key).toMatch(/^tenant-456\/images\/.+\.png$/);
    });

    it('should generate pre-signed URL with 1 hour expiration', async () => {
      const mockBuffer = Buffer.from('test content');
      s3Mock.on(PutObjectCommand).resolves({});

      await provider.upload({
        tenantId: 'tenant-123',
        category: 'photo',
        originalFilename: 'photo.jpg',
        buffer: mockBuffer,
        mimeType: 'image/jpeg',
      });

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(S3Client),
        expect.any(GetObjectCommand),
        { expiresIn: 3600 },
      );
    });

    it('should throw error if S3 upload fails', async () => {
      s3Mock.on(PutObjectCommand).rejects(new Error('S3 upload failed'));

      await expect(
        provider.upload({
          tenantId: 'tenant-123',
          category: 'invoice',
          originalFilename: 'document.pdf',
          buffer: Buffer.from('test'),
          mimeType: 'application/pdf',
        }),
      ).rejects.toThrow('S3 upload failed');
    });

    it('should generate unique file IDs', async () => {
      const mockBuffer = Buffer.from('test content');
      s3Mock.on(PutObjectCommand).resolves({});

      const result1 = await provider.upload({
        tenantId: 'tenant-123',
        category: 'photo',
        originalFilename: 'photo.jpg',
        buffer: mockBuffer,
        mimeType: 'image/jpeg',
      });

      const result2 = await provider.upload({
        tenantId: 'tenant-123',
        category: 'photo',
        originalFilename: 'photo.jpg',
        buffer: mockBuffer,
        mimeType: 'image/jpeg',
      });

      expect(result1.fileId).not.toBe(result2.fileId);
    });
  });

  describe('uploadThumbnail', () => {
    it('should upload thumbnail with _thumb suffix', async () => {
      const mockBuffer = Buffer.from('thumbnail content');
      s3Mock.on(PutObjectCommand).resolves({});

      await provider.uploadThumbnail({
        tenantId: 'tenant-123',
        category: 'photo',
        originalFilename: 'image.jpg',
        buffer: mockBuffer,
        mimeType: 'image/jpeg',
      });

      const call = s3Mock.commandCalls(PutObjectCommand)[0];
      expect(call.args[0].input.Key).toMatch(
        /^tenant-123\/images\/.+_thumb\.jpg$/,
      );
    });
  });

  describe('download', () => {
    it('should download file from S3', async () => {
      const mockBuffer = Buffer.from('file content');
      const { Readable } = require('stream');
      const mockStream = Readable.from([mockBuffer]);

      s3Mock.on(GetObjectCommand).resolves({
        Body: mockStream,
      });

      const result = await provider.download(
        'file-123',
        'tenant-123/files/document.pdf',
      );

      const call = s3Mock.commandCalls(GetObjectCommand)[0];
      expect(call.args[0].input.Bucket).toBe('test-bucket');
      expect(call.args[0].input.Key).toBe('tenant-123/files/document.pdf');

      expect(result).toEqual(mockBuffer);
    });

    it('should throw error if S3 download fails', async () => {
      s3Mock.on(GetObjectCommand).rejects(new Error('NoSuchKey'));

      await expect(
        provider.download('file-123', 'tenant-123/files/nonexistent.pdf'),
      ).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete file from S3', async () => {
      s3Mock.on(DeleteObjectCommand).resolves({});

      await provider.delete('file-123', 'tenant-123/files/document.pdf');

      const call = s3Mock.commandCalls(DeleteObjectCommand)[0];
      expect(call.args[0].input.Bucket).toBe('test-bucket');
      expect(call.args[0].input.Key).toBe('tenant-123/files/document.pdf');
    });

    it('should not throw error if file does not exist', async () => {
      s3Mock.on(DeleteObjectCommand).rejects({ name: 'NoSuchKey' });

      await expect(
        provider.delete('file-123', 'tenant-123/files/nonexistent.pdf'),
      ).resolves.toBeUndefined();
    });

    it('should not throw error for other S3 errors (logs warning instead)', async () => {
      s3Mock.on(DeleteObjectCommand).rejects(new Error('Access Denied'));

      // Delete catches all errors and logs a warning instead of throwing
      await expect(
        provider.delete('file-123', 'tenant-123/files/document.pdf'),
      ).resolves.toBeUndefined();
    });
  });

  describe('exists', () => {
    it('should return true if file exists in S3', async () => {
      s3Mock.on(HeadObjectCommand).resolves({});

      const result = await provider.exists(
        'file-123',
        'tenant-123/files/document.pdf',
      );

      const call = s3Mock.commandCalls(HeadObjectCommand)[0];
      expect(call.args[0].input.Bucket).toBe('test-bucket');
      expect(call.args[0].input.Key).toBe('tenant-123/files/document.pdf');

      expect(result).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      s3Mock.on(HeadObjectCommand).rejects({ name: 'NotFound' });

      const result = await provider.exists(
        'file-123',
        'tenant-123/files/nonexistent.pdf',
      );

      expect(result).toBe(false);
    });

    it('should return false for other S3 errors', async () => {
      s3Mock.on(HeadObjectCommand).rejects(new Error('Access Denied'));

      // exists catches all errors and returns false
      const result = await provider.exists(
        'file-123',
        'tenant-123/files/document.pdf',
      );

      expect(result).toBe(false);
    });
  });

  describe('getFileUrl', () => {
    it('should generate pre-signed URL for S3 object', async () => {
      const expectedUrl =
        'https://s3.amazonaws.com/test-bucket/tenant-123/files/document.pdf?signature=xyz';
      (getSignedUrl as jest.Mock).mockResolvedValue(expectedUrl);

      const url = await provider.getFileUrl(
        'file-123',
        'tenant-123/files/document.pdf',
      );

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(S3Client),
        expect.any(GetObjectCommand),
        { expiresIn: 3600 },
      );

      expect(url).toBe(expectedUrl);
    });
  });

  describe('getProviderType', () => {
    it('should return s3 as provider type', () => {
      expect(provider.getProviderType()).toBe('s3');
    });
  });
});
