import { randomBytes } from 'crypto';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { FilesService } from '../files.service';

/**
 * Background processor for automatic file cleanup
 * Handles the orphan file lifecycle:
 * 1. Mark files as orphan (30+ days old, no entity_id)
 * 2. Move orphans to trash (30+ days after being marked orphan)
 * 3. Permanently delete trashed files (30+ days in trash)
 */
@Processor('file-cleanup')
export class FileCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(FileCleanupProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    // Route to appropriate handler based on job name
    if (job.name === 'daily-cleanup') {
      return this.handleDailyCleanup(job);
    } else if (job.name === 'manual-cleanup') {
      return this.handleManualCleanup(job);
    }
    throw new Error(`Unknown job type: ${job.name}`);
  }

  /**
   * Daily cleanup job - runs at midnight
   * Processes all tenants to maintain file hygiene
   */
  private async handleDailyCleanup(job: Job) {
    this.logger.log('Starting daily file cleanup job');

    try {
      // Get all active tenants
      const tenants = await this.prisma.tenant.findMany({
        select: { id: true, company_name: true },
      });

      this.logger.log(`Processing ${tenants.length} tenants for file cleanup`);

      let totalOrphansMarked = 0;
      let totalOrphansTrashed = 0;
      let totalTrashedDeleted = 0;

      // Process each tenant
      for (const tenant of tenants) {
        try {
          // Step 1: Mark orphan files (30+ days old, no entity_id)
          const orphansResult = await this.filesService.findOrphans(tenant.id);
          totalOrphansMarked += orphansResult.marked_as_orphan || 0;

          if (orphansResult.marked_as_orphan > 0) {
            this.logger.log(
              `Tenant ${tenant.company_name}: Marked ${orphansResult.marked_as_orphan} files as orphan`,
            );
          }

          // Step 2: Move orphans to trash (30+ days after being marked orphan)
          // Get tenant owner for audit logging (automated cleanup on behalf of owner)
          const tenantOwner = await this.prisma.user.findFirst({
            where: {
              tenant_id: tenant.id,
              user_role_user_role_user_idTouser: {
                some: {
                  role: {
                    name: 'Owner',
                  },
                },
              },
            },
            select: { id: true },
          });

          if (!tenantOwner) {
            this.logger.warn(
              `Tenant ${tenant.company_name} has no owner, skipping cleanup`,
            );
            continue;
          }

          const trashResult = await this.filesService.moveOrphansToTrash(
            tenant.id,
            tenantOwner.id,
          );
          totalOrphansTrashed += trashResult.count || 0;

          if (trashResult.count > 0) {
            this.logger.log(
              `Tenant ${tenant.company_name}: Moved ${trashResult.count} orphan files to trash`,
            );
          }

          // Step 3: Permanently delete trashed files (30+ days in trash)
          const deleteResult = await this.filesService.cleanupTrashedFiles(
            tenant.id,
            tenantOwner.id,
          );
          totalTrashedDeleted += deleteResult.count || 0;

          if (deleteResult.count > 0) {
            this.logger.log(
              `Tenant ${tenant.company_name}: Permanently deleted ${deleteResult.count} trashed files`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Error processing tenant ${tenant.company_name}: ${error.message}`,
            error.stack,
          );
          // Continue processing other tenants
        }
      }

      // Log summary
      this.logger.log(
        `Daily cleanup completed: ${totalOrphansMarked} files marked as orphan, ` +
          `${totalOrphansTrashed} orphans moved to trash, ` +
          `${totalTrashedDeleted} trashed files deleted`,
      );

      return {
        success: true,
        tenantsProcessed: tenants.length,
        totalOrphansMarked,
        totalOrphansTrashed,
        totalTrashedDeleted,
      };
    } catch (error) {
      this.logger.error(`Daily cleanup job failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Manual cleanup job - can be triggered on-demand
   * Processes a specific tenant
   */
  private async handleManualCleanup(job: Job<{ tenantId: string; userId: string }, any, string>) {
    const { tenantId, userId } = job.data;

    this.logger.log(`Starting manual cleanup for tenant ${tenantId}`);

    try {
      // Step 1: Mark orphan files
      const orphansResult = await this.filesService.findOrphans(tenantId);

      // Step 2: Move orphans to trash
      const trashResult = await this.filesService.moveOrphansToTrash(tenantId, userId);

      // Step 3: Permanently delete trashed files
      const deleteResult = await this.filesService.cleanupTrashedFiles(tenantId, userId);

      this.logger.log(
        `Manual cleanup for tenant ${tenantId} completed: ` +
          `${orphansResult.marked_as_orphan} marked as orphan, ` +
          `${trashResult.count} moved to trash, ` +
          `${deleteResult.count} deleted`,
      );

      return {
        success: true,
        orphansMarked: orphansResult.marked_as_orphan,
        orphansTrashed: trashResult.count,
        trashedDeleted: deleteResult.count,
      };
    } catch (error) {
      this.logger.error(
        `Manual cleanup failed for tenant ${tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
