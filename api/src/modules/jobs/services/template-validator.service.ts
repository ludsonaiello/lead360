/**
 * Template Validator Service
 * Validates Handlebars templates against variable schemas
 */

import { Injectable } from '@nestjs/common';
import * as Handlebars from 'handlebars';

@Injectable()
export class TemplateValidatorService {
  /**
   * Extract all variables used in a Handlebars template
   */
  extractVariablesFromTemplate(templateString: string): string[] {
    try {
      const ast = Handlebars.parse(templateString);
      const variables = new Set<string>();

      const extractFromNode = (node: any) => {
        if (node.type === 'MustacheStatement' || node.type === 'BlockStatement') {
          if (node.path && node.path.type === 'PathExpression') {
            variables.add(node.path.original);
          }
        }

        // Recursively process child nodes
        if (node.program) {
          node.program.body.forEach(extractFromNode);
        }
        if (node.inverse) {
          node.inverse.body.forEach(extractFromNode);
        }
      };

      ast.body.forEach(extractFromNode);
      return Array.from(variables);
    } catch (error) {
      // If parsing fails, return empty array
      return [];
    }
  }

  /**
   * Validate template against variable schema
   */
  validateTemplate(
    templateBody: string,
    declaredVariables: string[],
  ): {
    valid: boolean;
    unusedVariables: string[]; // Declared but not used
    undefinedVariables: string[]; // Used but not declared
  } {
    const usedVariables = this.extractVariablesFromTemplate(templateBody);

    const unusedVariables = declaredVariables.filter((v) => !usedVariables.includes(v));

    const undefinedVariables = usedVariables.filter((v) => !declaredVariables.includes(v));

    return {
      valid: undefinedVariables.length === 0,
      unusedVariables,
      undefinedVariables,
    };
  }

  /**
   * Validate both HTML and text templates
   */
  validateBothTemplates(
    htmlBody: string,
    textBody: string | null,
    declaredVariables: string[],
  ): {
    valid: boolean;
    htmlValidation: ReturnType<typeof this.validateTemplate>;
    textValidation: ReturnType<typeof this.validateTemplate> | null;
  } {
    const htmlValidation = this.validateTemplate(htmlBody, declaredVariables);
    const textValidation = textBody ? this.validateTemplate(textBody, declaredVariables) : null;

    const valid =
      htmlValidation.valid && (textValidation === null || textValidation.valid);

    return {
      valid,
      htmlValidation,
      textValidation,
    };
  }
}
