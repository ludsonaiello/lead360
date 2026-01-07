import { LocalStorageProvider } from './local-storage.provider';
import type { StorageProviderConfig } from '../interfaces/storage-provider.interface';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

describe('LocalStorageProvider', () => {
  let provider: LocalStorageProvider;
  const testBasePath = path.join(__dirname, '../../../../test-uploads');

  const mockConfig: StorageProviderConfig = {
    provider: 'local',
    localBasePath: testBasePath,
  };

  beforeAll(async () => {
    // Create test directory
    await fs.mkdir(testBasePath, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(testBasePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    provider = new LocalStorageProvider(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with provided base path', () => {
      expect(provider).toBeDefined();
      expect(provider.getProviderType()).toBe('local');
    });

    it('should initialize with default base path if not provided', () => {
      const defaultProvider = new LocalStorageProvider({ provider: 'local' });
      expect(defaultProvider).toBeDefined();
      expect(defaultProvider.getProviderType()).toBe('local');
    });
  });

  describe('upload', () => {
    it('should upload file to correct path for non-logo files', async () => {
      const mockBuffer = Buffer.from('test file content');
      const tenantId = randomUUID();

      const result = await provider.upload({
        tenantId,
        category: 'invoice',
        originalFilename: 'test-invoice.pdf',
        buffer: mockBuffer,
        mimeType: 'application/pdf',
      });

      expect(result.fileId).toBeDefined();
      expect(result.url).toContain(`/public/${tenantId}/files/`);
      expect(result.url).toMatch(/\.pdf$/);
      expect(result.size).toBe(mockBuffer.length);
      expect(result.storagePath).toContain('files');

      // Verify file was actually created
      const fileExists = await fs.access(result.storagePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Clean up
      await fs.unlink(result.storagePath);
    });

    it('should upload logo files to images folder', async () => {
      const mockBuffer = Buffer.from('logo content');
      const tenantId = randomUUID();

      const result = await provider.upload({
        tenantId,
        category: 'logo',
        originalFilename: 'company-logo.png',
        buffer: mockBuffer,
        mimeType: 'image/png',
      });

      expect(result.url).toContain(`/public/${tenantId}/images/`);
      expect(result.url).toMatch(/\.png$/);
      expect(result.storagePath).toContain('images');

      // Verify file was actually created
      const fileExists = await fs.access(result.storagePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Clean up
      await fs.unlink(result.storagePath);
    });

    it('should generate unique file IDs', async () => {
      const mockBuffer = Buffer.from('test content');
      const tenantId = randomUUID();

      const result1 = await provider.upload({
        tenantId,
        category: 'photo',
        originalFilename: 'photo.jpg',
        buffer: mockBuffer,
        mimeType: 'image/jpeg',
      });

      const result2 = await provider.upload({
        tenantId,
        category: 'photo',
        originalFilename: 'photo.jpg',
        buffer: mockBuffer,
        mimeType: 'image/jpeg',
      });

      expect(result1.fileId).not.toBe(result2.fileId);

      // Clean up
      await fs.unlink(result1.storagePath);
      await fs.unlink(result2.storagePath);
    });

    it('should create directory structure if it does not exist', async () => {
      const mockBuffer = Buffer.from('test content');
      const tenantId = randomUUID();

      const result = await provider.upload({
        tenantId,
        category: 'invoice',
        originalFilename: 'invoice.pdf',
        buffer: mockBuffer,
        mimeType: 'application/pdf',
      });

      expect(result.fileId).toBeDefined();

      // Verify directory was created
      const dirExists = await fs.access(path.dirname(result.storagePath)).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);

      // Clean up
      await fs.unlink(result.storagePath);
    });
  });

  describe('uploadThumbnail', () => {
    it('should upload thumbnail with _thumb suffix', async () => {
      const mockBuffer = Buffer.from('thumbnail content');
      const tenantId = randomUUID();

      const result = await provider.uploadThumbnail({
        tenantId,
        category: 'photo',
        originalFilename: 'image.jpg',
        buffer: mockBuffer,
        mimeType: 'image/jpeg',
      });

      expect(result.url).toContain('_thumb');
      expect(result.storagePath).toContain('_thumb');
      expect(result.storagePath).toContain('images');

      // Verify file was created
      const fileExists = await fs.access(result.storagePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Clean up
      await fs.unlink(result.storagePath);
    });
  });

  describe('download', () => {
    it('should read file from storage path', async () => {
      // First upload a file
      const originalContent = Buffer.from('file content to download');
      const tenantId = randomUUID();

      const uploadResult = await provider.upload({
        tenantId,
        category: 'invoice',
        originalFilename: 'test.pdf',
        buffer: originalContent,
        mimeType: 'application/pdf',
      });

      // Then download it
      const downloadedContent = await provider.download(uploadResult.fileId, uploadResult.storagePath);

      expect(downloadedContent).toEqual(originalContent);

      // Clean up
      await fs.unlink(uploadResult.storagePath);
    });

    it('should throw error if file not found', async () => {
      await expect(
        provider.download('file-123', '/nonexistent/file.pdf')
      ).rejects.toThrow('File not found');
    });
  });

  describe('delete', () => {
    it('should delete file from storage', async () => {
      // First upload a file
      const mockBuffer = Buffer.from('file to delete');
      const tenantId = randomUUID();

      const uploadResult = await provider.upload({
        tenantId,
        category: 'invoice',
        originalFilename: 'delete-me.pdf',
        buffer: mockBuffer,
        mimeType: 'application/pdf',
      });

      // Verify file exists
      let fileExists = await fs.access(uploadResult.storagePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Delete it
      await provider.delete(uploadResult.fileId, uploadResult.storagePath);

      // Verify file is gone
      fileExists = await fs.access(uploadResult.storagePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    });

    it('should not throw error if file does not exist', async () => {
      await expect(
        provider.delete('file-123', '/nonexistent/file.pdf')
      ).resolves.toBeUndefined();
    });
  });

  describe('exists', () => {
    it('should return true if file exists', async () => {
      // First upload a file
      const mockBuffer = Buffer.from('existing file');
      const tenantId = randomUUID();

      const uploadResult = await provider.upload({
        tenantId,
        category: 'invoice',
        originalFilename: 'exists.pdf',
        buffer: mockBuffer,
        mimeType: 'application/pdf',
      });

      const exists = await provider.exists(uploadResult.fileId, uploadResult.storagePath);
      expect(exists).toBe(true);

      // Clean up
      await fs.unlink(uploadResult.storagePath);
    });

    it('should return false if file does not exist', async () => {
      const exists = await provider.exists('file-123', '/nonexistent/file.pdf');
      expect(exists).toBe(false);
    });
  });

  describe('getFileUrl', () => {
    it('should generate correct URL from storage path', async () => {
      const storagePath = `${testBasePath}/uploads/public/tenant-123/files/document.pdf`;
      const url = await provider.getFileUrl('file-123', storagePath);

      expect(url).toBe('/public/tenant-123/files/document.pdf');
    });
  });

  describe('getProviderType', () => {
    it('should return local as provider type', () => {
      expect(provider.getProviderType()).toBe('local');
    });
  });
});
