import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { randomUUID } from 'crypto';
import Handlebars from 'handlebars';

interface ComponentFilters {
  component_type?: string;
  category?: string;
  tags?: string[];
  is_global?: boolean;
  tenant_id?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

interface CreateComponentDto {
  name: string;
  description?: string;
  component_type: string;
  category: string;
  tags?: string[];
  structure: any;
  default_props?: any;
  html_template: string;
  css_template?: string;
  thumbnail_url?: string;
  usage_notes?: string;
  is_global?: boolean;
  tenant_id?: string;
}

interface UpdateComponentDto {
  name?: string;
  description?: string;
  structure?: any;
  default_props?: any;
  html_template?: string;
  css_template?: string;
  thumbnail_url?: string;
  usage_notes?: string;
  is_active?: boolean;
  sort_order?: number;
}

@Injectable()
export class TemplateComponentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all components with filtering and pagination
   */
  async listComponents(filters: ComponentFilters) {
    const {
      component_type,
      category,
      tags,
      is_global,
      tenant_id,
      is_active = true,
      page = 1,
      limit = 50,
    } = filters;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      is_active,
    };

    if (component_type) {
      where.component_type = component_type;
    }

    if (category) {
      where.category = category;
    }

    if (is_global !== undefined) {
      where.is_global = is_global;
    }

    // Multi-tenant filter
    if (tenant_id) {
      // Show both global components and tenant-specific components
      where.OR = [
        { is_global: true },
        { tenant_id: tenant_id },
      ];
    } else if (is_global === false) {
      // Only tenant-specific components
      where.tenant_id = { not: null };
    }

    // Tags filter (JSON array contains)
    if (tags && tags.length > 0) {
      // MySQL JSON_CONTAINS query
      where.tags = {
        array_contains: tags,
      };
    }

    const [components, total] = await Promise.all([
      this.prisma.template_component.findMany({
        where,
        orderBy: [
          { sort_order: 'asc' },
          { name: 'asc' },
        ],
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          component_type: true,
          category: true,
          tags: true,
          thumbnail_url: true,
          is_global: true,
          tenant_id: true,
          is_active: true,
          sort_order: true,
          created_at: true,
          updated_at: true,
        },
      }),
      this.prisma.template_component.count({ where }),
    ]);

    return {
      data: components,
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get component by ID with full details
   */
  async getComponent(componentId: string) {
    const component = await this.prisma.template_component.findUnique({
      where: { id: componentId },
      include: {
        tenant: {
          select: {
            id: true,
            company_name: true,
          },
        },
        created_by_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    if (!component) {
      throw new NotFoundException(`Component with ID ${componentId} not found`);
    }

    // Get usage count (would need to query visual templates that reference this component)
    // For now, return 0 - will implement when visual templates are created
    const usage_count = 0;

    return {
      ...component,
      usage_count,
      templates_using: [], // Will populate when templates are queried
    };
  }

  /**
   * Create custom component
   */
  async createComponent(userId: string, dto: CreateComponentDto) {
    // Validate component type
    const validTypes = [
      'header',
      'footer',
      'customer_info',
      'line_items',
      'totals',
      'terms',
      'signature',
      'payment_schedule',
      'warranty',
      'custom',
    ];

    if (!validTypes.includes(dto.component_type)) {
      throw new BadRequestException(
        `Invalid component_type. Must be one of: ${validTypes.join(', ')}`,
      );
    }

    // Validate category
    const validCategories = ['layout', 'content', 'pricing', 'branding', 'custom'];
    if (!validCategories.includes(dto.category)) {
      throw new BadRequestException(
        `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      );
    }

    // Validate Handlebars template
    try {
      Handlebars.compile(dto.html_template);
    } catch (error) {
      throw new BadRequestException(
        `Invalid Handlebars template: ${error.message}`,
      );
    }

    // Validate structure is valid JSON
    if (typeof dto.structure !== 'object') {
      throw new BadRequestException('Structure must be a valid JSON object');
    }

    const componentId = randomUUID();

    const component = await this.prisma.template_component.create({
      data: {
        id: componentId,
        name: dto.name,
        description: dto.description,
        component_type: dto.component_type,
        category: dto.category,
        tags: dto.tags || [],
        structure: dto.structure,
        default_props: dto.default_props || {},
        html_template: dto.html_template,
        css_template: dto.css_template,
        thumbnail_url: dto.thumbnail_url,
        usage_notes: dto.usage_notes,
        is_global: dto.is_global ?? false,
        tenant_id: dto.tenant_id || null,
        created_by_user_id: userId,
      },
    });

    return component;
  }

  /**
   * Update component
   */
  async updateComponent(componentId: string, updates: UpdateComponentDto) {
    // Check if component exists
    const existing = await this.prisma.template_component.findUnique({
      where: { id: componentId },
    });

    if (!existing) {
      throw new NotFoundException(`Component with ID ${componentId} not found`);
    }

    // If updating html_template, validate Handlebars syntax
    if (updates.html_template) {
      try {
        Handlebars.compile(updates.html_template);
      } catch (error) {
        throw new BadRequestException(
          `Invalid Handlebars template: ${error.message}`,
        );
      }
    }

    // Validate structure if provided
    if (updates.structure !== undefined && typeof updates.structure !== 'object') {
      throw new BadRequestException('Structure must be a valid JSON object');
    }

    const component = await this.prisma.template_component.update({
      where: { id: componentId },
      data: {
        ...updates,
        updated_at: new Date(),
      },
    });

    return component;
  }

  /**
   * Delete component (only if not in use)
   */
  async deleteComponent(componentId: string) {
    // Check if component exists
    const component = await this.prisma.template_component.findUnique({
      where: { id: componentId },
    });

    if (!component) {
      throw new NotFoundException(`Component with ID ${componentId} not found`);
    }

    // Check if component is in use
    // This would require querying visual templates to check if they reference this component
    // For now, we'll allow deletion - will add usage check when visual templates are implemented
    const usage = await this.getComponentUsage(componentId);

    if (usage.usage_count > 0) {
      throw new ConflictException(
        `Cannot delete component "${component.name}" because it is used by ${usage.usage_count} template(s). ` +
        `Templates using this component: ${usage.templates.slice(0, 3).join(', ')}${usage.templates.length > 3 ? '...' : ''}`,
      );
    }

    await this.prisma.template_component.delete({
      where: { id: componentId },
    });

    return {
      success: true,
      message: `Component "${component.name}" deleted successfully`,
    };
  }

  /**
   * Render component to HTML with props
   */
  async renderComponent(componentId: string, props: any): Promise<string> {
    const component = await this.prisma.template_component.findUnique({
      where: { id: componentId },
    });

    if (!component) {
      throw new NotFoundException(`Component with ID ${componentId} not found`);
    }

    // Merge default props with provided props
    const defaultProps = component.default_props && typeof component.default_props === 'object' ? component.default_props : {};
    const mergedProps = {
      ...defaultProps,
      ...props,
    };

    // Compile and render Handlebars template
    try {
      const template = Handlebars.compile(component.html_template);
      const html = template(mergedProps);

      // Wrap in container with component CSS
      let fullHtml = html;
      if (component.css_template) {
        fullHtml = `<style>${component.css_template}</style>\n${html}`;
      }

      return fullHtml;
    } catch (error) {
      throw new BadRequestException(
        `Error rendering component: ${error.message}`,
      );
    }
  }

  /**
   * Get component usage statistics
   */
  async getComponentUsage(componentId: string): Promise<{
    usage_count: number;
    templates: string[];
  }> {
    // Query visual templates that reference this component
    // Search through visual_structure JSON for component_id references
    const templates = await this.prisma.$queryRaw<
      Array<{ id: string; name: string }>
    >`
      SELECT id, name
      FROM quote_template
      WHERE template_type = 'visual'
        AND is_active = true
        AND (
          JSON_SEARCH(
            visual_structure,
            'one',
            ${componentId},
            NULL,
            '$.layout.header.components[*].component_id'
          ) IS NOT NULL
          OR JSON_SEARCH(
            visual_structure,
            'one',
            ${componentId},
            NULL,
            '$.layout.body.components[*].component_id'
          ) IS NOT NULL
          OR JSON_SEARCH(
            visual_structure,
            'one',
            ${componentId},
            NULL,
            '$.layout.footer.components[*].component_id'
          ) IS NOT NULL
        )
    `;

    return {
      usage_count: templates.length,
      templates: templates.map((t) => t.id),
    };
  }

  /**
   * Get components by type
   */
  async getComponentsByType(componentType: string, tenantId?: string) {
    const where: any = {
      component_type: componentType,
      is_active: true,
    };

    if (tenantId) {
      where.OR = [
        { is_global: true },
        { tenant_id: tenantId },
      ];
    } else {
      where.is_global = true;
    }

    return this.prisma.template_component.findMany({
      where,
      orderBy: [
        { sort_order: 'asc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        description: true,
        component_type: true,
        thumbnail_url: true,
        default_props: true,
      },
    });
  }

  /**
   * Get components by category
   */
  async getComponentsByCategory(category: string, tenantId?: string) {
    const where: any = {
      category,
      is_active: true,
    };

    if (tenantId) {
      where.OR = [
        { is_global: true },
        { tenant_id: tenantId },
      ];
    } else {
      where.is_global = true;
    }

    return this.prisma.template_component.findMany({
      where,
      orderBy: [
        { sort_order: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Duplicate component (useful for creating custom versions)
   */
  async duplicateComponent(componentId: string, userId: string, tenantId?: string) {
    const source = await this.prisma.template_component.findUnique({
      where: { id: componentId },
    });

    if (!source) {
      throw new NotFoundException(`Component with ID ${componentId} not found`);
    }

    const newId = randomUUID();
    const newComponent = await this.prisma.template_component.create({
      data: {
        id: newId,
        name: `${source.name} (Copy)`,
        description: source.description,
        component_type: source.component_type,
        category: source.category as any,
        tags: source.tags as any,
        structure: source.structure as any,
        default_props: source.default_props as any,
        html_template: source.html_template,
        css_template: source.css_template,
        thumbnail_url: source.thumbnail_url,
        preview_html: source.preview_html,
        usage_notes: source.usage_notes,
        is_global: false, // Duplicates are never global
        tenant_id: tenantId || null,
        sort_order: source.sort_order,
        created_by_user_id: userId,
      },
    });

    return newComponent;
  }

  /**
   * Search components by name or description
   */
  async searchComponents(query: string, tenantId?: string, limit = 20) {
    const where: any = {
      is_active: true,
      OR: [
        { name: { contains: query } },
        { description: { contains: query } },
      ],
    };

    if (tenantId) {
      where.AND = {
        OR: [
          { is_global: true },
          { tenant_id: tenantId },
        ],
      };
    } else {
      where.is_global = true;
    }

    return this.prisma.template_component.findMany({
      where,
      take: limit,
      orderBy: [
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        description: true,
        component_type: true,
        category: true,
        thumbnail_url: true,
      },
    });
  }
}
