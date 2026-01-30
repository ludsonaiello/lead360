import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { FilesService } from '../../files/files.service';
import { FileCategory } from '../../files/dto/upload-file.dto';

/**
 * QrCodeGeneratorService
 *
 * Generates QR codes for quote attachment URLs.
 *
 * Key Features:
 * - Generate QR code as PNG buffer
 * - Configurable size and margin
 * - Error correction level M
 * - Save to file storage with FilesService integration
 *
 * @author Developer 5
 */
@Injectable()
export class QrCodeGeneratorService {
  private readonly logger = new Logger(QrCodeGeneratorService.name);

  constructor(private readonly filesService: FilesService) {}
  /**
   * Generate QR code as buffer
   *
   * @param url - URL to encode
   * @param options - Size and margin options
   * @returns PNG buffer
   */
  async generate(
    url: string,
    options?: { width?: number; margin?: number },
  ): Promise<Buffer> {
    const width = options?.width || 200;
    const margin = options?.margin || 2;

    this.logger.debug(`Generating QR code for URL: ${url} (width: ${width}, margin: ${margin})`);

    try {
      const buffer = await QRCode.toBuffer(url, {
        width,
        margin,
        errorCorrectionLevel: 'M',
        type: 'png',
      });

      this.logger.log(`QR code generated successfully (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to generate QR code: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate QR code and save to file storage
   *
   * @param tenantId - Tenant ID
   * @param url - URL to encode
   * @param userId - User initiating generation
   * @param entityId - Optional entity ID (quote ID) for file tracking
   * @returns File ID in storage
   */
  async generateAndSave(
    tenantId: string,
    url: string,
    userId: string,
    entityId?: string,
  ): Promise<string> {
    this.logger.log(`Generating and saving QR code for URL: ${url}`);

    // Generate QR code buffer
    const buffer = await this.generate(url);

    // Create filename with timestamp
    const timestamp = Date.now();
    const filename = `qr-code-${timestamp}.png`;

    // Create fake Multer file object for FilesService
    const fakeFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: filename,
      encoding: '7bit',
      mimetype: 'image/png',
      buffer: buffer,
      size: buffer.length,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    try {
      // Upload QR code to file storage
      const uploadedFile = await this.filesService.uploadFile(tenantId, userId, fakeFile, {
        category: FileCategory.QUOTE,
        entity_type: entityId ? 'quote' : undefined,
        entity_id: entityId || undefined,
      });

      this.logger.log(
        `QR code saved successfully: file_id=${uploadedFile.file_id}, size=${buffer.length} bytes`,
      );

      return uploadedFile.file_id;
    } catch (error) {
      this.logger.error(`Failed to save QR code to file storage: ${error.message}`, error.stack);
      throw error;
    }
  }
}
