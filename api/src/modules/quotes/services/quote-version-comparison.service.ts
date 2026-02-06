import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { QuoteVersionService } from './quote-version.service';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuid } from 'uuid';

@Injectable()
export class QuoteVersionComparisonService {
  private readonly logger = new Logger(QuoteVersionComparisonService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly versionService: QuoteVersionService,
  ) {}

  /**
   * Compare two versions of a quote
   * Generates detailed diff of all changes between versions
   *
   * @param quoteId - Quote UUID
   * @param fromVersionNumber - Source version number (e.g., "1.0")
   * @param toVersionNumber - Target version number (e.g., "1.5")
   * @param tenantId - Tenant UUID
   * @returns Detailed comparison with differences
   */
  async compareVersions(
    quoteId: string,
    fromVersionNumber: string,
    toVersionNumber: string,
    tenantId: string,
  ): Promise<any> {
    // Validate quote exists and belongs to tenant
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    // Fetch both versions
    const [fromVersion, toVersion] = await Promise.all([
      this.prisma.quote_version.findFirst({
        where: {
          quote_id: quoteId,
          version_number: new Decimal(fromVersionNumber),
        },
      }),
      this.prisma.quote_version.findFirst({
        where: {
          quote_id: quoteId,
          version_number: new Decimal(toVersionNumber),
        },
      }),
    ]);

    if (!fromVersion || !toVersion) {
      throw new NotFoundException('One or both versions not found');
    }

    // Parse snapshots
    const fromSnapshot = JSON.parse(fromVersion.snapshot_data);
    const toSnapshot = JSON.parse(toVersion.snapshot_data);

    // Deep compare
    const differences = {
      quote_settings: this.compareQuoteSettings(
        fromSnapshot.quote,
        toSnapshot.quote,
      ),
      items: this.compareItems(fromSnapshot.items, toSnapshot.items),
      groups: this.compareGroups(fromSnapshot.groups, toSnapshot.groups),
      totals: this.compareTotals(fromSnapshot.quote, toSnapshot.quote),
      discount_rules: this.compareDiscountRules(
        fromSnapshot.discount_rules,
        toSnapshot.discount_rules,
      ),
      draw_schedule: this.compareDrawSchedule(
        fromSnapshot.draw_schedule,
        toSnapshot.draw_schedule,
      ),
    };

    // Generate summary
    const summary = {
      items_added: differences.items.added.length,
      items_removed: differences.items.removed.length,
      items_modified: differences.items.modified.length,
      groups_added: differences.groups.added.length,
      groups_removed: differences.groups.removed.length,
      groups_modified: differences.groups.modified.length,
      settings_changed: Object.keys(differences.quote_settings).length > 0,
      total_change_amount: toSnapshot.quote.total - fromSnapshot.quote.total,
      total_change_percent:
        ((toSnapshot.quote.total - fromSnapshot.quote.total) /
          fromSnapshot.quote.total) *
        100,
    };

    return {
      quote_id: quoteId,
      from_version: fromVersionNumber,
      to_version: toVersionNumber,
      from_created_at: fromVersion.created_at,
      to_created_at: toVersion.created_at,
      to_change_summary: toVersion.change_summary,
      summary,
      differences,
    };
  }

  /**
   * Compare quote settings (profit, overhead, contingency, status, etc.)
   */
  private compareQuoteSettings(from: any, to: any): any {
    const changes: any = {};

    const fieldsToCompare = [
      'title',
      'status',
      'custom_profit_percent',
      'custom_overhead_percent',
      'custom_contingency_percent',
      'valid_until',
      'notes',
    ];

    fieldsToCompare.forEach((field) => {
      if (from[field] !== to[field]) {
        changes[field] = { from: from[field], to: to[field] };
      }
    });

    return changes;
  }

  /**
   * Compare items (added, removed, modified)
   */
  private compareItems(fromItems: any[], toItems: any[]): any {
    const fromIds = new Set(fromItems.map((i) => i.id));
    const toIds = new Set(toItems.map((i) => i.id));

    // Added items (in to, not in from)
    const added = toItems
      .filter((item) => !fromIds.has(item.id))
      .map((item) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        total_cost: item.total_cost,
        group_name: item.quote_group?.name || null,
      }));

    // Removed items (in from, not in to)
    const removed = fromItems
      .filter((item) => !toIds.has(item.id))
      .map((item) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        total_cost: item.total_cost,
        group_name: item.quote_group?.name || null,
      }));

    // Modified items (exists in both but data changed)
    const modified = toItems
      .filter((toItem) => fromIds.has(toItem.id))
      .map((toItem) => {
        const fromItem = fromItems.find((f) => f.id === toItem.id);
        const changes: any = {};

        // Compare key fields
        const fieldsToCompare = [
          'title',
          'quantity',
          'material_cost_per_unit',
          'labor_cost_per_unit',
          'equipment_cost_per_unit',
          'subcontract_cost_per_unit',
          'other_cost_per_unit',
          'total_cost',
          'order_index',
        ];

        fieldsToCompare.forEach((field) => {
          if (fromItem[field] !== toItem[field]) {
            changes[field] = { from: fromItem[field], to: toItem[field] };
          }
        });

        // Check group change
        const fromGroupId = fromItem.quote_group?.id;
        const toGroupId = toItem.quote_group?.id;
        if (fromGroupId !== toGroupId) {
          changes.group = {
            from: fromItem.quote_group?.name || 'Ungrouped',
            to: toItem.quote_group?.name || 'Ungrouped',
          };
        }

        return Object.keys(changes).length > 0
          ? { id: toItem.id, title: toItem.title, changes }
          : null;
      })
      .filter((item) => item !== null);

    return { added, removed, modified };
  }

  /**
   * Compare groups (added, removed, modified)
   */
  private compareGroups(fromGroups: any[], toGroups: any[]): any {
    const fromIds = new Set(fromGroups.map((g) => g.id));
    const toIds = new Set(toGroups.map((g) => g.id));

    const added = toGroups
      .filter((group) => !fromIds.has(group.id))
      .map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        item_count: group.items.length,
      }));

    const removed = fromGroups
      .filter((group) => !toIds.has(group.id))
      .map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        item_count: group.items.length,
      }));

    const modified = toGroups
      .filter((toGroup) => fromIds.has(toGroup.id))
      .map((toGroup) => {
        const fromGroup = fromGroups.find((f) => f.id === toGroup.id);
        const changes: any = {};

        if (fromGroup.name !== toGroup.name) {
          changes.name = { from: fromGroup.name, to: toGroup.name };
        }
        if (fromGroup.description !== toGroup.description) {
          changes.description = {
            from: fromGroup.description,
            to: toGroup.description,
          };
        }
        if (fromGroup.items.length !== toGroup.items.length) {
          changes.item_count = {
            from: fromGroup.items.length,
            to: toGroup.items.length,
          };
        }

        return Object.keys(changes).length > 0
          ? { id: toGroup.id, name: toGroup.name, changes }
          : null;
      })
      .filter((group) => group !== null);

    return { added, removed, modified };
  }

  /**
   * Compare totals
   */
  private compareTotals(from: any, to: any): any {
    const changes: any = {};

    ['subtotal', 'discount_amount', 'tax_amount', 'total'].forEach((field) => {
      if (from[field] !== to[field]) {
        changes[field] = {
          from: from[field],
          to: to[field],
          change: to[field] - from[field],
        };
      }
    });

    return changes;
  }

  /**
   * Compare discount rules
   */
  private compareDiscountRules(fromRules: any[], toRules: any[]): any {
    const fromIds = new Set(fromRules.map((r) => r.id));
    const toIds = new Set(toRules.map((r) => r.id));

    const added = toRules
      .filter((rule) => !fromIds.has(rule.id))
      .map((rule) => ({
        id: rule.id,
        rule_type: rule.rule_type,
        discount_value: rule.discount_value,
        reason: rule.reason,
      }));

    const removed = fromRules
      .filter((rule) => !toIds.has(rule.id))
      .map((rule) => ({
        id: rule.id,
        rule_type: rule.rule_type,
        discount_value: rule.discount_value,
        reason: rule.reason,
      }));

    return { added, removed };
  }

  /**
   * Compare draw schedule
   */
  private compareDrawSchedule(fromDraws: any[], toDraws: any[]): any {
    if (fromDraws.length === 0 && toDraws.length === 0) {
      return { changed: false };
    }

    if (fromDraws.length !== toDraws.length) {
      return {
        changed: true,
        from_count: fromDraws.length,
        to_count: toDraws.length,
      };
    }

    // Check if any draw changed
    const hasChanges = toDraws.some((toDraw, index) => {
      const fromDraw = fromDraws[index];
      return (
        fromDraw.draw_number !== toDraw.draw_number ||
        fromDraw.description !== toDraw.description ||
        fromDraw.percentage !== toDraw.percentage ||
        fromDraw.amount !== toDraw.amount
      );
    });

    return {
      changed: hasChanges,
      from_count: fromDraws.length,
      to_count: toDraws.length,
    };
  }

  /**
   * Restore a previous version
   * Creates backup of current state, then recreates quote from snapshot
   *
   * @param quoteId - Quote UUID
   * @param versionNumber - Version number to restore (e.g., "1.0")
   * @param tenantId - Tenant UUID
   * @param userId - User UUID
   * @param reason - Optional reason for restore
   * @returns Success result
   */
  async restoreVersion(
    quoteId: string,
    versionNumber: string,
    tenantId: string,
    userId: string,
    reason?: string,
  ): Promise<any> {
    // Validate quote
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    // Cannot restore approved quotes
    if (quote.status === 'approved') {
      throw new BadRequestException(
        'Cannot restore approved quote. Change status first.',
      );
    }

    // Fetch version to restore
    const version = await this.prisma.quote_version.findFirst({
      where: {
        quote_id: quoteId,
        version_number: new Decimal(versionNumber),
      },
    });

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    const snapshot = JSON.parse(version.snapshot_data);

    // Transaction
    return await this.prisma.$transaction(async (tx) => {
      // 1. Create backup of current state
      await this.versionService.createVersion(
        quoteId,
        1.0,
        `Backup before restore to v${versionNumber}`,
        userId,
        tx,
      );

      // 2. Delete existing related data
      await tx.quote_item.deleteMany({ where: { quote_id: quoteId } });
      await tx.quote_group.deleteMany({ where: { quote_id: quoteId } });
      await tx.quote_discount_rule.deleteMany({ where: { quote_id: quoteId } });
      await tx.draw_schedule_entry.deleteMany({ where: { quote_id: quoteId } });

      // 3. Recreate groups from snapshot
      if (snapshot.groups && snapshot.groups.length > 0) {
        for (const group of snapshot.groups) {
          await tx.quote_group.create({
            data: {
              id: uuid(), // New ID to avoid conflicts
              quote_id: quoteId,
              name: group.name,
              description: group.description,
              order_index: group.order_index,
            },
          });
        }
      }

      // 4. Recreate items from snapshot
      if (snapshot.items && snapshot.items.length > 0) {
        // Map old group IDs to new group IDs
        const newGroups = await tx.quote_group.findMany({
          where: { quote_id: quoteId },
          orderBy: { order_index: 'asc' },
        });

        for (const item of snapshot.items) {
          // Find new group ID by matching order_index
          let newGroupId: string | null = null;
          if (item.quote_group) {
            const matchingGroup = newGroups.find(
              (g) =>
                g.order_index ===
                snapshot.groups.find((sg: any) => sg.id === item.quote_group.id)
                  ?.order_index,
            );
            newGroupId = matchingGroup?.id || null;
          }

          await tx.quote_item.create({
            data: {
              id: uuid(),
              quote_id: quoteId,
              quote_group_id: newGroupId,
              title: item.title,
              description: item.description,
              quantity: new Decimal(item.quantity),
              unit_measurement_id: item.unit_measurement?.id,
              material_cost_per_unit: new Decimal(item.material_cost_per_unit),
              labor_cost_per_unit: new Decimal(item.labor_cost_per_unit),
              equipment_cost_per_unit: new Decimal(
                item.equipment_cost_per_unit,
              ),
              subcontract_cost_per_unit: new Decimal(
                item.subcontract_cost_per_unit,
              ),
              other_cost_per_unit: new Decimal(item.other_cost_per_unit),
              total_cost: new Decimal(item.total_cost),
              private_notes: item.notes,
              order_index: item.order_index,
            },
          });
        }
      }

      // 5. Recreate discount rules
      if (snapshot.discount_rules && snapshot.discount_rules.length > 0) {
        for (const rule of snapshot.discount_rules) {
          await tx.quote_discount_rule.create({
            data: {
              id: uuid(),
              quote_id: quoteId,
              rule_type: rule.rule_type,
              value: new Decimal(rule.value || rule.discount_value || 0),
              reason: rule.reason,
              apply_to: rule.apply_to,
              order_index: rule.order_index,
            },
          });
        }
      }

      // 6. Recreate draw schedule
      if (snapshot.draw_schedule && snapshot.draw_schedule.length > 0) {
        for (const draw of snapshot.draw_schedule) {
          // Handle both old field names (percentage/amount) and new field name (value)
          const drawValue = draw.value ?? draw.percentage ?? draw.amount ?? 0;

          await tx.draw_schedule_entry.create({
            data: {
              id: uuid(),
              quote_id: quoteId,
              draw_number: draw.draw_number,
              description: draw.description,
              calculation_type: draw.calculation_type,
              value: new Decimal(drawValue),
              order_index: draw.order_index,
            },
          });
        }
      }

      // 7. Update quote
      await tx.quote.update({
        where: { id: quoteId },
        data: {
          title: snapshot.quote.title,
          status: 'draft', // Restored quotes must be reviewed
          custom_profit_percent: snapshot.quote.custom_profit_percent
            ? new Decimal(snapshot.quote.custom_profit_percent)
            : null,
          custom_overhead_percent: snapshot.quote.custom_overhead_percent
            ? new Decimal(snapshot.quote.custom_overhead_percent)
            : null,
          custom_contingency_percent: snapshot.quote.custom_contingency_percent
            ? new Decimal(snapshot.quote.custom_contingency_percent)
            : null,
          subtotal: new Decimal(snapshot.quote.subtotal),
          discount_amount: new Decimal(snapshot.quote.discount_amount),
          tax_amount: new Decimal(snapshot.quote.tax_amount),
          total: new Decimal(snapshot.quote.total),
          private_notes: snapshot.quote.private_notes,
        },
      });

      // 8. Create version record for restore
      const reasonText = reason || `Restored to version ${versionNumber}`;
      await this.versionService.createVersion(
        quoteId,
        1.0,
        reasonText,
        userId,
        tx,
      );

      this.logger.log(`Restored quote ${quoteId} to version ${versionNumber}`);

      return {
        success: true,
        message: `Quote restored to version ${versionNumber}`,
        quote_id: quoteId,
        restored_version: versionNumber,
      };
    });
  }

  /**
   * Get version history timeline grouped by date
   *
   * @param quoteId - Quote UUID
   * @param tenantId - Tenant UUID
   * @returns Timeline grouped by date
   */
  async getVersionTimeline(quoteId: string, tenantId: string): Promise<any> {
    // Validate quote
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    const versions = await this.prisma.quote_version.findMany({
      where: { quote_id: quoteId },
      orderBy: { created_at: 'desc' },
    });

    // Group by date
    const timeline: any = {};

    versions.forEach((version) => {
      const date = version.created_at.toISOString().split('T')[0];

      if (!timeline[date]) {
        timeline[date] = [];
      }

      timeline[date].push({
        id: version.id,
        version_number: Number(version.version_number),
        change_summary: version.change_summary,
        created_at: version.created_at,
      });
    });

    return {
      quote_id: quoteId,
      total_versions: versions.length,
      timeline,
    };
  }

  /**
   * Get change summary for a specific version
   * Compares to previous version
   *
   * @param quoteId - Quote UUID
   * @param versionNumber - Version number (e.g., "1.5")
   * @param tenantId - Tenant UUID
   * @returns Human-readable change summary
   */
  async getChangeSummary(
    quoteId: string,
    versionNumber: string,
    tenantId: string,
  ): Promise<any> {
    // Validate quote
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    // Fetch target version
    const version = await this.prisma.quote_version.findFirst({
      where: {
        quote_id: quoteId,
        version_number: new Decimal(versionNumber),
      },
    });

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    // Find previous version
    const previousVersion = await this.prisma.quote_version.findFirst({
      where: {
        quote_id: quoteId,
        version_number: { lt: new Decimal(versionNumber) },
      },
      orderBy: { version_number: 'desc' },
    });

    if (!previousVersion) {
      return {
        version_number: versionNumber,
        change_summary: version.change_summary,
        created_at: version.created_at,
        summary: 'Initial version - no previous version to compare',
      };
    }

    // Compare to previous
    const comparison = await this.compareVersions(
      quoteId,
      String(Number(previousVersion.version_number)),
      versionNumber,
      tenantId,
    );

    // Generate human-readable summary
    const summaryPoints: string[] = [];

    if (comparison.summary.items_added > 0) {
      summaryPoints.push(`${comparison.summary.items_added} items added`);
    }
    if (comparison.summary.items_removed > 0) {
      summaryPoints.push(`${comparison.summary.items_removed} items removed`);
    }
    if (comparison.summary.items_modified > 0) {
      summaryPoints.push(`${comparison.summary.items_modified} items modified`);
    }
    if (comparison.summary.groups_added > 0) {
      summaryPoints.push(`${comparison.summary.groups_added} groups added`);
    }
    if (comparison.summary.groups_removed > 0) {
      summaryPoints.push(`${comparison.summary.groups_removed} groups removed`);
    }
    if (comparison.summary.settings_changed) {
      summaryPoints.push('Quote settings changed');
    }
    if (Math.abs(comparison.summary.total_change_amount) > 0.01) {
      const direction =
        comparison.summary.total_change_amount > 0 ? 'increased' : 'decreased';
      summaryPoints.push(
        `Total ${direction} by $${Math.abs(comparison.summary.total_change_amount).toFixed(2)} (${Math.abs(comparison.summary.total_change_percent).toFixed(2)}%)`,
      );
    }

    return {
      version_number: versionNumber,
      change_summary: version.change_summary,
      created_at: version.created_at,
      previous_version: Number(previousVersion.version_number),
      summary: summaryPoints.join(', ') || 'No significant changes detected',
      details: comparison.differences,
    };
  }
}
