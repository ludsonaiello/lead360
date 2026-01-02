import { Injectable, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class FileStorageService {
  private readonly uploadBasePath = './uploads/public';

  /**
   * Upload a logo file for a tenant
   */
  async uploadLogo(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<{ file_id: string; url: string }> {
    // Validate file type
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only PNG, JPG, JPEG, and SVG are allowed for logos.',
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 5MB limit.');
    }

    // Generate unique file ID
    const fileId = randomUUID();
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${fileId}.${fileExtension}`;

    // Create directory structure: uploads/public/{tenant}/images/
    const tenantDir = join(this.uploadBasePath, tenantId, 'images');
    await fs.mkdir(tenantDir, { recursive: true });

    // Save file
    const filePath = join(tenantDir, fileName);
    await fs.writeFile(filePath, file.buffer);

    // Return file ID and public URL
    const url = `/public/${tenantId}/images/${fileName}`;

    return { file_id: fileId, url };
  }

  /**
   * Upload a document file (license, insurance, etc.)
   */
  async uploadDocument(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<{ file_id: string; url: string }> {
    // Validate file type
    const allowedMimeTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only PDF, PNG, JPG, and JPEG are allowed for documents.',
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit.');
    }

    // Generate unique file ID
    const fileId = randomUUID();
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${fileId}.${fileExtension}`;

    // Create directory structure: uploads/public/{tenant}/files/
    const tenantDir = join(this.uploadBasePath, tenantId, 'files');
    await fs.mkdir(tenantDir, { recursive: true });

    // Save file
    const filePath = join(tenantDir, fileName);
    await fs.writeFile(filePath, file.buffer);

    // Return file ID and public URL
    const url = `/public/${tenantId}/files/${fileName}`;

    return { file_id: fileId, url };
  }

  /**
   * Delete a file
   */
  async deleteFile(tenantId: string, fileId: string, fileType: 'image' | 'file'): Promise<void> {
    const folder = fileType === 'image' ? 'images' : 'files';
    const dir = join(this.uploadBasePath, tenantId, folder);

    // Find file by ID (we don't know the extension)
    const files = await fs.readdir(dir);
    const fileToDelete = files.find((f) => f.startsWith(fileId));

    if (fileToDelete) {
      const filePath = join(dir, fileToDelete);
      await fs.unlink(filePath);
    }
  }
}
