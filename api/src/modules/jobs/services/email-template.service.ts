import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import * as Handlebars from 'handlebars';

@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async getTemplate(templateKey: string) {
    const template = await this.prisma.email_template.findFirst({
      where: { template_key: templateKey },
    });

    if (!template) {
      throw new NotFoundException(`Template ${templateKey} not found`);
    }

    return template;
  }

  async getAllTemplates(filters?: { search?: string; is_system?: boolean }) {
    return this.prisma.email_template.findMany({
      where: {
        ...(filters?.search && {
          OR: [
            { template_key: { contains: filters.search } },
            { description: { contains: filters.search } },
          ],
        }),
        ...(filters?.is_system !== undefined && { is_system: filters.is_system }),
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async createTemplate(data: {
    template_key: string;
    subject: string;
    html_body: string;
    text_body?: string;
    variables: string[];
    description?: string;
  }) {
    // Validate Handlebars syntax
    const validation = this.validateHandlebars(data.html_body);
    if (!validation.valid) {
      throw new BadRequestException(`Invalid HTML template: ${validation.error}`);
    }

    if (data.text_body) {
      const textValidation = this.validateHandlebars(data.text_body);
      if (!textValidation.valid) {
        throw new BadRequestException(`Invalid text template: ${textValidation.error}`);
      }
    }

    return this.prisma.email_template.create({
      data: {
        ...data,
        is_system: false,
      },
    });
  }

  async updateTemplate(
    templateKey: string,
    data: Partial<{
      subject: string;
      html_body: string;
      text_body: string;
      variables: string[];
      description: string;
    }>,
    actorUserId?: string,
  ) {
    const existing = await this.getTemplate(templateKey);

    // System templates can now be edited by admins
    // Log when system templates are modified for audit purposes
    if (existing.is_system) {
      this.logger.warn(
        `System template "${templateKey}" is being modified. This affects all instances where this template is used.`,
      );
    }

    // Validate new templates
    if (data.html_body) {
      const validation = this.validateHandlebars(data.html_body);
      if (!validation.valid) {
        throw new BadRequestException(`Invalid HTML template: ${validation.error}`);
      }
    }

    if (data.text_body) {
      const textValidation = this.validateHandlebars(data.text_body);
      if (!textValidation.valid) {
        throw new BadRequestException(`Invalid text template: ${textValidation.error}`);
      }
    }

    const updated = await this.prisma.email_template.update({
      where: { id: existing.id },
      data,
    });

    // Audit log system template changes
    if (existing.is_system) {
      await this.auditLogger.log({
        entity_type: 'email_template',
        entity_id: updated.id,
        action_type: 'updated',
        description: `System email template "${templateKey}" was modified`,
        before_json: {
          subject: existing.subject,
          html_body: existing.html_body,
          text_body: existing.text_body,
          variables: existing.variables,
        },
        after_json: {
          subject: updated.subject,
          html_body: updated.html_body,
          text_body: updated.text_body,
          variables: updated.variables,
        },
        actor_user_id: actorUserId,
        actor_type: actorUserId ? 'user' : 'platform_admin',
        status: 'success',
      });
    }

    return updated;
  }

  async deleteTemplate(templateKey: string) {
    const template = await this.getTemplate(templateKey);

    if (template.is_system) {
      throw new BadRequestException('Cannot delete system templates');
    }

    return this.prisma.email_template.delete({
      where: { id: template.id },
    });
  }

  renderTemplate(templateString: string, variables: Record<string, any>): string {
    const compiled = Handlebars.compile(templateString);
    return compiled(variables);
  }

  validateHandlebars(templateString: string): { valid: boolean; error?: string } {
    try {
      Handlebars.compile(templateString);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}
