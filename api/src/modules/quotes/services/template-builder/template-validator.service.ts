import { Injectable, BadRequestException } from '@nestjs/common';
import Handlebars from 'handlebars';

interface ValidationResult {
  is_valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  type: 'syntax' | 'security' | 'structure' | 'binding';
  message: string;
  line?: number;
  column?: number;
  field?: string;
}

interface ValidationWarning {
  type: 'performance' | 'best_practice' | 'compatibility';
  message: string;
  line?: number;
  field?: string;
}

interface SecurityScanResult {
  is_safe: boolean;
  threats: SecurityThreat[];
}

interface SecurityThreat {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'xss' | 'injection' | 'external_resource';
  description: string;
  location?: string;
}

@Injectable()
export class TemplateValidatorService {
  // Forbidden HTML tags that could pose security risks
  private readonly FORBIDDEN_TAGS = [
    'script',
    'iframe',
    'object',
    'embed',
    'applet',
    'meta',
    'link',
    'base',
    'form',
  ];

  // Forbidden HTML attributes
  private readonly FORBIDDEN_ATTRIBUTES = [
    'onload',
    'onerror',
    'onclick',
    'onmouseover',
    'onfocus',
    'onblur',
    'onchange',
    'onsubmit',
  ];

  // Allowed Handlebars helpers (whitelist)
  private readonly ALLOWED_HELPERS = [
    'if',
    'unless',
    'each',
    'with',
    'lookup',
    'currency',
    'date',
    'percent',
    'eq',
    'ne',
    'lt',
    'gt',
    'lte',
    'gte',
    'and',
    'or',
    'not',
    'multiply',
    'divide',
    'add',
    'subtract',
  ];

  // Maximum template sizes
  private readonly MAX_HTML_SIZE = 2 * 1024 * 1024; // 2 MB
  private readonly MAX_COMPONENTS = 50;

  /**
   * Validate visual template structure
   */
  async validateVisualTemplate(structure: any): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Check if structure exists
      if (!structure || typeof structure !== 'object') {
        errors.push({
          type: 'structure',
          message: 'Visual template structure must be a valid JSON object',
        });
        return { is_valid: false, errors, warnings };
      }

      // Check version
      if (!structure.version || structure.version !== '1.0') {
        errors.push({
          type: 'structure',
          message: 'Visual template version must be "1.0"',
          field: 'version',
        });
      }

      // Validate layout
      if (!structure.layout) {
        errors.push({
          type: 'structure',
          message: 'Visual template must have a layout object',
          field: 'layout',
        });
      } else {
        this.validateLayout(structure.layout, errors, warnings);
      }

      // Validate theme
      if (structure.theme) {
        this.validateTheme(structure.theme, errors, warnings);
      }

      // Count total components
      const componentCount = this.countComponents(structure);
      if (componentCount > this.MAX_COMPONENTS) {
        errors.push({
          type: 'structure',
          message: `Template exceeds maximum component limit (${this.MAX_COMPONENTS}). Found: ${componentCount}`,
        });
      }

      // Check for circular references in component structure
      if (this.hasCircularReferences(structure)) {
        errors.push({
          type: 'structure',
          message: 'Template contains circular component references',
        });
      }

      return {
        is_valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push({
        type: 'structure',
        message: `Validation error: ${error.message}`,
      });
      return { is_valid: false, errors, warnings };
    }
  }

  /**
   * Validate Handlebars HTML/CSS code
   */
  async validateHandlebarsCode(
    html: string,
    css?: string,
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check size limits
    const htmlSize = Buffer.byteLength(html, 'utf8');
    if (htmlSize > this.MAX_HTML_SIZE) {
      errors.push({
        type: 'structure',
        message: `HTML content exceeds maximum size (${this.MAX_HTML_SIZE / 1024 / 1024} MB). Size: ${(htmlSize / 1024 / 1024).toFixed(2)} MB`,
      });
    }

    if (css) {
      const cssSize = Buffer.byteLength(css, 'utf8');
      if (cssSize > this.MAX_HTML_SIZE) {
        errors.push({
          type: 'structure',
          message: `CSS content exceeds maximum size (${this.MAX_HTML_SIZE / 1024 / 1024} MB). Size: ${(cssSize / 1024 / 1024).toFixed(2)} MB`,
        });
      }
    }

    // Validate Handlebars syntax
    try {
      Handlebars.compile(html);
    } catch (error) {
      errors.push({
        type: 'syntax',
        message: `Handlebars syntax error: ${error.message}`,
      });
    }

    // Security scan
    const securityResult = await this.securityScan(html);
    if (!securityResult.is_safe) {
      securityResult.threats.forEach((threat) => {
        errors.push({
          type: 'security',
          message: `[${threat.severity.toUpperCase()}] ${threat.type}: ${threat.description}`,
        });
      });
    }

    // Validate CSS (if provided)
    if (css) {
      // Check for external imports (security risk)
      if (css.includes('@import')) {
        const importMatches = css.match(/@import\s+url\(['"]?([^'"]+)['"]?\)/g);
        if (importMatches) {
          importMatches.forEach((match) => {
            errors.push({
              type: 'security',
              message: `External CSS import not allowed: ${match}`,
            });
          });
        }
      }
    }

    // Check for potentially dangerous Handlebars helpers
    const helperMatches = html.match(/\{\{#?([a-zA-Z_][a-zA-Z0-9_]*)/g);
    if (helperMatches) {
      const usedHelpers = new Set<string>();
      helperMatches.forEach((match) => {
        const helper = match.replace(/\{\{#?/, '').trim();
        if (!this.ALLOWED_HELPERS.includes(helper) && !helper.includes('.')) {
          usedHelpers.add(helper);
        }
      });

      if (usedHelpers.size > 0) {
        warnings.push({
          type: 'best_practice',
          message: `Unknown or custom Handlebars helpers detected: ${Array.from(usedHelpers).join(', ')}. Ensure these are registered.`,
        });
      }
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Security scan for XSS and injection vulnerabilities
   */
  async securityScan(html: string): Promise<SecurityScanResult> {
    const threats: SecurityThreat[] = [];

    // Check for forbidden tags
    this.FORBIDDEN_TAGS.forEach((tag) => {
      const regex = new RegExp(`<${tag}[^>]*>`, 'gi');
      const matches = html.match(regex);
      if (matches) {
        threats.push({
          severity: 'critical',
          type: 'xss',
          description: `Forbidden HTML tag detected: <${tag}>`,
          location: matches[0],
        });
      }
    });

    // Check for forbidden attributes (event handlers)
    this.FORBIDDEN_ATTRIBUTES.forEach((attr) => {
      const regex = new RegExp(`${attr}\\s*=`, 'gi');
      const matches = html.match(regex);
      if (matches) {
        threats.push({
          severity: 'high',
          type: 'xss',
          description: `Forbidden attribute detected: ${attr}=`,
          location: matches[0],
        });
      }
    });

    // Check for javascript: protocol in href/src attributes
    const jsProtocolRegex = /(?:href|src)\s*=\s*['"]?\s*javascript:/gi;
    const jsMatches = html.match(jsProtocolRegex);
    if (jsMatches) {
      threats.push({
        severity: 'critical',
        type: 'xss',
        description: 'javascript: protocol detected in href/src attribute',
        location: jsMatches[0],
      });
    }

    // Check for data: URIs with script content
    const dataUriRegex =
      /(?:href|src)\s*=\s*['"]?\s*data:text\/html[^'"]*script/gi;
    const dataMatches = html.match(dataUriRegex);
    if (dataMatches) {
      threats.push({
        severity: 'high',
        type: 'xss',
        description: 'data: URI with script content detected',
        location: dataMatches[0],
      });
    }

    // Check for external resource loading (potential SSRF)
    const externalResourceRegex = /(?:href|src)\s*=\s*['"]?\s*https?:\/\//gi;
    const externalMatches = html.match(externalResourceRegex);
    if (externalMatches && externalMatches.length > 5) {
      threats.push({
        severity: 'medium',
        type: 'external_resource',
        description: `Template loads ${externalMatches.length} external resources. Consider using relative paths or data URIs.`,
      });
    }

    return {
      is_safe:
        threats.filter(
          (t) => t.severity === 'critical' || t.severity === 'high',
        ).length === 0,
      threats,
    };
  }

  /**
   * Extract all Handlebars variables from template
   */
  extractVariables(html: string): string[] {
    const variables = new Set<string>();

    // Match {{variable}} and {{object.property}}
    const variableRegex = /\{\{([^#\/!][^}]*)\}\}/g;
    let match;

    while ((match = variableRegex.exec(html)) !== null) {
      const variable = match[1].trim();

      // Skip helpers (if, each, etc.)
      if (
        !this.ALLOWED_HELPERS.some((helper) =>
          variable.startsWith(helper + ' '),
        )
      ) {
        // Extract the base variable name
        const baseVar = variable.split(/[\s()]/)[0];
        if (baseVar && !this.ALLOWED_HELPERS.includes(baseVar)) {
          variables.add(baseVar);
        }
      }
    }

    return Array.from(variables).sort();
  }

  /**
   * Check data bindings - verify all variables are available in sample data
   */
  async checkDataBindings(template: any, sampleData: any): Promise<string[]> {
    const missingVariables: string[] = [];
    const html =
      template.template_type === 'code'
        ? template.html_content
        : this.compileVisualToHandlebars(template.visual_structure);

    const variables = this.extractVariables(html);

    variables.forEach((variable) => {
      const path = variable.split('.');
      let current = sampleData;
      let found = true;

      for (const key of path) {
        if (current && typeof current === 'object' && key in current) {
          current = current[key];
        } else {
          found = false;
          break;
        }
      }

      if (!found) {
        missingVariables.push(variable);
      }
    });

    return missingVariables;
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private validateLayout(
    layout: any,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Validate page size
    const validPageSizes = ['letter', 'a4', 'legal'];
    if (!layout.pageSize || !validPageSizes.includes(layout.pageSize)) {
      errors.push({
        type: 'structure',
        message: `Invalid page size. Must be one of: ${validPageSizes.join(', ')}`,
        field: 'layout.pageSize',
      });
    }

    // Validate orientation
    const validOrientations = ['portrait', 'landscape'];
    if (
      !layout.orientation ||
      !validOrientations.includes(layout.orientation)
    ) {
      errors.push({
        type: 'structure',
        message: `Invalid orientation. Must be one of: ${validOrientations.join(', ')}`,
        field: 'layout.orientation',
      });
    }

    // Validate margins
    if (!layout.margins || typeof layout.margins !== 'object') {
      errors.push({
        type: 'structure',
        message: 'Layout must have margins object',
        field: 'layout.margins',
      });
    } else {
      ['top', 'right', 'bottom', 'left'].forEach((side) => {
        if (
          typeof layout.margins[side] !== 'number' ||
          layout.margins[side] < 0
        ) {
          errors.push({
            type: 'structure',
            message: `Invalid margin.${side}: must be a non-negative number`,
            field: `layout.margins.${side}`,
          });
        }
      });
    }

    // Validate sections
    ['header', 'body', 'footer'].forEach((section) => {
      if (layout[section]) {
        this.validateSection(section, layout[section], errors, warnings);
      }
    });
  }

  private validateSection(
    sectionName: string,
    section: any,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    if (sectionName !== 'body' && typeof section.enabled !== 'boolean') {
      errors.push({
        type: 'structure',
        message: `${sectionName} section must have 'enabled' boolean property`,
        field: `layout.${sectionName}.enabled`,
      });
    }

    if (!Array.isArray(section.components)) {
      errors.push({
        type: 'structure',
        message: `${sectionName} section must have 'components' array`,
        field: `layout.${sectionName}.components`,
      });
    } else {
      section.components.forEach((component, index) => {
        this.validateComponent(
          component,
          `${sectionName}.components[${index}]`,
          errors,
          warnings,
        );
      });
    }
  }

  private validateComponent(
    component: any,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Required fields
    if (!component.id) {
      errors.push({
        type: 'structure',
        message: `Component must have 'id' field`,
        field: `${path}.id`,
      });
    }

    if (!component.componentType) {
      errors.push({
        type: 'structure',
        message: `Component must have 'componentType' field`,
        field: `${path}.componentType`,
      });
    }

    // Validate position
    if (!component.position || typeof component.position !== 'object') {
      errors.push({
        type: 'structure',
        message: `Component must have 'position' object`,
        field: `${path}.position`,
      });
    } else {
      // Validate position values
      ['x', 'y'].forEach((coord) => {
        if (
          typeof component.position[coord] !== 'number' ||
          component.position[coord] < 0
        ) {
          errors.push({
            type: 'structure',
            message: `Invalid position.${coord}: must be a non-negative number`,
            field: `${path}.position.${coord}`,
          });
        }
      });

      // Width and height can be numbers or "auto"
      ['width', 'height'].forEach((dim) => {
        const value = component.position[dim];
        if (value !== 'auto' && (typeof value !== 'number' || value <= 0)) {
          errors.push({
            type: 'structure',
            message: `Invalid position.${dim}: must be a positive number or "auto"`,
            field: `${path}.position.${dim}`,
          });
        }
      });
    }

    // Warn if both componentId and inline definition exist
    if (component.componentId && component.structure) {
      warnings.push({
        type: 'best_practice',
        message: `Component has both componentId and inline structure. componentId will take precedence.`,
        field: `${path}`,
      });
    }
  }

  private validateTheme(
    theme: any,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Validate color formats (hex)
    const colorFields = ['primaryColor', 'secondaryColor'];
    colorFields.forEach((field) => {
      if (theme[field]) {
        const hexRegex = /^#[0-9A-Fa-f]{6}$/;
        if (!hexRegex.test(theme[field])) {
          errors.push({
            type: 'structure',
            message: `Invalid ${field}: must be a valid hex color (e.g., #FF5733)`,
            field: `theme.${field}`,
          });
        }
      }
    });

    // Validate font size
    if (
      theme.fontSize &&
      (typeof theme.fontSize !== 'number' ||
        theme.fontSize < 8 ||
        theme.fontSize > 72)
    ) {
      warnings.push({
        type: 'best_practice',
        message: 'Font size should be between 8 and 72 pixels',
        field: 'theme.fontSize',
      });
    }

    // Validate line height
    if (
      theme.lineHeight &&
      (typeof theme.lineHeight !== 'number' ||
        theme.lineHeight < 0.5 ||
        theme.lineHeight > 3)
    ) {
      warnings.push({
        type: 'best_practice',
        message: 'Line height should be between 0.5 and 3',
        field: 'theme.lineHeight',
      });
    }
  }

  private countComponents(structure: any): number {
    let count = 0;

    if (structure.layout) {
      if (structure.layout.header?.components) {
        count += structure.layout.header.components.length;
      }
      if (structure.layout.body?.components) {
        count += structure.layout.body.components.length;
      }
      if (structure.layout.footer?.components) {
        count += structure.layout.footer.components.length;
      }
    }

    return count;
  }

  private hasCircularReferences(structure: any): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const detectCycle = (componentId: string): boolean => {
      if (!componentId) return false;

      if (recursionStack.has(componentId)) return true;
      if (visited.has(componentId)) return false;

      visited.add(componentId);
      recursionStack.add(componentId);

      // Check component references (simplified - would need actual component lookup)
      // For now, just return false as we don't have nested component references yet

      recursionStack.delete(componentId);
      return false;
    };

    // Check all components in layout
    if (structure.layout) {
      const sections = [
        structure.layout.header?.components,
        structure.layout.body?.components,
        structure.layout.footer?.components,
      ];

      for (const components of sections) {
        if (Array.isArray(components)) {
          for (const component of components) {
            if (detectCycle(component.id)) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  private compileVisualToHandlebars(visualStructure: any): string {
    // Simplified version - full implementation in TemplateRendererService
    // Just extract data bindings for validation
    let html = '';

    const extractBindings = (components: any[]) => {
      components?.forEach((component) => {
        if (component.dataBindings) {
          Object.values(component.dataBindings).forEach((binding) => {
            if (typeof binding === 'string' && binding.includes('{{')) {
              html += ` ${binding} `;
            }
          });
        }
      });
    };

    if (visualStructure?.layout) {
      extractBindings(visualStructure.layout.header?.components);
      extractBindings(visualStructure.layout.body?.components);
      extractBindings(visualStructure.layout.footer?.components);
    }

    return html;
  }
}
