import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { TemplateValidatorService } from './template-validator.service';
import { TemplateComponentService } from './template-component.service';
import { AuditLoggerService } from '../../../audit/services/audit-logger.service';
import { randomUUID } from 'crypto';
import Handlebars from 'handlebars';

interface CreateVisualTemplateDto {
  name: string;
  description?: string;
  category_id?: string;
  tags?: string[];
  layout_preset?: 'blank' | 'standard' | 'modern' | 'minimal';
  is_global?: boolean;
  is_default?: boolean;
  tenant_id?: string;
}

interface AddComponentDto {
  component_id?: string;
  component_type: string;
  position: {
    x: number;
    y: number;
    width: number | string;
    height: number | string;
  };
  props?: Record<string, any>;
  style?: Record<string, any>;
  data_bindings?: Record<string, string>;
  section?: 'header' | 'body' | 'footer';
}

interface UpdateComponentDto {
  position?: {
    x?: number;
    y?: number;
    width?: number | string;
    height?: number | string;
  };
  props?: Record<string, any>;
  style?: Record<string, any>;
  data_bindings?: Record<string, any>;
  conditions?: {
    show_if?: string;
    hide_if?: string;
  };
}

interface ReorderComponentsDto {
  component_order: string[];
  section: 'header' | 'body' | 'footer';
}

interface ApplyThemeDto {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
}

@Injectable()
export class VisualTemplateBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: TemplateValidatorService,
    private readonly componentService: TemplateComponentService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Create new visual template
   */
  async createVisualTemplate(userId: string, dto: CreateVisualTemplateDto): Promise<any> {
    // Generate initial visual structure based on preset
    const visualStructure = this.getLayoutPreset(dto.layout_preset || 'blank');

    // Validate visual structure
    const validation = await this.validator.validateVisualTemplate(visualStructure);

    if (!validation.is_valid) {
      throw new BadRequestException({
        message: 'Visual template structure validation failed',
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    // If setting as default, unset other defaults
    if (dto.is_default) {
      if (dto.is_global) {
        await this.prisma.quote_template.updateMany({
          where: { tenant_id: { equals: null }, is_default: true },
          data: { is_default: false },
        });
      } else if (dto.tenant_id) {
        await this.prisma.quote_template.updateMany({
          where: { tenant_id: dto.tenant_id, is_default: true },
          data: { is_default: false },
        });
      }
    }

    const templateId = randomUUID();

    // Compile visual structure to HTML/CSS (for preview)
    const { html, css } = await this.compileToHandlebars(visualStructure);

    // Create template
    const template = await this.prisma.quote_template.create({
      data: {
        id: templateId,
        tenant_id: dto.tenant_id || null,
        name: dto.name,
        description: dto.description,
        template_type: 'visual',
        visual_structure: visualStructure,
        html_content: html,
        css_content: css,
        category_id: dto.category_id,
        tags: dto.tags || [],
        is_global: dto.is_global ?? false,
        is_default: dto.is_default ?? false,
        is_prebuilt: false,
        created_by_user_id: userId,
      },
    });

    // Create initial version
    await this.createVersion(templateId, visualStructure, html, css, userId, 'Initial version');

    // Audit log
    if (dto.tenant_id) {
      await this.auditLogger.logTenantChange({
        action: 'created',
        entityType: 'quote_template',
        entityId: template.id,
        tenantId: dto.tenant_id,
        actorUserId: userId,
        after: template,
        description: `Visual template created: ${template.name}`,
      });
    }

    return {
      ...template,
      validation_warnings: validation.warnings,
    };
  }

  /**
   * Add component to visual template
   */
  async addComponent(templateId: string, userId: string, dto: AddComponentDto) {
    const template = await this.getVisualTemplate(templateId);

    const structure = template.visual_structure as any;

    // Generate unique component instance ID
    const componentInstanceId = randomUUID();

    // Build component instance
    const componentInstance: any = {
      id: componentInstanceId,
      componentType: dto.component_type,
      componentId: dto.component_id,
      position: dto.position,
      props: dto.props || {},
      style: dto.style || {},
      dataBindings: dto.data_bindings || {},
    };

    // Add to appropriate section
    const section = dto.section || 'body';
    if (!structure.layout[section]) {
      throw new BadRequestException(`Invalid section: ${section}`);
    }

    if (!structure.layout[section].components) {
      structure.layout[section].components = [];
    }

    structure.layout[section].components.push(componentInstance);

    // Validate updated structure
    const validation = await this.validator.validateVisualTemplate(structure);
    if (!validation.is_valid) {
      throw new BadRequestException({
        message: 'Component addition failed validation',
        errors: validation.errors,
      });
    }

    // Recompile to HTML/CSS
    const { html, css } = await this.compileToHandlebars(structure);

    // Update template
    const updated = await this.prisma.quote_template.update({
      where: { id: templateId },
      data: {
        visual_structure: structure,
        html_content: html,
        css_content: css,
        updated_at: new Date(),
      },
    });

    // Create new version
    await this.createNewVersion(templateId, structure, html, css, userId, `Added component: ${dto.component_type}`);

    return {
      ...updated,
      added_component_id: componentInstanceId,
    };
  }

  /**
   * Update component in visual template
   */
  async updateComponent(
    templateId: string,
    componentId: string,
    userId: string,
    dto: UpdateComponentDto,
  ) {
    const template = await this.getVisualTemplate(templateId);
    const structure = template.visual_structure as any;

    // Find component in structure
    const component = this.findComponentInStructure(structure, componentId);

    if (!component) {
      throw new NotFoundException(`Component ${componentId} not found in template`);
    }

    // Update component properties
    if (dto.position) {
      component.position = { ...component.position, ...dto.position };
    }

    if (dto.props) {
      component.props = { ...component.props, ...dto.props };
    }

    if (dto.style) {
      component.style = { ...component.style, ...dto.style };
    }

    if (dto.data_bindings) {
      component.dataBindings = { ...component.dataBindings, ...dto.data_bindings };
    }

    if (dto.conditions) {
      component.conditions = dto.conditions;
    }

    // Validate updated structure
    const validation = await this.validator.validateVisualTemplate(structure);
    if (!validation.is_valid) {
      throw new BadRequestException({
        message: 'Component update failed validation',
        errors: validation.errors,
      });
    }

    // Recompile to HTML/CSS
    const { html, css } = await this.compileToHandlebars(structure);

    // Update template
    const updated = await this.prisma.quote_template.update({
      where: { id: templateId },
      data: {
        visual_structure: structure,
        html_content: html,
        css_content: css,
        updated_at: new Date(),
      },
    });

    // Create new version
    await this.createNewVersion(templateId, structure, html, css, userId, `Updated component: ${componentId}`);

    return updated;
  }

  /**
   * Remove component from visual template
   */
  async removeComponent(templateId: string, componentId: string, userId: string) {
    const template = await this.getVisualTemplate(templateId);
    const structure = template.visual_structure as any;

    // Find and remove component from structure
    const removed = this.removeComponentFromStructure(structure, componentId);

    if (!removed) {
      throw new NotFoundException(`Component ${componentId} not found in template`);
    }

    // Recompile to HTML/CSS
    const { html, css } = await this.compileToHandlebars(structure);

    // Update template
    const updated = await this.prisma.quote_template.update({
      where: { id: templateId },
      data: {
        visual_structure: structure,
        html_content: html,
        css_content: css,
        updated_at: new Date(),
      },
    });

    // Create new version
    await this.createNewVersion(templateId, structure, html, css, userId, `Removed component: ${componentId}`);

    return updated;
  }

  /**
   * Reorder components in section (drag-and-drop)
   */
  async reorderComponents(
    templateId: string,
    userId: string,
    dto: ReorderComponentsDto,
  ) {
    const template = await this.getVisualTemplate(templateId);
    const structure = template.visual_structure as any;

    const section = structure.layout[dto.section];
    if (!section || !section.components) {
      throw new BadRequestException(`Invalid section: ${dto.section}`);
    }

    // Reorder components based on provided order
    const componentMap = new Map(section.components.map((c: any) => [c.id, c]));
    const reordered = dto.component_order
      .map(id => componentMap.get(id))
      .filter(c => c !== undefined);

    // Check if all components are accounted for
    if (reordered.length !== section.components.length) {
      throw new BadRequestException('Component order must include all components');
    }

    section.components = reordered;

    // Recompile to HTML/CSS
    const { html, css } = await this.compileToHandlebars(structure);

    // Update template
    const updated = await this.prisma.quote_template.update({
      where: { id: templateId },
      data: {
        visual_structure: structure,
        html_content: html,
        css_content: css,
        updated_at: new Date(),
      },
    });

    // Create new version
    await this.createNewVersion(templateId, structure, html, css, userId, `Reordered components in ${dto.section}`);

    return updated;
  }

  /**
   * Apply theme to visual template
   */
  async applyTheme(templateId: string, userId: string, dto: ApplyThemeDto) {
    const template = await this.getVisualTemplate(templateId);
    const structure = template.visual_structure as any;

    if (!structure.theme) {
      structure.theme = {};
    }

    // Update theme properties
    Object.assign(structure.theme, dto);

    // Recompile to HTML/CSS
    const { html, css } = await this.compileToHandlebars(structure);

    // Update template
    const updated = await this.prisma.quote_template.update({
      where: { id: templateId },
      data: {
        visual_structure: structure,
        html_content: html,
        css_content: css,
        updated_at: new Date(),
      },
    });

    // Create new version
    await this.createNewVersion(templateId, structure, html, css, userId, 'Applied theme changes');

    return updated;
  }

  /**
   * Compile visual structure to Handlebars HTML + CSS
   */
  async compileToHandlebars(structure: any): Promise<{ html: string; css: string }> {
    const { layout, theme } = structure;

    // Generate CSS
    const css = this.generateCSS(layout, theme);

    // Generate HTML
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${css}</style>
</head>
<body class="quote-template">
  <div class="template-container">
`;

    // Render header
    if (layout.header?.enabled && layout.header.components) {
      html += '    <header class="template-header">\n';
      for (const component of layout.header.components) {
        html += await this.renderComponent(component);
      }
      html += '    </header>\n';
    }

    // Render body
    if (layout.body?.components) {
      html += '    <main class="template-body">\n';
      for (const component of layout.body.components) {
        html += await this.renderComponent(component);
      }
      html += '    </main>\n';
    }

    // Render footer
    if (layout.footer?.enabled && layout.footer.components) {
      html += '    <footer class="template-footer">\n';
      for (const component of layout.footer.components) {
        html += await this.renderComponent(component);
      }
      html += '    </footer>\n';
    }

    html += `  </div>
</body>
</html>`;

    return { html, css };
  }

  /**
   * Export visual template to code (HTML/CSS)
   */
  async exportToCode(templateId: string) {
    const template = await this.getVisualTemplate(templateId);

    const { html, css } = await this.compileToHandlebars(template.visual_structure);

    const variables = this.validator.extractVariables(html);

    return {
      html_content: html,
      css_content: css,
      handlebars_variables: variables,
    };
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async getVisualTemplate(templateId: string) {
    const template = await this.prisma.quote_template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${templateId} not found`);
    }

    if (template.template_type !== 'visual') {
      throw new BadRequestException(
        'This endpoint is for visual templates only. Use code template endpoints for code templates.',
      );
    }

    return template;
  }

  private getLayoutPreset(preset: string): any {
    const baseStructure = {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 50, right: 50, bottom: 50, left: 50 },
        header: { enabled: true, height: 100, components: [] },
        body: { components: [] },
        footer: { enabled: true, height: 80, components: [] },
      },
      theme: {
        primaryColor: '#2563eb',
        secondaryColor: '#64748b',
        fontFamily: 'Inter, sans-serif',
        fontSize: 14,
        lineHeight: 1.5,
      },
    };

    switch (preset) {
      case 'standard':
        // Add standard components placeholder
        return baseStructure;

      case 'modern':
        baseStructure.theme.primaryColor = '#6366f1';
        baseStructure.theme.fontFamily = 'Poppins, sans-serif';
        return baseStructure;

      case 'minimal':
        baseStructure.layout.header.enabled = false;
        baseStructure.layout.footer.enabled = false;
        baseStructure.theme.fontFamily = 'Arial, sans-serif';
        return baseStructure;

      case 'blank':
      default:
        return baseStructure;
    }
  }

  private async renderComponent(componentInstance: any): Promise<string> {
    // Load component definition if componentId is provided
    let htmlTemplate: string;
    let cssTemplate: string | null = null;
    let defaultProps: any = {};

    if (componentInstance.componentId) {
      // Load from component library
      try {
        const component = await this.componentService.getComponent(componentInstance.componentId);
        htmlTemplate = component.html_template;
        cssTemplate = component.css_template;
        defaultProps = component.default_props || {};
      } catch (error) {
        // Component not found, use inline fallback
        htmlTemplate = this.getInlineComponentTemplate(componentInstance.componentType);
      }
    } else {
      // Use inline component template
      htmlTemplate = this.getInlineComponentTemplate(componentInstance.componentType);
    }

    // Merge default props with instance props
    const props = { ...defaultProps, ...componentInstance.props };

    // Apply data bindings (replace props with Handlebars expressions)
    const boundProps = this.applyDataBindings(props, componentInstance.dataBindings || {});

    // Compile component template
    const template = Handlebars.compile(htmlTemplate);
    let html = template(boundProps);

    // Generate component style
    const style = this.generateComponentStyle(componentInstance.position, componentInstance.style || {});

    // Wrap in container
    html = `      <div class="component component-${componentInstance.componentType}" style="${style}">\n${html}\n      </div>\n`;

    // Apply conditional rendering
    if (componentInstance.conditions?.show_if) {
      html = `{{#if ${componentInstance.conditions.show_if}}}\n${html}{{/if}}\n`;
    }
    if (componentInstance.conditions?.hide_if) {
      html = `{{#unless ${componentInstance.conditions.hide_if}}}\n${html}{{/unless}}\n`;
    }

    return html;
  }

  private getInlineComponentTemplate(componentType: string): string {
    // Fallback templates for common component types
    const templates: Record<string, string> = {
      header: '<div class="header"><h1>{{company_name}}</h1></div>',
      footer: '<div class="footer"><p>{{footer_text}}</p></div>',
      customer_info: '<div class="customer-info"><p><strong>{{label}}:</strong> {{customer_name}}</p></div>',
      line_items: '<table class="line-items">{{#each items}}<tr><td>{{title}}</td><td>{{quantity}}</td></tr>{{/each}}</table>',
      totals: '<div class="totals"><p><strong>Total:</strong> {{currency total}}</p></div>',
      custom: '<div class="custom-component">{{content}}</div>',
    };

    return templates[componentType] || templates.custom;
  }

  private applyDataBindings(props: any, bindings: Record<string, string>): any {
    const bound = { ...props };

    Object.entries(bindings).forEach(([propKey, handlebarsExpression]) => {
      bound[propKey] = handlebarsExpression;
    });

    return bound;
  }

  private generateComponentStyle(position: any, style: any): string {
    const styles: string[] = [];

    if (position.x !== undefined) styles.push(`left: ${position.x}px`);
    if (position.y !== undefined) styles.push(`top: ${position.y}px`);
    if (position.width) {
      styles.push(`width: ${typeof position.width === 'number' ? position.width + 'px' : position.width}`);
    }
    if (position.height) {
      styles.push(`height: ${typeof position.height === 'number' ? position.height + 'px' : position.height}`);
    }

    // Add custom styles
    Object.entries(style).forEach(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      styles.push(`${cssKey}: ${value}`);
    });

    return styles.join('; ');
  }

  private generateCSS(layout: any, theme: any): string {
    return `
body.quote-template {
  font-family: ${theme?.fontFamily || 'Arial, sans-serif'};
  font-size: ${theme?.fontSize || 14}px;
  line-height: ${theme?.lineHeight || 1.5};
  color: #333;
  margin: 0;
  padding: 0;
}

.template-container {
  max-width: ${layout.pageSize === 'a4' ? '210mm' : '8.5in'};
  margin: 0 auto;
  padding: ${layout.margins?.top || 50}px ${layout.margins?.right || 50}px ${layout.margins?.bottom || 50}px ${layout.margins?.left || 50}px;
}

.template-header {
  margin-bottom: 20px;
}

.template-body {
  min-height: 400px;
}

.template-footer {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.component {
  margin-bottom: 15px;
}

:root {
  --primary-color: ${theme?.primaryColor || '#2563eb'};
  --secondary-color: ${theme?.secondaryColor || '#64748b'};
}
    `.trim();
  }

  private findComponentInStructure(structure: any, componentId: string): any {
    const sections = [
      structure.layout.header?.components,
      structure.layout.body?.components,
      structure.layout.footer?.components,
    ];

    for (const components of sections) {
      if (Array.isArray(components)) {
        const found = components.find((c: any) => c.id === componentId);
        if (found) return found;
      }
    }

    return null;
  }

  private removeComponentFromStructure(structure: any, componentId: string): boolean {
    const sections = ['header', 'body', 'footer'];

    for (const sectionName of sections) {
      const section = structure.layout[sectionName];
      if (section?.components) {
        const index = section.components.findIndex((c: any) => c.id === componentId);
        if (index !== -1) {
          section.components.splice(index, 1);
          return true;
        }
      }
    }

    return false;
  }

  private async createVersion(
    templateId: string,
    visualStructure: any,
    html: string,
    css: string | null,
    userId: string,
    changesSummary: string,
    versionNumber = 1,
  ) {
    await this.prisma.quote_template_version.create({
      data: {
        id: randomUUID(),
        template_id: templateId,
        version_number: versionNumber,
        template_type: 'visual',
        visual_structure: visualStructure,
        html_content: html,
        css_content: css,
        changes_summary: changesSummary,
        created_by_user_id: userId,
      },
    });
  }

  private async createNewVersion(
    templateId: string,
    visualStructure: any,
    html: string,
    css: string | null,
    userId: string,
    changesSummary: string,
  ) {
    const latestVersion = await this.prisma.quote_template_version.findFirst({
      where: { template_id: templateId },
      orderBy: { version_number: 'desc' },
    });

    const newVersionNumber = (latestVersion?.version_number || 0) + 1;

    await this.createVersion(
      templateId,
      visualStructure,
      html,
      css,
      userId,
      changesSummary,
      newVersionNumber,
    );
  }
}
