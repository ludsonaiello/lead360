import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateAccountMappingDto } from '../dto/create-account-mapping.dto';

@Injectable()
export class AccountMappingService {
  private readonly logger = new Logger(AccountMappingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * List all account mappings for a tenant, optionally filtered by platform.
   */
  async findAll(tenantId: string, platform?: string) {
    const where: any = { tenant_id: tenantId };
    if (platform) {
      where.platform = platform;
    }

    return this.prisma.financial_category_account_mapping.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
            classification: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Create or update an account mapping.
   * If a mapping already exists for the given category_id + platform + tenant_id, update it.
   * Otherwise, create a new one.
   *
   * Returns { ...record, statusCode: 200 | 201 } so the controller can set the HTTP status.
   */
  async upsert(tenantId: string, userId: string, dto: CreateAccountMappingDto) {
    // 1. Validate that category belongs to the tenant
    const category = await this.prisma.financial_category.findFirst({
      where: { id: dto.category_id, tenant_id: tenantId },
    });
    if (!category) {
      throw new NotFoundException(
        `Category ${dto.category_id} not found for this tenant`,
      );
    }

    // 2. Check for existing mapping (tenant + category + platform)
    const existing =
      await this.prisma.financial_category_account_mapping.findFirst({
        where: {
          tenant_id: tenantId,
          category_id: dto.category_id,
          platform: dto.platform as any,
        },
      });

    // 3. If existing — update
    if (existing) {
      const updated =
        await this.prisma.financial_category_account_mapping.update({
          where: { id: existing.id },
          data: {
            account_name: dto.account_name,
            account_code: dto.account_code || null,
            updated_by_user_id: userId,
          },
        });

      await this.auditLogger.logTenantChange({
        action: 'updated',
        entityType: 'financial_category_account_mapping',
        entityId: updated.id,
        tenantId,
        actorUserId: userId,
        before: existing,
        after: updated,
        description: `Updated ${dto.platform} account mapping for category "${category.name}" to "${dto.account_name}"`,
      });

      return { ...updated, statusCode: 200 };
    }

    // 4. If not existing — create
    const created =
      await this.prisma.financial_category_account_mapping.create({
        data: {
          tenant_id: tenantId,
          category_id: dto.category_id,
          platform: dto.platform as any,
          account_name: dto.account_name,
          account_code: dto.account_code || null,
          created_by_user_id: userId,
        },
      });

    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'financial_category_account_mapping',
      entityId: created.id,
      tenantId,
      actorUserId: userId,
      after: created,
      description: `Created ${dto.platform} account mapping for category "${category.name}" → "${dto.account_name}"`,
    });

    return { ...created, statusCode: 201 };
  }

  /**
   * Delete a single account mapping by ID, scoped to tenant.
   */
  async delete(
    tenantId: string,
    mappingId: string,
    userId: string,
  ): Promise<void> {
    const mapping =
      await this.prisma.financial_category_account_mapping.findFirst({
        where: { id: mappingId, tenant_id: tenantId },
      });

    if (!mapping) {
      throw new NotFoundException(
        `Account mapping ${mappingId} not found`,
      );
    }

    await this.prisma.financial_category_account_mapping.delete({
      where: { id: mappingId },
    });

    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'financial_category_account_mapping',
      entityId: mappingId,
      tenantId,
      actorUserId: userId,
      before: mapping,
      description: `Deleted ${mapping.platform} account mapping for category ${mapping.category_id}`,
    });
  }

  /**
   * Returns a preview of what account name will be used for each category
   * in exports — either the custom mapped name or the Lead360 category name
   * as fallback.
   */
  async getDefaults(tenantId: string, platform: string) {
    // 1. Get all active categories for the tenant
    const categories = await this.prisma.financial_category.findMany({
      where: { tenant_id: tenantId, is_active: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    // 2. Get all mappings for this tenant + platform
    const mappings =
      await this.prisma.financial_category_account_mapping.findMany({
        where: { tenant_id: tenantId, platform: platform as any },
      });

    // 3. Build a Map for fast lookup
    const mappingMap = new Map<
      string,
      { account_name: string; account_code: string | null }
    >();
    for (const m of mappings) {
      mappingMap.set(m.category_id, {
        account_name: m.account_name,
        account_code: m.account_code,
      });
    }

    // 4. Build response
    return categories.map((cat) => {
      const custom = mappingMap.get(cat.id);
      return {
        category_id: cat.id,
        category_name: cat.name,
        category_type: cat.type,
        classification: cat.classification,
        has_custom_mapping: !!custom,
        account_name: custom ? custom.account_name : cat.name,
        account_code: custom ? custom.account_code : null,
      };
    });
  }

  /**
   * Returns the account name for a single category — either the custom
   * mapping or category name fallback. Used for individual lookups
   * (the export service uses a bulk-loaded Map instead).
   */
  async resolveAccountName(
    tenantId: string,
    categoryId: string,
    platform: string,
  ): Promise<{ account_name: string; account_code: string | null }> {
    const mapping =
      await this.prisma.financial_category_account_mapping.findFirst({
        where: {
          tenant_id: tenantId,
          category_id: categoryId,
          platform: platform as any,
        },
      });

    if (mapping) {
      return {
        account_name: mapping.account_name,
        account_code: mapping.account_code,
      };
    }

    // Fallback: use category name
    const category = await this.prisma.financial_category.findFirst({
      where: { id: categoryId, tenant_id: tenantId },
      select: { name: true },
    });

    return {
      account_name: category?.name || 'Uncategorized',
      account_code: null,
    };
  }
}
