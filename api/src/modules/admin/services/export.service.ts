import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);
  private readonly EXPORTS_DIR = path.join(process.cwd(), 'exports');

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('export') private exportQueue: Queue,
  ) {
    // Ensure exports directory exists
    if (!fs.existsSync(this.EXPORTS_DIR)) {
      fs.mkdirSync(this.EXPORTS_DIR, { recursive: true });
      this.logger.log(`Created exports directory: ${this.EXPORTS_DIR}`);
    }
  }

  /**
   * Export tenants (queue job)
   */
  async exportTenants(filters: any, format: string, adminUserId: string) {
    try {
      this.validateFormat(format);

      const exportJobId = randomBytes(16).toString('hex');

      // Create export job record
      await this.prisma.export_job.create({
        data: {
          id: exportJobId,
          admin_user_id: adminUserId,
          export_type: 'tenants',
          format,
          filters: filters || {},
          status: 'pending',
          created_at: new Date(),
        },
      });

      // Queue export job
      await this.exportQueue.add(
        'process-export',
        {
          exportJobId,
          exportType: 'tenants',
          filters,
          format,
        },
        {
          jobId: exportJobId,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      this.logger.log(`Tenants export job queued: ${exportJobId}`);

      return { export_job_id: exportJobId, status: 'pending' };
    } catch (error) {
      this.logger.error(`Failed to queue tenants export: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Export users (queue job)
   */
  async exportUsers(filters: any, format: string, adminUserId: string) {
    try {
      this.validateFormat(format);

      const exportJobId = randomBytes(16).toString('hex');

      // Create export job record
      await this.prisma.export_job.create({
        data: {
          id: exportJobId,
          admin_user_id: adminUserId,
          export_type: 'users',
          format,
          filters: filters || {},
          status: 'pending',
          created_at: new Date(),
        },
      });

      // Queue export job
      await this.exportQueue.add(
        'process-export',
        {
          exportJobId,
          exportType: 'users',
          filters,
          format,
        },
        {
          jobId: exportJobId,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      this.logger.log(`Users export job queued: ${exportJobId}`);

      return { export_job_id: exportJobId, status: 'pending' };
    } catch (error) {
      this.logger.error(`Failed to queue users export: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Export audit logs (queue job)
   */
  async exportAuditLogs(filters: any, format: string, adminUserId: string) {
    try {
      this.validateFormat(format);

      const exportJobId = randomBytes(16).toString('hex');

      // Create export job record
      await this.prisma.export_job.create({
        data: {
          id: exportJobId,
          admin_user_id: adminUserId,
          export_type: 'audit_logs',
          format,
          filters: filters || {},
          status: 'pending',
          created_at: new Date(),
        },
      });

      // Queue export job
      await this.exportQueue.add(
        'process-export',
        {
          exportJobId,
          exportType: 'audit_logs',
          filters,
          format,
        },
        {
          jobId: exportJobId,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      this.logger.log(`Audit logs export job queued: ${exportJobId}`);

      return { export_job_id: exportJobId, status: 'pending' };
    } catch (error) {
      this.logger.error(`Failed to queue audit logs export: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process export job (called by background worker)
   */
  async processExportJob(exportJobId: string) {
    try {
      // Update status to processing
      await this.prisma.export_job.update({
        where: { id: exportJobId },
        data: { status: 'processing' },
      });

      // Get export job details
      const exportJob = await this.prisma.export_job.findUnique({
        where: { id: exportJobId },
      });

      if (!exportJob) {
        throw new NotFoundException(`Export job ${exportJobId} not found`);
      }

      // Fetch data based on export type
      let data: any[];
      switch (exportJob.export_type) {
        case 'tenants':
          data = await this.fetchTenantsData(exportJob.filters);
          break;
        case 'users':
          data = await this.fetchUsersData(exportJob.filters);
          break;
        case 'audit_logs':
          data = await this.fetchAuditLogsData(exportJob.filters);
          break;
        default:
          throw new BadRequestException(`Unknown export type: ${exportJob.export_type}`);
      }

      // Generate file
      let filePath: string;
      if (exportJob.format === 'csv') {
        filePath = await this.generateCSV(data, exportJob.export_type, exportJobId);
      } else if (exportJob.format === 'pdf') {
        filePath = await this.generatePDF(data, exportJob.export_type, exportJobId);
      } else {
        throw new BadRequestException(`Unknown format: ${exportJob.format}`);
      }

      // Update export job status
      await this.prisma.export_job.update({
        where: { id: exportJobId },
        data: {
          status: 'completed',
          file_path: filePath,
          row_count: data.length,
          completed_at: new Date(),
        },
      });

      this.logger.log(`Export job ${exportJobId} completed - ${data.length} rows`);

      return { success: true, filePath, rowCount: data.length };
    } catch (error) {
      this.logger.error(`Export job ${exportJobId} failed: ${error.message}`, error.stack);

      // Update export job status
      await this.prisma.export_job.update({
        where: { id: exportJobId },
        data: {
          status: 'failed',
          error_message: error.message,
          completed_at: new Date(),
        },
      });

      throw error;
    }
  }

  /**
   * Generate CSV file
   */
  async generateCSV(data: any[], exportType: string, exportJobId: string): Promise<string> {
    try {
      const fields = this.getFieldsForExportType(exportType);
      const parser = new Parser({ fields });
      const csv = parser.parse(data);

      const filename = `${exportType}_${exportJobId}_${Date.now()}.csv`;
      const filePath = path.join(this.EXPORTS_DIR, filename);

      fs.writeFileSync(filePath, csv);

      this.logger.log(`CSV generated: ${filePath}`);

      return filePath;
    } catch (error) {
      this.logger.error(`Failed to generate CSV: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate PDF file
   */
  async generatePDF(data: any[], exportType: string, exportJobId: string): Promise<string> {
    try {
      const filename = `${exportType}_${exportJobId}_${Date.now()}.pdf`;
      const filePath = path.join(this.EXPORTS_DIR, filename);

      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Header
      doc.fontSize(18).text(`${exportType.toUpperCase()} Export`, { align: 'center' });
      doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
      doc.moveDown();

      // Table header
      const fields = this.getFieldsForExportType(exportType);
      doc.fontSize(8);

      // Simple table rendering (for production, consider using a table library)
      data.forEach((row, index) => {
        if (index > 0 && index % 30 === 0) {
          doc.addPage(); // New page every 30 rows
        }

        const rowText = fields.map(field => `${field}: ${row[field] || 'N/A'}`).join(' | ');
        doc.text(rowText);
        doc.moveDown(0.5);
      });

      doc.end();

      // Wait for stream to finish
      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });

      this.logger.log(`PDF generated: ${filePath}`);

      return filePath;
    } catch (error) {
      this.logger.error(`Failed to generate PDF: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get export history for admin user
   */
  async getExportHistory(adminUserId: string, limit: number = 10) {
    try {
      const exports = await this.prisma.export_job.findMany({
        where: { admin_user_id: adminUserId },
        orderBy: { created_at: 'desc' },
        take: limit,
      });

      return exports.map((exp) => ({
        id: exp.id,
        export_type: exp.export_type,
        format: exp.format,
        status: exp.status,
        row_count: exp.row_count,
        file_path: exp.file_path,
        error_message: exp.error_message,
        created_at: exp.created_at,
        completed_at: exp.completed_at,
      }));
    } catch (error) {
      this.logger.error(`Failed to get export history: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Helper methods

  private validateFormat(format: string) {
    if (format !== 'csv' && format !== 'pdf') {
      throw new BadRequestException('Format must be either "csv" or "pdf"');
    }
  }

  private async fetchTenantsData(filters: any): Promise<any[]> {
    const where: any = {};

    if (filters.status === 'active') {
      where.is_active = true;
      where.deleted_at = null;
    } else if (filters.status === 'suspended') {
      where.is_active = false;
      where.deleted_at = null;
    } else if (filters.status === 'deleted') {
      where.deleted_at = { not: null };
    }

    if (filters.created_from || filters.created_to) {
      where.created_at = {};
      if (filters.created_from) where.created_at.gte = new Date(filters.created_from);
      if (filters.created_to) where.created_at.lte = new Date(filters.created_to);
    }

    const tenants = await this.prisma.tenant.findMany({
      where,
      include: {
        _count: {
          select: { user: true },
        },
      },
    });

    return tenants.map((t) => ({
      id: t.id,
      subdomain: t.subdomain,
      company_name: t.company_name,
      is_active: t.is_active,
      user_count: t._count.user,
      primary_contact_email: t.primary_contact_email,
      created_at: t.created_at,
      deleted_at: t.deleted_at,
    }));
  }

  private async fetchUsersData(filters: any): Promise<any[]> {
    const where: any = {};

    if (filters.tenant_id) where.tenant_id = filters.tenant_id;
    if (filters.is_active !== undefined) where.is_active = filters.is_active;
    if (filters.deleted_at === null) where.deleted_at = null;

    const users = await this.prisma.user.findMany({
      where,
      include: {
        tenant: {
          select: {
            subdomain: true,
            company_name: true,
          },
        },
        user_role_user_role_user_idTouser: {
          include: {
            role: {
              select: { name: true },
            },
          },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      is_active: u.is_active,
      tenant_subdomain: u.tenant?.subdomain,
      roles: u.user_role_user_role_user_idTouser.map((ur) => ur.role.name).join(', '),
      created_at: u.created_at,
      last_login_at: u.last_login_at,
    }));
  }

  private async fetchAuditLogsData(filters: any): Promise<any[]> {
    const where: any = {};

    if (filters.tenant_id) where.tenant_id = filters.tenant_id;
    if (filters.entity_type) where.entity_type = filters.entity_type;
    if (filters.action_type) where.action_type = filters.action_type;

    if (filters.created_from || filters.created_to) {
      where.created_at = {};
      if (filters.created_from) where.created_at.gte = new Date(filters.created_from);
      if (filters.created_to) where.created_at.lte = new Date(filters.created_to);
    }

    const logs = await this.prisma.audit_log.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: filters.limit || 1000, // Max 1000 rows
    });

    return logs.map((log) => ({
      id: log.id,
      tenant_id: log.tenant_id,
      actor_email: log.user?.email,
      actor_name: log.user ? `${log.user.first_name} ${log.user.last_name}` : null,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      action_type: log.action_type,
      description: log.description,
      status: log.status,
      created_at: log.created_at,
    }));
  }

  private getFieldsForExportType(exportType: string): string[] {
    switch (exportType) {
      case 'tenants':
        return ['id', 'subdomain', 'company_name', 'is_active', 'user_count', 'primary_contact_email', 'created_at', 'deleted_at'];
      case 'users':
        return ['id', 'email', 'first_name', 'last_name', 'is_active', 'tenant_subdomain', 'roles', 'created_at', 'last_login_at'];
      case 'audit_logs':
        return ['id', 'tenant_id', 'actor_email', 'actor_name', 'entity_type', 'entity_id', 'action_type', 'description', 'status', 'created_at'];
      default:
        return [];
    }
  }
}
