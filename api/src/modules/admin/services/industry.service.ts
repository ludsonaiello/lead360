import { randomBytes } from 'crypto';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateIndustryDto, UpdateIndustryDto } from '../dto';

@Injectable()
export class IndustryService {
  private readonly logger = new Logger(IndustryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * List all industries with optional active filter
   */
  async findAll(activeOnly = false) {
    return this.prisma.industry.findMany({
      where: activeOnly ? { is_active: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get single industry by ID
   */
  async findById(id: string) {
    const industry = await this.prisma.industry.findUnique({
      where: { id },
    });

    if (!industry) {
      throw new NotFoundException('Industry not found');
    }

    return industry;
  }

  /**
   * Create new industry
   */
  async create(createDto: CreateIndustryDto, adminUserId: string) {
    const industry = await this.prisma.industry.create({
      data: {
        name: createDto.name,
        description: createDto.description,
        is_active: createDto.is_active ?? true,
      },
    });

    // Audit log
    await this.auditLogger.log({
      actor_user_id: adminUserId,
      actor_type: 'platform_admin',
      entity_type: 'industry',
      entity_id: industry.id,
      action_type: 'created',
      description: `Created industry: ${industry.name}`,
      after_json: industry,
    });

    this.logger.log(
      `Industry created: ${industry.name} (ID: ${industry.id}) by admin ${adminUserId}`,
    );

    return industry;
  }

  /**
   * Update existing industry
   */
  async update(id: string, updateDto: UpdateIndustryDto, adminUserId: string) {
    const existing = await this.findById(id);

    const updated = await this.prisma.industry.update({
      where: { id },
      data: {
        name: updateDto.name,
        description: updateDto.description,
        is_active: updateDto.is_active,
      },
    });

    // Audit log
    await this.auditLogger.log({
      actor_user_id: adminUserId,
      actor_type: 'platform_admin',
      entity_type: 'industry',
      entity_id: id,
      action_type: 'updated',
      description: `Updated industry: ${updated.name}`,
      before_json: existing,
      after_json: updated,
    });

    this.logger.log(
      `Industry updated: ${updated.name} (ID: ${id}) by admin ${adminUserId}`,
    );

    return updated;
  }

  /**
   * Delete industry (with tenant usage validation)
   */
  async delete(id: string, adminUserId: string) {
    const industry = await this.findById(id);

    // Check if any tenants use this industry (via junction table)
    const tenantCount = await this.prisma.tenant_industry.count({
      where: { industry_id: id },
    });

    if (tenantCount > 0) {
      throw new ConflictException(
        `Cannot delete industry "${industry.name}" - ${tenantCount} tenant(s) are using it`,
      );
    }

    await this.prisma.industry.delete({ where: { id } });

    // Audit log
    await this.auditLogger.log({
      actor_user_id: adminUserId,
      actor_type: 'platform_admin',
      entity_type: 'industry',
      entity_id: id,
      action_type: 'deleted',
      description: `Deleted industry: ${industry.name}`,
      before_json: industry,
    });

    this.logger.log(
      `Industry deleted: ${industry.name} (ID: ${id}) by admin ${adminUserId}`,
    );

    return { message: 'Industry deleted successfully' };
  }

  /**
   * Get tenant's assigned industries
   */
  async getTenantIndustries(tenantId: string) {
    const tenantIndustries = await this.prisma.tenant_industry.findMany({
      where: { tenant_id: tenantId } as any,
      include: {
        industry: true,
      } as any,
    });

    return tenantIndustries.map((ti) => ti.industry);
  }

  /**
   * Assign industries to tenant (replaces all existing assignments)
   */
  async assignIndustriesToTenant(
    tenantId: string,
    industryIds: string[],
    userId: string,
  ) {
    // Validate all industry IDs exist and are active
    const industries = await this.prisma.industry.findMany({
      where: {
        id: { in: industryIds },
        is_active: true,
      } as any,
    });

    if (industries.length !== industryIds.length) {
      const foundIds = industries.map((i) => i.id);
      const missingIds = industryIds.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(
        `Some industry IDs are invalid or inactive: ${missingIds.join(', ')}`,
      );
    }

    // Use transaction to replace all assignments
    await this.prisma.$transaction(async (tx) => {
      // Delete existing assignments
      await tx.tenant_industry.deleteMany({
        where: { tenant_id: tenantId } as any,
      });

      // Create new assignments
      if (industryIds.length > 0) {
        await tx.tenant_industry.createMany({
          data: industryIds.map((industry_id) => ({
            id: randomBytes(16).toString('hex'),
            tenant_id: tenantId,
            industry_id,
          })) as any,
        });
      }
    });

    // Audit log
    await this.auditLogger.log({
      actor_user_id: userId,
      actor_type: 'user',
      entity_type: 'tenant_industry',
      entity_id: tenantId,
      action_type: 'updated',
      description: `Updated tenant industries (assigned ${industryIds.length} industries)`,
      after_json: { industry_ids: industryIds },
    });

    this.logger.log(
      `Tenant ${tenantId} industries updated: ${industryIds.length} industries assigned by user ${userId}`,
    );

    // Return updated industries
    return this.getTenantIndustries(tenantId);
  }
}
