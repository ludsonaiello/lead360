import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { TemplateValidatorService } from './template-validator.service';
import { randomUUID } from 'crypto';

interface MigrationResult {
  migrated: number;
  failed: number;
  skipped: number;
  errors: MigrationError[];
}

interface MigrationError {
  template_id: string;
  template_name: string;
  error: string;
}

interface AnalysisResult {
  can_convert_to_visual: boolean;
  complexity: 'simple' | 'moderate' | 'complex';
  issues: string[];
  recommendations: string[];
}

@Injectable()
export class TemplateMigrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: TemplateValidatorService,
  ) {}

  /**
   * Migrate all existing templates to new system
   */
  async migrateAllTemplates(): Promise<MigrationResult> {
    console.log('Starting template migration...');

    const result: MigrationResult = {
      migrated: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    // Find all templates that need migration
    // Since template_type has default "code", we look for all templates
    const templates = await this.prisma.quote_template.findMany({
      where: {
        // All existing templates will be migrated to ensure consistency
      },
    });

    console.log(`Found ${templates.length} templates to migrate`);

    for (const template of templates) {
      try {
        await this.migrateTemplate(template.id);
        result.migrated++;
        console.log(`✓ Migrated: ${template.name} (${template.id})`);
      } catch (error) {
        result.failed++;
        result.errors.push({
          template_id: template.id,
          template_name: template.name,
          error: error.message,
        });
        console.error(`✗ Failed: ${template.name} (${template.id}) - ${error.message}`);
      }
    }

    // Check for templates that were already migrated
    const alreadyMigrated = await this.prisma.quote_template.count({
      where: {
        template_type: { in: ['visual', 'code'] },
      },
    });

    result.skipped = alreadyMigrated - result.migrated;

    console.log(`Migration complete: ${result.migrated} migrated, ${result.failed} failed, ${result.skipped} skipped`);

    return result;
  }

  /**
   * Migrate single template
   */
  async migrateTemplate(templateId: string): Promise<void> {
    const template = await this.prisma.quote_template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // If already migrated, skip
    if (template.template_type && template.template_type !== '') {
      console.log(`Template ${template.name} already migrated`);
      return;
    }

    // Extract CSS from HTML if inlined
    const { html, css } = this.extractCssFromHtml(template.html_content || '');

    // Validate the extracted code
    const validation = await this.validator.validateHandlebarsCode(html, css ?? undefined);

    // Update template with extracted code
    await this.prisma.quote_template.update({
      where: { id: templateId },
      data: {
        template_type: 'code',
        html_content: html,
        css_content: css,
        is_prebuilt: false,
      },
    });

    // Create initial version record if it doesn't exist
    const existingVersion = await this.prisma.quote_template_version.findFirst({
      where: { template_id: templateId },
    });

    if (!existingVersion) {
      await this.prisma.quote_template_version.create({
        data: {
          id: randomUUID(),
          template_id: templateId,
          version_number: 1,
          template_type: 'code',
          html_content: html,
          css_content: css,
          changes_summary: 'Initial migration from legacy system',
          created_by_user_id: template.created_by_user_id || 'system',
        },
      });
    }

    console.log(`Migrated template: ${template.name}`);
  }

  /**
   * Analyze template for migration strategy
   */
  async analyzeTemplate(templateId: string): Promise<AnalysisResult> {
    const template = await this.prisma.quote_template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const html = template.html_content || '';
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check HTML structure complexity
    const tagCount = (html.match(/<[^>]+>/g) || []).length;
    const hasInlineStyles = html.includes('style=');
    const hasScriptTags = /<script/i.test(html);
    const hasForbiddenTags = /<(iframe|object|embed)/i.test(html);

    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    let canConvert = true;

    // Assess complexity
    if (tagCount > 100) {
      complexity = 'complex';
      recommendations.push('Template has many HTML elements. Consider breaking into sections.');
    } else if (tagCount > 50) {
      complexity = 'moderate';
    }

    // Check for problematic content
    if (hasScriptTags) {
      issues.push('Template contains <script> tags (security risk)');
      canConvert = false;
    }

    if (hasForbiddenTags) {
      issues.push('Template contains forbidden tags (iframe, object, embed)');
      canConvert = false;
    }

    if (hasInlineStyles) {
      recommendations.push('Template uses inline styles. Extract to CSS for better maintainability.');
    }

    // Check for external resources
    if (/src=["']https?:\/\//i.test(html)) {
      recommendations.push('Template loads external resources. Consider using data URIs or local assets.');
    }

    // Validate Handlebars syntax
    const validation = await this.validator.validateHandlebarsCode(html);
    if (!validation.is_valid) {
      issues.push(`Handlebars validation failed: ${validation.errors.length} error(s)`);
      validation.errors.forEach(error => {
        issues.push(`  - ${error.message}`);
      });
      canConvert = false;
    }

    // Check for potential visual conversion
    const hasTable = /<table/i.test(html);
    const hasDivLayout = /<div/i.test(html);
    const hasSemanticStructure = /<(header|footer|section|article)/i.test(html);

    if (hasSemanticStructure) {
      recommendations.push('Template uses semantic HTML - good candidate for visual conversion');
    } else if (hasTable && !hasDivLayout) {
      recommendations.push('Template uses table-based layout - consider refactoring to modern layout');
    }

    return {
      can_convert_to_visual: canConvert && complexity !== 'complex',
      complexity,
      issues,
      recommendations,
    };
  }

  /**
   * Rollback migration for a template
   */
  async rollbackMigration(templateId: string): Promise<void> {
    const template = await this.prisma.quote_template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Get original version (version 1)
    const originalVersion = await this.prisma.quote_template_version.findFirst({
      where: {
        template_id: templateId,
        version_number: 1,
      },
    });

    if (!originalVersion) {
      throw new Error(`No original version found for template ${templateId}`);
    }

    // Restore original HTML (before CSS extraction)
    const originalHtml = originalVersion.html_content;

    // Reset template to pre-migration state
    await this.prisma.quote_template.update({
      where: { id: templateId },
      data: {
        template_type: 'code',
        html_content: originalHtml,
        css_content: null,
      },
    });

    console.log(`Rolled back migration for template: ${template.name}`);
  }

  /**
   * Get migration statistics
   */
  async getMigrationStats(): Promise<{
    total: number;
    migrated: number;
    not_migrated: number;
    visual_templates: number;
    code_templates: number;
  }> {
    const [total, migrated, visual, code] = await Promise.all([
      this.prisma.quote_template.count(),
      this.prisma.quote_template.count({
        where: {
          template_type: { in: ['visual', 'code'] },
        },
      }),
      this.prisma.quote_template.count({
        where: { template_type: 'visual' },
      }),
      this.prisma.quote_template.count({
        where: { template_type: 'code' },
      }),
    ]);

    return {
      total,
      migrated,
      not_migrated: total - migrated,
      visual_templates: visual,
      code_templates: code,
    };
  }

  /**
   * Batch migrate templates (for large datasets)
   */
  async batchMigrateTemplates(batchSize = 10): Promise<MigrationResult> {
    console.log(`Starting batch migration (batch size: ${batchSize})...`);

    const result: MigrationResult = {
      migrated: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    let hasMore = true;
    let offset = 0;

    while (hasMore) {
      const batch = await this.prisma.quote_template.findMany({
        where: {
          // All templates will be processed in batches
        },
        take: batchSize,
        skip: offset,
      });

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`Processing batch: ${offset + 1} to ${offset + batch.length}`);

      for (const template of batch) {
        try {
          await this.migrateTemplate(template.id);
          result.migrated++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            template_id: template.id,
            template_name: template.name,
            error: error.message,
          });
        }
      }

      offset += batchSize;

      // Add delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Batch migration complete: ${result.migrated} migrated, ${result.failed} failed`);

    return result;
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Extract inline CSS from HTML
   */
  private extractCssFromHtml(html: string): { html: string; css: string | null } {
    // Extract <style> tags
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let css = '';
    const matches = html.matchAll(styleRegex);

    for (const match of matches) {
      css += match[1] + '\n';
    }

    // Remove <style> tags from HTML
    const cleanHtml = html.replace(styleRegex, '');

    return {
      html: cleanHtml.trim(),
      css: css.trim() || null,
    };
  }

  /**
   * Check if template has been migrated
   */
  private async isMigrated(templateId: string): Promise<boolean> {
    const template = await this.prisma.quote_template.findUnique({
      where: { id: templateId },
      select: { template_type: true },
    });

    return template?.template_type !== null && template?.template_type !== '';
  }
}
