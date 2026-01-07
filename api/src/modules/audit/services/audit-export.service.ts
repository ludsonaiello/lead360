import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { ExportAuditLogDto } from '../dto';
import { Parser } from 'json2csv';

@Injectable()
export class AuditExportService {
  private readonly MAX_EXPORT_ROWS = 10000;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Export audit logs to CSV or JSON
   * Enforces 10,000 row limit
   */
  async export(
    query: ExportAuditLogDto,
    isPlatformAdmin: boolean,
    tenantId?: string,
  ): Promise<{ data: string; filename: string; contentType: string }> {
    const { format = 'csv', ...filters } = query;

    // Build where clause
    const where: any = {};

    // Tenant isolation
    if (!isPlatformAdmin) {
      if (!tenantId) {
        throw new Error('Tenant ID is required for non-platform admin users');
      }
      where.tenant_id = tenantId;
    }

    // Apply filters
    if (filters.start_date) {
      where.created_at = { ...where.created_at, gte: new Date(filters.start_date) };
    }
    if (filters.end_date) {
      where.created_at = { ...where.created_at, lte: new Date(filters.end_date) };
    }
    if (filters.actor_user_id) {
      where.actor_user_id = filters.actor_user_id;
    }
    if (filters.actor_type) {
      where.actor_type = filters.actor_type;
    }
    if (filters.action_type) {
      where.action_type = filters.action_type;
    }
    if (filters.entity_type) {
      where.entity_type = filters.entity_type;
    }
    if (filters.entity_id) {
      where.entity_id = filters.entity_id;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.search) {
      where.description = { contains: filters.search };
    }

    // Check count first
    const count = await this.prisma.audit_log.count({ where });

    if (count > this.MAX_EXPORT_ROWS) {
      throw new BadRequestException(
        `Too many results (${count} rows). Maximum ${this.MAX_EXPORT_ROWS} rows allowed. Please narrow your date range or filters.`,
      );
    }

    if (count === 0) {
      throw new BadRequestException('No audit logs found matching your filters.');
    }

    // Fetch all logs
    const logs = await this.prisma.audit_log.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        tenant: {
          select: {
            company_name: true,
            subdomain: true,
          },
        },
      },
    });

    // Generate filename
    const startDate = filters.start_date ? new Date(filters.start_date).toISOString().split('T')[0] : 'all';
    const endDate = filters.end_date ? new Date(filters.end_date).toISOString().split('T')[0] : 'all';
    const tenantName = logs[0]?.tenant?.subdomain || 'platform';
    const filename = `audit-log-${tenantName}-${startDate}-${endDate}.${format}`;

    if (format === 'csv') {
      return this.exportToCSV(logs, filename);
    } else {
      return this.exportToJSON(logs, filename);
    }
  }

  /**
   * Export to CSV format
   */
  private exportToCSV(logs: any[], filename: string): { data: string; filename: string; contentType: string } {
    // Flatten data for CSV
    const flattenedLogs = logs.map((log) => ({
      Timestamp: log.created_at.toISOString(),
      Actor: log.user
        ? `${log.user.first_name} ${log.user.last_name} (${log.user.email})`
        : log.actor_type,
      'Actor Type': log.actor_type,
      Tenant: log.tenant?.company_name || 'N/A',
      Action: log.action_type,
      'Entity Type': log.entity_type,
      'Entity ID': log.entity_id,
      Description: log.description,
      Status: log.status,
      'IP Address': log.ip_address || 'N/A',
      'Error Message': log.error_message || 'N/A',
    }));

    const parser = new Parser({
      fields: [
        'Timestamp',
        'Actor',
        'Actor Type',
        'Tenant',
        'Action',
        'Entity Type',
        'Entity ID',
        'Description',
        'Status',
        'IP Address',
        'Error Message',
      ],
    });

    const csv = parser.parse(flattenedLogs);

    return {
      data: csv,
      filename,
      contentType: 'text/csv',
    };
  }

  /**
   * Export to JSON format
   */
  private exportToJSON(logs: any[], filename: string): { data: string; filename: string; contentType: string } {
    // Format logs for JSON export
    const formattedLogs = logs.map((log) => ({
      id: log.id,
      timestamp: log.created_at.toISOString(),
      user: {
        id: log.actor_user_id,
        name: log.user ? `${log.user.first_name} ${log.user.last_name}` : null,
        email: log.user?.email,
        type: log.actor_type,
      },
      tenant: {
        id: log.tenant_id,
        name: log.tenant?.company_name,
        subdomain: log.tenant?.subdomain,
      },
      action: {
        type: log.action_type,
        description: log.description,
        status: log.status,
        error_message: log.error_message,
      },
      entity: {
        type: log.entity_type,
        id: log.entity_id,
      },
      changes: {
        before: log.before_json,
        after: log.after_json,
      },
      metadata: log.metadata_json,
      request: {
        ip_address: log.ip_address,
        user_agent: log.user_agent,
      },
    }));

    const json = JSON.stringify(formattedLogs, null, 2);

    return {
      data: json,
      filename,
      contentType: 'application/json',
    };
  }
}
