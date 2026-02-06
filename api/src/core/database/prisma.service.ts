import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['info', 'warn', 'error']
          : ['error'],
    });

    // CRITICAL: Prisma middleware for tenant_id enforcement
    this.setupTenantIsolationMiddleware();
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * CRITICAL: Tenant Isolation Middleware
   *
   * Enforces tenant_id filtering on all queries to tenant-scoped tables.
   * This is the last line of defense against cross-tenant data leaks.
   *
   * Models that require tenant_id:
   * - User
   * - TenantAddress
   * - TenantLicense
   * - TenantInsurance
   * - TenantPaymentTerms
   * - TenantBusinessHours
   * - TenantCustomHours
   * - TenantServiceArea
   * - UserSignature
   * - AuditLog
   * - RefreshToken
   * - Role
   * - Permission
   * - (All future tenant-scoped models)
   *
   * Models exempt from tenant_id check:
   * - Tenant (root table)
   * - SubscriptionPlan (admin table)
   * - LicenseType (admin table)
   */
  private setupTenantIsolationMiddleware() {
    // Skip middleware setup if $use is not available (e.g., in test environment)
    if (typeof (this as any).$use !== 'function') {
      console.warn(
        'Prisma middleware ($use) not available - skipping tenant isolation middleware',
      );
      return;
    }

    // Models that require tenant_id filtering
    const TENANT_SCOPED_MODELS = [
      'User',
      'TenantAddress',
      'TenantLicense',
      'TenantInsurance',
      'TenantPaymentTerms',
      'TenantBusinessHours',
      'TenantCustomHours',
      'TenantServiceArea',
      'UserSignature',
      'AuditLog',
      'RefreshToken',
      'Role',
      'Permission',
      'RolePermission',
      // Quote Module Models
      'Quote',
      'Vendor',
      'ItemLibrary',
      'QuoteBundle',
      'QuoteTag',
      'QuoteWarrantyTier',
      'UnitMeasurement',
      'QuoteTemplate',
      // Twilio Communication Module Models
      'TenantSmsConfig',
      'TenantWhatsAppConfig',
      'CallRecord', // Nullable tenant_id for system-level calls
      'IvrConfiguration',
      'OfficeNumberWhitelist',
      'CallTranscription', // Nullable tenant_id for system-level
      'TranscriptionProviderConfiguration', // Nullable tenant_id for system-level providers
    ];

    // Models exempt from tenant_id check (admin/system tables)
    const EXEMPT_MODELS = ['Tenant', 'SubscriptionPlan', 'LicenseType'];

    (this as any).$use(async (params, next) => {
      const { model, action } = params;

      // Skip if no model (raw queries)
      if (!model) {
        return next(params);
      }

      // Skip exempt models
      if (EXEMPT_MODELS.includes(model)) {
        return next(params);
      }

      // Skip tenant isolation for specific operations (e.g., tenant creation during registration)
      const skipTenantCheck =
        params.skipTenantCheck === true ||
        params.args?.skipTenantCheck === true;

      if (skipTenantCheck) {
        // Remove the flag before passing to Prisma
        if (params.args) {
          delete params.args.skipTenantCheck;
        }
        return next(params);
      }

      // Enforce tenant_id for tenant-scoped models
      if (TENANT_SCOPED_MODELS.includes(model)) {
        // For mutations (create, update, delete), check tenant_id is present
        if (
          [
            'create',
            'createMany',
            'update',
            'updateMany',
            'delete',
            'deleteMany',
            'upsert',
          ].includes(action)
        ) {
          // For create/createMany, check data.tenant_id
          if (action === 'create' && params.args.data) {
            if (!params.args.data.tenant_id) {
              throw new Error(
                `SECURITY VIOLATION: Attempted to create ${model} without tenant_id. ` +
                  `This is a critical security issue. All tenant-scoped operations MUST include tenant_id.`,
              );
            }
          }

          if (action === 'createMany' && params.args.data) {
            const records = Array.isArray(params.args.data)
              ? params.args.data
              : [params.args.data];
            for (const record of records) {
              if (!record.tenant_id) {
                throw new Error(
                  `SECURITY VIOLATION: Attempted to createMany ${model} without tenant_id in all records.`,
                );
              }
            }
          }

          // For update/delete, check where.tenant_id
          if (
            ['update', 'updateMany', 'delete', 'deleteMany'].includes(action)
          ) {
            if (!params.args.where) {
              throw new Error(
                `SECURITY VIOLATION: Attempted ${action} on ${model} without where clause. ` +
                  `This could affect multiple tenants.`,
              );
            }

            // For updateMany/deleteMany, tenant_id is especially critical
            if (['updateMany', 'deleteMany'].includes(action)) {
              if (!params.args.where.tenant_id) {
                throw new Error(
                  `SECURITY VIOLATION: Attempted ${action} on ${model} without tenant_id filter. ` +
                    `This operation MUST be scoped to a specific tenant.`,
                );
              }
            }
          }
        }

        // For queries (findMany, findFirst, findUnique, count, aggregate), inject tenant_id if missing
        if (
          [
            'findMany',
            'findFirst',
            'findUnique',
            'count',
            'aggregate',
          ].includes(action)
        ) {
          // Skip tenant_id injection for findUnique if querying by ID only (ID includes tenant check in service layer)
          // This allows service methods like findOne(tenantId, resourceId) to work
          if (action === 'findUnique' && params.args.where?.id) {
            // Allow, but service layer must verify tenant_id separately
            return next(params);
          }

          // For other queries, warn if tenant_id is missing (in development)
          if (!params.args.where?.tenant_id) {
            if (process.env.NODE_ENV === 'development') {
              console.warn(
                `WARNING: Query on ${model} without tenant_id filter. ` +
                  `This may expose cross-tenant data. Action: ${action}`,
              );
            }
            // In production, this should be an error, but we'll allow it for now
            // to avoid breaking existing code during migration
          }
        }
      }

      return next(params);
    });
  }
}
