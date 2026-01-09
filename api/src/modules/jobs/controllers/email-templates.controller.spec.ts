import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EmailTemplatesController } from './email-templates.controller';
import { EmailTemplateService } from '../services/email-template.service';

describe('EmailTemplatesController', () => {
  let controller: EmailTemplatesController;
  let emailTemplateService: EmailTemplateService;

  const mockEmailTemplateService = {
    getAllTemplates: jest.fn(),
    getTemplate: jest.fn(),
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    renderTemplate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailTemplatesController],
      providers: [
        {
          provide: EmailTemplateService,
          useValue: mockEmailTemplateService,
        },
      ],
    }).compile();

    controller = module.get<EmailTemplatesController>(
      EmailTemplatesController,
    );
    emailTemplateService = module.get<EmailTemplateService>(
      EmailTemplateService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listTemplates', () => {
    it('should return list of all templates', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          template_key: 'welcome-email',
          subject: 'Welcome to {{company_name}}',
          html_body: '<h1>Welcome {{user_name}}</h1>',
          text_body: 'Welcome {{user_name}}',
          variables: ['company_name', 'user_name'],
          is_system: false,
          created_at: new Date(),
        },
        {
          id: 'template-2',
          template_key: 'password-reset',
          subject: 'Reset your password',
          html_body: '<p>Click here to reset: {{reset_link}}</p>',
          text_body: 'Click here to reset: {{reset_link}}',
          variables: ['reset_link'],
          is_system: true,
          created_at: new Date(),
        },
      ];

      mockEmailTemplateService.getAllTemplates.mockResolvedValue(
        mockTemplates,
      );

      const result = await controller.listTemplates({});

      expect(result).toEqual({ data: mockTemplates });
      expect(mockEmailTemplateService.getAllTemplates).toHaveBeenCalledWith({});
    });

    it('should filter templates by search query', async () => {
      const filters = {
        search: 'password',
        is_system: undefined,
      };

      mockEmailTemplateService.getAllTemplates.mockResolvedValue([]);

      await controller.listTemplates(filters);

      expect(mockEmailTemplateService.getAllTemplates).toHaveBeenCalledWith(
        filters,
      );
    });

    it('should filter templates by is_system flag', async () => {
      const filters = {
        is_system: true,
        search: undefined,
      };

      mockEmailTemplateService.getAllTemplates.mockResolvedValue([]);

      await controller.listTemplates(filters);

      expect(mockEmailTemplateService.getAllTemplates).toHaveBeenCalledWith(
        filters,
      );
    });
  });

  describe('getTemplate', () => {
    it('should return template by key', async () => {
      const mockTemplate = {
        id: 'template-1',
        template_key: 'welcome-email',
        subject: 'Welcome to {{company_name}}',
        html_body: '<h1>Welcome {{user_name}}</h1>',
        variables: ['company_name', 'user_name'],
        is_system: false,
      };

      mockEmailTemplateService.getTemplate.mockResolvedValue(mockTemplate);

      const result = await controller.getTemplate('welcome-email');

      expect(result).toEqual(mockTemplate);
      expect(mockEmailTemplateService.getTemplate).toHaveBeenCalledWith(
        'welcome-email',
      );
    });

    it('should throw NotFoundException when template not found', async () => {
      mockEmailTemplateService.getTemplate.mockResolvedValue(null);

      await expect(controller.getTemplate('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createTemplate', () => {
    it('should create a new template', async () => {
      const createDto = {
        template_key: 'new-template',
        subject: 'New Template Subject',
        html_body: '<p>Hello {{name}}</p>',
        text_body: 'Hello {{name}}',
        variables: ['name'],
        description: 'A new template for testing',
      };

      const mockCreatedTemplate = {
        id: 'template-1',
        ...createDto,
        is_system: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockEmailTemplateService.createTemplate.mockResolvedValue(
        mockCreatedTemplate,
      );

      const result = await controller.createTemplate(createDto);

      expect(result).toEqual(mockCreatedTemplate);
      expect(mockEmailTemplateService.createTemplate).toHaveBeenCalledWith(
        createDto,
      );
    });

    it('should throw BadRequestException on duplicate template_key', async () => {
      const createDto = {
        template_key: 'duplicate-key',
        subject: 'Subject',
        html_body: '<p>Body</p>',
        variables: [],
      };

      mockEmailTemplateService.createTemplate.mockRejectedValue(
        new BadRequestException('Template key already exists'),
      );

      await expect(controller.createTemplate(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException on invalid Handlebars syntax', async () => {
      const createDto = {
        template_key: 'invalid-template',
        subject: 'Subject',
        html_body: '<p>Hello {{name</p>',
        variables: ['name'],
      };

      mockEmailTemplateService.createTemplate.mockRejectedValue(
        new BadRequestException('Invalid Handlebars syntax'),
      );

      await expect(controller.createTemplate(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateTemplate', () => {
    it('should update a template', async () => {
      const updateDto = {
        subject: 'Updated Subject',
        html_body: '<p>Updated {{name}}</p>',
        variables: ['name', 'email'],
      };

      const mockUpdatedTemplate = {
        id: 'template-1',
        template_key: 'existing-template',
        ...updateDto,
        is_system: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockEmailTemplateService.updateTemplate.mockResolvedValue(
        mockUpdatedTemplate,
      );

      const result = await controller.updateTemplate(
        'existing-template',
        updateDto,
      );

      expect(result).toEqual(mockUpdatedTemplate);
      expect(mockEmailTemplateService.updateTemplate).toHaveBeenCalledWith(
        'existing-template',
        updateDto,
      );
    });

    it('should throw NotFoundException when template not found', async () => {
      const updateDto = {
        subject: 'Updated Subject',
      };

      mockEmailTemplateService.updateTemplate.mockRejectedValue(
        new NotFoundException('Template not found'),
      );

      await expect(
        controller.updateTemplate('non-existent', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when trying to update system template', async () => {
      const updateDto = {
        subject: 'Updated Subject',
      };

      mockEmailTemplateService.updateTemplate.mockRejectedValue(
        new BadRequestException('Cannot modify system templates'),
      );

      await expect(
        controller.updateTemplate('system-template', updateDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle partial updates', async () => {
      const updateDto = {
        description: 'Updated description only',
      };

      const mockUpdatedTemplate = {
        id: 'template-1',
        template_key: 'existing-template',
        subject: 'Original Subject',
        html_body: '<p>Original body</p>',
        description: 'Updated description only',
        variables: ['name'],
        is_system: false,
      };

      mockEmailTemplateService.updateTemplate.mockResolvedValue(
        mockUpdatedTemplate,
      );

      await controller.updateTemplate('existing-template', updateDto);

      expect(mockEmailTemplateService.updateTemplate).toHaveBeenCalledWith(
        'existing-template',
        updateDto,
      );
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a template', async () => {
      mockEmailTemplateService.deleteTemplate.mockResolvedValue(undefined);

      await controller.deleteTemplate('template-to-delete');

      expect(mockEmailTemplateService.deleteTemplate).toHaveBeenCalledWith(
        'template-to-delete',
      );
    });

    it('should throw NotFoundException when template not found', async () => {
      mockEmailTemplateService.deleteTemplate.mockRejectedValue(
        new NotFoundException('Template not found'),
      );

      await expect(controller.deleteTemplate('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when trying to delete system template', async () => {
      mockEmailTemplateService.deleteTemplate.mockRejectedValue(
        new BadRequestException('Cannot delete system templates'),
      );

      await expect(
        controller.deleteTemplate('system-template'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('previewTemplate', () => {
    it('should preview rendered template with variables', async () => {
      const mockTemplate = {
        id: 'template-1',
        template_key: 'welcome-email',
        subject: 'Welcome to {{company_name}}',
        html_body: '<h1>Welcome {{user_name}}!</h1>',
        text_body: 'Welcome {{user_name}}!',
        variables: ['company_name', 'user_name'],
      };

      const previewDto = {
        variables: {
          company_name: 'Acme Corp',
          user_name: 'John Doe',
        },
      };

      mockEmailTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockEmailTemplateService.renderTemplate
        .mockReturnValueOnce('Welcome to Acme Corp')
        .mockReturnValueOnce('<h1>Welcome John Doe!</h1>')
        .mockReturnValueOnce('Welcome John Doe!');

      const result = await controller.previewTemplate(
        'welcome-email',
        previewDto,
      );

      expect(result).toEqual({
        subject: 'Welcome to Acme Corp',
        html_body: '<h1>Welcome John Doe!</h1>',
        text_body: 'Welcome John Doe!',
      });
      expect(mockEmailTemplateService.renderTemplate).toHaveBeenCalledTimes(3);
      expect(mockEmailTemplateService.renderTemplate).toHaveBeenCalledWith(
        mockTemplate.subject,
        previewDto.variables,
      );
      expect(mockEmailTemplateService.renderTemplate).toHaveBeenCalledWith(
        mockTemplate.html_body,
        previewDto.variables,
      );
      expect(mockEmailTemplateService.renderTemplate).toHaveBeenCalledWith(
        mockTemplate.text_body,
        previewDto.variables,
      );
    });

    it('should handle template without text_body', async () => {
      const mockTemplate = {
        id: 'template-1',
        template_key: 'html-only',
        subject: 'Subject {{name}}',
        html_body: '<p>HTML {{name}}</p>',
        text_body: null,
        variables: ['name'],
      };

      const previewDto = {
        variables: { name: 'Test' },
      };

      mockEmailTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockEmailTemplateService.renderTemplate
        .mockReturnValueOnce('Subject Test')
        .mockReturnValueOnce('<p>HTML Test</p>');

      const result = await controller.previewTemplate('html-only', previewDto);

      expect(result).toEqual({
        subject: 'Subject Test',
        html_body: '<p>HTML Test</p>',
        text_body: null,
      });
      expect(mockEmailTemplateService.renderTemplate).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when template not found', async () => {
      const previewDto = {
        variables: { name: 'Test' },
      };

      mockEmailTemplateService.getTemplate.mockResolvedValue(null);

      await expect(
        controller.previewTemplate('non-existent', previewDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle rendering errors gracefully', async () => {
      const mockTemplate = {
        id: 'template-1',
        template_key: 'test-template',
        subject: 'Subject {{name}}',
        html_body: '<p>{{invalid}}</p>',
        variables: ['name'],
      };

      const previewDto = {
        variables: { name: 'Test' },
      };

      mockEmailTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockEmailTemplateService.renderTemplate.mockImplementation(() => {
        throw new Error('Rendering error: Missing variable');
      });

      await expect(
        controller.previewTemplate('test-template', previewDto),
      ).rejects.toThrow();
    });
  });
});
