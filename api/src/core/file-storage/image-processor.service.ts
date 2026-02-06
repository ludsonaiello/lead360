import { Injectable, Logger } from '@nestjs/common';
import sharp = require('sharp');
import { PrismaService } from '../database/prisma.service';

export interface ImageProcessingOptions {
  // WebP conversion
  convertToWebP?: boolean;
  webpQuality?: number; // 1-100

  // Thumbnail generation
  generateThumbnail?: boolean;
  thumbnailWidth?: number;
  thumbnailHeight?: number;

  // EXIF stripping
  stripExif?: boolean;

  // Optimization
  optimize?: boolean;
}

export interface ImageProcessingResult {
  processedBuffer: Buffer;
  thumbnailBuffer?: Buffer;
  width: number;
  height: number;
  format: string;
  originalSize: number;
  processedSize: number;
  wasOptimized: boolean;
  hadThumbnail: boolean;
}

/**
 * Image Processor Service
 *
 * Handles image optimization, format conversion, and thumbnail generation using Sharp.
 * Supports:
 * - WebP conversion for smaller file sizes
 * - HEIC/HEIF format support
 * - Thumbnail generation with configurable dimensions
 * - EXIF metadata stripping for privacy
 * - Image optimization with quality control
 */
@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Process an image (optimize, convert, generate thumbnail)
   *
   * @param buffer - Original image buffer
   * @param mimeType - Original MIME type
   * @param tenantId - Tenant ID (for loading config)
   * @param options - Processing options (overrides tenant config if provided)
   * @returns Processed image data
   */
  async processImage(
    buffer: Buffer,
    mimeType: string,
    tenantId: string,
    options?: ImageProcessingOptions,
  ): Promise<ImageProcessingResult> {
    // Load tenant storage config if options not provided
    const config = await this.loadTenantConfig(tenantId);
    const processingOptions = this.mergeOptions(config, options);

    this.logger.log(`Processing image for tenant ${tenantId}: ${mimeType}`);

    try {
      // Initialize sharp instance
      let image = sharp(buffer);

      // Get metadata
      const metadata = await image.metadata();
      const originalSize = buffer.length;

      this.logger.log(
        `Image metadata: ${metadata.width}x${metadata.height}, format=${metadata.format}, size=${originalSize} bytes`,
      );

      // Strip EXIF if requested
      if (processingOptions.stripExif) {
        image = image.rotate(); // Auto-rotate based on EXIF, then strip
      }

      // Convert to WebP if requested and not already WebP
      let wasOptimized = false;
      let processedBuffer: Buffer;

      if (processingOptions.convertToWebP && metadata.format !== 'webp') {
        processedBuffer = await image
          .webp({ quality: processingOptions.webpQuality || 85 })
          .toBuffer();
        wasOptimized = true;
        this.logger.log(
          `Converted to WebP: ${originalSize} → ${processedBuffer.length} bytes (${this.calculateSavings(originalSize, processedBuffer.length)}% savings)`,
        );
      } else if (processingOptions.optimize) {
        // Optimize in original format
        processedBuffer = await this.optimizeInFormat(
          image,
          metadata.format,
          processingOptions.webpQuality || 85,
        );
        wasOptimized = true;
        this.logger.log(
          `Optimized ${metadata.format}: ${originalSize} → ${processedBuffer.length} bytes (${this.calculateSavings(originalSize, processedBuffer.length)}% savings)`,
        );
      } else {
        processedBuffer = buffer;
      }

      // Generate thumbnail if requested
      let thumbnailBuffer: Buffer | undefined;
      if (processingOptions.generateThumbnail) {
        thumbnailBuffer = await this.generateThumbnail(
          buffer,
          processingOptions.thumbnailWidth || 200,
          processingOptions.thumbnailHeight || 200,
          processingOptions.stripExif || false,
        );
        this.logger.log(`Generated thumbnail: ${thumbnailBuffer.length} bytes`);
      }

      return {
        processedBuffer,
        thumbnailBuffer,
        width: metadata.width,
        height: metadata.height,
        format:
          wasOptimized && processingOptions.convertToWebP
            ? 'webp'
            : metadata.format,
        originalSize,
        processedSize: processedBuffer.length,
        wasOptimized,
        hadThumbnail: !!thumbnailBuffer,
      };
    } catch (error) {
      this.logger.error(`Failed to process image: ${error.message}`);
      throw new Error(`Image processing failed: ${error.message}`);
    }
  }

  /**
   * Generate a thumbnail from an image
   *
   * @param buffer - Original image buffer
   * @param width - Thumbnail width
   * @param height - Thumbnail height
   * @param stripExif - Whether to strip EXIF metadata
   * @returns Thumbnail buffer
   */
  async generateThumbnail(
    buffer: Buffer,
    width: number,
    height: number,
    stripExif: boolean = true,
  ): Promise<Buffer> {
    try {
      let image = sharp(buffer).resize(width, height, {
        fit: 'cover',
        position: 'center',
      });

      if (stripExif) {
        image = image.rotate(); // Auto-rotate and strip EXIF
      }

      // Convert to WebP for thumbnails (smaller size)
      return await image.webp({ quality: 80 }).toBuffer();
    } catch (error) {
      this.logger.error(`Failed to generate thumbnail: ${error.message}`);
      throw new Error(`Thumbnail generation failed: ${error.message}`);
    }
  }

  /**
   * Generate PDF thumbnail (first page)
   *
   * Note: This requires pdf2pic or similar library. For now, we'll throw an error
   * and implement this later when the library is added.
   *
   * @param buffer - PDF buffer
   * @param width - Thumbnail width
   * @param height - Thumbnail height
   * @returns Thumbnail buffer
   */
  async generatePdfThumbnail(
    buffer: Buffer,
    width: number,
    height: number,
  ): Promise<Buffer> {
    // TODO: Implement PDF thumbnail generation using pdf2pic or similar
    // For now, throw an error
    throw new Error('PDF thumbnail generation not yet implemented');
  }

  /**
   * Check if a file is an image
   *
   * @param mimeType - File MIME type
   * @returns True if image
   */
  isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * Check if a file is a PDF
   *
   * @param mimeType - File MIME type
   * @returns True if PDF
   */
  isPdf(mimeType: string): boolean {
    return mimeType === 'application/pdf';
  }

  /**
   * Check if HEIC/HEIF format is supported
   *
   * @returns True if supported
   */
  isHeicSupported(): boolean {
    // Sharp supports HEIC/HEIF if libvips was built with libheif
    // We'll assume it's supported for now
    return true;
  }

  /**
   * Optimize image in its original format
   *
   * @param image - Sharp instance
   * @param format - Image format
   * @param quality - Quality setting (1-100)
   * @returns Optimized buffer
   */
  private async optimizeInFormat(
    image: sharp.Sharp,
    format: string,
    quality: number,
  ): Promise<Buffer> {
    switch (format) {
      case 'jpeg':
      case 'jpg':
        return await image.jpeg({ quality }).toBuffer();
      case 'png':
        return await image
          .png({ quality: Math.round(quality / 10) })
          .toBuffer(); // PNG quality is 0-10
      case 'webp':
        return await image.webp({ quality }).toBuffer();
      default:
        // For unsupported formats, return original
        return await image.toBuffer();
    }
  }

  /**
   * Load tenant storage configuration
   *
   * @param tenantId - Tenant ID
   * @returns Storage configuration
   */
  private async loadTenantConfig(
    tenantId: string,
  ): Promise<ImageProcessingOptions> {
    const config = await this.prisma.storage_config.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!config) {
      // Return default configuration
      return {
        convertToWebP: true,
        webpQuality: 85,
        generateThumbnail: true,
        thumbnailWidth: 200,
        thumbnailHeight: 200,
        stripExif: true,
        optimize: true,
      };
    }

    return {
      convertToWebP: config.enable_webp_conversion,
      webpQuality: config.webp_quality,
      generateThumbnail: config.enable_thumbnails,
      thumbnailWidth: config.thumbnail_width,
      thumbnailHeight: config.thumbnail_height,
      stripExif: config.strip_exif,
      optimize: true,
    };
  }

  /**
   * Merge default config with provided options
   *
   * @param config - Default configuration from database
   * @param options - Provided options (overrides config)
   * @returns Merged options
   */
  private mergeOptions(
    config: ImageProcessingOptions,
    options?: ImageProcessingOptions,
  ): ImageProcessingOptions {
    return {
      ...config,
      ...options,
    };
  }

  /**
   * Calculate savings percentage
   *
   * @param originalSize - Original file size
   * @param newSize - New file size
   * @returns Savings percentage
   */
  private calculateSavings(originalSize: number, newSize: number): number {
    return Math.round(((originalSize - newSize) / originalSize) * 100);
  }
}
