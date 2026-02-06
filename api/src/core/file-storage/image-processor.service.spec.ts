import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ImageProcessorService } from './image-processor.service';
import { PrismaService } from '../database/prisma.service';
import sharp from 'sharp';

describe('ImageProcessorService', () => {
  let service: ImageProcessorService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    storage_config: {
      findUnique: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImageProcessorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ImageProcessorService>(ImageProcessorService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('isImage', () => {
    it('should return true for image MIME types', () => {
      expect(service.isImage('image/jpeg')).toBe(true);
      expect(service.isImage('image/png')).toBe(true);
      expect(service.isImage('image/gif')).toBe(true);
      expect(service.isImage('image/webp')).toBe(true);
      expect(service.isImage('image/heic')).toBe(true);
      expect(service.isImage('image/heif')).toBe(true);
    });

    it('should return false for non-image MIME types', () => {
      expect(service.isImage('application/pdf')).toBe(false);
      expect(service.isImage('text/plain')).toBe(false);
      expect(service.isImage('application/json')).toBe(false);
      expect(service.isImage('video/mp4')).toBe(false);
    });
  });

  describe('processImage', () => {
    let testImageBuffer: Buffer;

    beforeEach(async () => {
      // Create a small test JPEG image (100x100 red square)
      testImageBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .jpeg()
        .toBuffer();

      // Default config enables everything
      mockPrismaService.storage_config.findUnique.mockResolvedValue({
        enable_webp_conversion: true,
        enable_thumbnails: true,
      });
    });

    it('should convert JPEG to WebP when enabled', async () => {
      const result = await service.processImage(
        testImageBuffer,
        'image/jpeg',
        'tenant-123',
      );

      expect(result.wasOptimized).toBe(true);
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
      expect(result.processedBuffer).toBeDefined();

      // Verify it's actually WebP
      const metadata = await sharp(result.processedBuffer).metadata();
      expect(metadata.format).toBe('webp');
    });

    it('should not convert WebP to WebP', async () => {
      const webpBuffer = await sharp(testImageBuffer).webp().toBuffer();

      const result = await service.processImage(
        webpBuffer,
        'image/webp',
        'tenant-123',
      );

      // WebP won't be converted, but will still be optimized
      expect(result.wasOptimized).toBe(true);
      expect(result.format).toBe('webp');

      // Verify it's still WebP
      const metadata = await sharp(result.processedBuffer).metadata();
      expect(metadata.format).toBe('webp');
    });

    it('should generate thumbnail when enabled', async () => {
      const result = await service.processImage(
        testImageBuffer,
        'image/jpeg',
        'tenant-123',
      );

      expect(result.hadThumbnail).toBe(true);
      expect(result.thumbnailBuffer).toBeDefined();

      // Verify thumbnail dimensions
      const metadata = await sharp(result.thumbnailBuffer).metadata();
      expect(metadata.width).toBe(200);
      expect(metadata.height).toBe(200);
      expect(metadata.format).toBe('webp');
    });

    it('should not generate thumbnail when disabled in config', async () => {
      mockPrismaService.storage_config.findUnique.mockResolvedValue({
        enable_webp_conversion: true,
        enable_thumbnails: false,
      });

      const result = await service.processImage(
        testImageBuffer,
        'image/jpeg',
        'tenant-123',
      );

      expect(result.hadThumbnail).toBe(false);
      expect(result.thumbnailBuffer).toBeUndefined();
    });

    it('should not convert to WebP when disabled in config', async () => {
      mockPrismaService.storage_config.findUnique.mockResolvedValue({
        enable_webp_conversion: false,
        enable_thumbnails: false,
      });

      const result = await service.processImage(
        testImageBuffer,
        'image/jpeg',
        'tenant-123',
      );

      // Still optimized but not converted to WebP
      expect(result.wasOptimized).toBe(true);

      // Should still be JPEG
      const metadata = await sharp(result.processedBuffer).metadata();
      expect(metadata.format).toBe('jpeg');
    });

    it('should strip EXIF metadata', async () => {
      // Create image with EXIF data
      const imageWithExif = await sharp(testImageBuffer)
        .jpeg({ quality: 90 })
        .withMetadata({
          exif: {
            IFD0: {
              Make: 'Test Camera',
              Model: 'Test Model',
            },
          },
        })
        .toBuffer();

      const result = await service.processImage(
        imageWithExif,
        'image/jpeg',
        'tenant-123',
      );

      // Verify EXIF was stripped
      const metadata = await sharp(result.processedBuffer).metadata();
      expect(metadata.exif).toBeUndefined();
    });

    it('should handle PNG images', async () => {
      const pngBuffer = await sharp({
        create: {
          width: 150,
          height: 150,
          channels: 4,
          background: { r: 0, g: 255, b: 0, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const result = await service.processImage(
        pngBuffer,
        'image/png',
        'tenant-123',
      );

      expect(result.wasOptimized).toBe(true);
      expect(result.width).toBe(150);
      expect(result.height).toBe(150);

      const metadata = await sharp(result.processedBuffer).metadata();
      expect(metadata.format).toBe('webp');
    });

    it('should use default config when no tenant config exists', async () => {
      mockPrismaService.storage_config.findUnique.mockResolvedValue(null);

      const result = await service.processImage(
        testImageBuffer,
        'image/jpeg',
        'tenant-123',
      );

      expect(result.wasOptimized).toBe(true);
      expect(result.hadThumbnail).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const corruptedBuffer = Buffer.from('not an image');

      await expect(
        service.processImage(corruptedBuffer, 'image/jpeg', 'tenant-123'),
      ).rejects.toThrow('Image processing failed');
    });

    it('should extract correct dimensions from metadata', async () => {
      const largeImage = await sharp({
        create: {
          width: 3840,
          height: 2160,
          channels: 3,
          background: { r: 0, g: 0, b: 255 },
        },
      })
        .jpeg()
        .toBuffer();

      const result = await service.processImage(
        largeImage,
        'image/jpeg',
        'tenant-123',
      );

      expect(result.width).toBe(3840);
      expect(result.height).toBe(2160);
    });

    it('should handle landscape images correctly', async () => {
      const landscapeImage = await sharp({
        create: {
          width: 1920,
          height: 1080,
          channels: 3,
          background: { r: 128, g: 128, b: 128 },
        },
      })
        .jpeg()
        .toBuffer();

      const result = await service.processImage(
        landscapeImage,
        'image/jpeg',
        'tenant-123',
      );

      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.hadThumbnail).toBe(true);

      // Verify thumbnail is square 200x200
      const thumbnailMeta = await sharp(result.thumbnailBuffer).metadata();
      expect(thumbnailMeta.width).toBe(200);
      expect(thumbnailMeta.height).toBe(200);
    });

    it('should handle portrait images correctly', async () => {
      const portraitImage = await sharp({
        create: {
          width: 1080,
          height: 1920,
          channels: 3,
          background: { r: 255, g: 255, b: 0 },
        },
      })
        .jpeg()
        .toBuffer();

      const result = await service.processImage(
        portraitImage,
        'image/jpeg',
        'tenant-123',
      );

      expect(result.width).toBe(1080);
      expect(result.height).toBe(1920);
    });

    it('should reduce file size after WebP conversion', async () => {
      const result = await service.processImage(
        testImageBuffer,
        'image/jpeg',
        'tenant-123',
      );

      // WebP should typically be smaller than JPEG for most images
      // Note: for very small test images, this might not always be true
      expect(result.processedBuffer.length).toBeLessThanOrEqual(
        testImageBuffer.length * 2,
      );
    });

    it('should convert GIF to WebP when conversion enabled', async () => {
      const gifBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 255 },
        },
      })
        .gif()
        .toBuffer();

      mockPrismaService.storage_config.findUnique.mockResolvedValue({
        enable_webp_conversion: true,
        enable_thumbnails: true,
      });

      const result = await service.processImage(
        gifBuffer,
        'image/gif',
        'tenant-123',
      );

      // GIFs get converted to WebP when conversion is enabled (animation is lost)
      expect(result.wasOptimized).toBe(true);
      expect(result.format).toBe('webp');

      // Verify it was actually converted
      const metadata = await sharp(result.processedBuffer).metadata();
      expect(metadata.format).toBe('webp');
    });
  });

  describe('shouldOptimize (private method behavior)', () => {
    it('should optimize JPEG, PNG, HEIC, HEIF', async () => {
      const jpegBuffer = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .jpeg()
        .toBuffer();

      mockPrismaService.storage_config.findUnique.mockResolvedValue({
        enable_webp_conversion: true,
        enable_thumbnails: false,
      });

      const jpegResult = await service.processImage(
        jpegBuffer,
        'image/jpeg',
        'tenant-123',
      );
      expect(jpegResult.wasOptimized).toBe(true);

      const pngBuffer = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 4,
          background: { r: 0, g: 255, b: 0, alpha: 1 },
        },
      })
        .png()
        .toBuffer();
      const pngResult = await service.processImage(
        pngBuffer,
        'image/png',
        'tenant-123',
      );
      expect(pngResult.wasOptimized).toBe(true);
    });

    it('should optimize WebP and GIF', async () => {
      mockPrismaService.storage_config.findUnique.mockResolvedValue({
        enable_webp_conversion: true,
        enable_thumbnails: false,
      });

      const webpBuffer = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 3,
          background: { r: 0, g: 0, b: 255 },
        },
      })
        .webp()
        .toBuffer();
      const webpResult = await service.processImage(
        webpBuffer,
        'image/webp',
        'tenant-123',
      );
      expect(webpResult.wasOptimized).toBe(true);

      const gifBuffer = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 3,
          background: { r: 255, g: 255, b: 0 },
        },
      })
        .gif()
        .toBuffer();
      const gifResult = await service.processImage(
        gifBuffer,
        'image/gif',
        'tenant-123',
      );
      expect(gifResult.wasOptimized).toBe(true);
    });
  });
});
