import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { FilesService } from '../../files/files.service';
import { FileCategory } from '../../files/dto/upload-file.dto';
import { ProjectActivityService } from './project-activity.service';
import {
  UploadProjectDocumentDto,
  ProjectDocumentType,
} from '../dto/upload-project-document.dto';

/**
 * Maps project_document_type → FileCategory for FilesService.uploadFile().
 *
 * Sprint 09 spec:
 *   contract → 'contract'
 *   permit   → 'misc'
 *   blueprint→ 'misc'
 *   agreement→ 'contract'
 *   photo    → 'photo'
 *   other    → 'misc'
 */
const DOC_TYPE_TO_FILE_CATEGORY: Record<ProjectDocumentType, FileCategory> = {
  [ProjectDocumentType.CONTRACT]: FileCategory.CONTRACT,
  [ProjectDocumentType.PERMIT]: FileCategory.MISC,
  [ProjectDocumentType.BLUEPRINT]: FileCategory.MISC,
  [ProjectDocumentType.AGREEMENT]: FileCategory.CONTRACT,
  [ProjectDocumentType.PHOTO]: FileCategory.PHOTO,
  [ProjectDocumentType.OTHER]: FileCategory.MISC,
};

@Injectable()
export class ProjectDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLoggerService: AuditLoggerService,
    private readonly filesService: FilesService,
    private readonly projectActivityService: ProjectActivityService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. upload(tenantId, projectId, userId, file, dto)
  // ---------------------------------------------------------------------------

  async upload(
    tenantId: string,
    projectId: string,
    userId: string,
    file: Express.Multer.File,
    dto: UploadProjectDocumentDto,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Verify project exists and belongs to tenant
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const fileCategory = DOC_TYPE_TO_FILE_CATEGORY[dto.document_type];

    const result = await this.filesService.uploadFile(tenantId, userId, file, {
      category: fileCategory,
      entity_type: 'project_document',
      entity_id: projectId,
    });

    const document = await this.prisma.project_document.create({
      data: {
        tenant_id: tenantId,
        project_id: projectId,
        file_id: result.file.file_id,
        file_url: result.url,
        file_name: result.file.original_filename,
        document_type: dto.document_type,
        description: dto.description ?? null,
        is_public: dto.is_public ?? false,
        uploaded_by_user_id: userId,
      },
    });

    await this.auditLoggerService.logTenantChange({
      action: 'created',
      entityType: 'project_document',
      entityId: document.id,
      tenantId,
      actorUserId: userId,
      after: {
        id: document.id,
        project_id: projectId,
        file_name: document.file_name,
        document_type: document.document_type,
        is_public: document.is_public,
      },
      description: `Uploaded document "${document.file_name}" to project ${project.project_number}`,
    });

    // Fire-and-forget activity log
    this.projectActivityService.logActivity(tenantId, {
      project_id: projectId,
      user_id: userId,
      activity_type: 'document_added',
      description: `Uploaded document: ${document.file_name} (${document.document_type})`,
      metadata: {
        document_id: document.id,
        document_type: document.document_type,
        file_name: document.file_name,
      },
    });

    return {
      id: document.id,
      project_id: document.project_id,
      file_id: document.file_id,
      file_url: document.file_url,
      file_name: document.file_name,
      document_type: document.document_type,
      description: document.description,
      is_public: document.is_public,
      uploaded_by_user_id: document.uploaded_by_user_id,
      created_at: document.created_at,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. findAll(tenantId, projectId, query)
  // ---------------------------------------------------------------------------

  async findAll(
    tenantId: string,
    projectId: string,
    query: { document_type?: string } = {},
  ) {
    // Verify project exists and belongs to tenant
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const where: any = {
      tenant_id: tenantId,
      project_id: projectId,
    };

    if (query.document_type) {
      where.document_type = query.document_type;
    }

    const documents = await this.prisma.project_document.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return documents.map((doc) => ({
      id: doc.id,
      project_id: doc.project_id,
      file_id: doc.file_id,
      file_url: doc.file_url,
      file_name: doc.file_name,
      document_type: doc.document_type,
      description: doc.description,
      is_public: doc.is_public,
      uploaded_by_user_id: doc.uploaded_by_user_id,
      created_at: doc.created_at,
    }));
  }

  // ---------------------------------------------------------------------------
  // 3. delete(tenantId, projectId, documentId, userId)
  // ---------------------------------------------------------------------------

  async delete(
    tenantId: string,
    projectId: string,
    documentId: string,
    userId: string,
  ) {
    const document = await this.prisma.project_document.findFirst({
      where: {
        id: documentId,
        tenant_id: tenantId,
        project_id: projectId,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Delete the document record first (FK constraint: onDelete Restrict on file)
    await this.prisma.project_document.delete({
      where: { id: documentId },
    });

    // Delete the file from storage
    await this.filesService.delete(tenantId, document.file_id, userId);

    await this.auditLoggerService.logTenantChange({
      action: 'deleted',
      entityType: 'project_document',
      entityId: documentId,
      tenantId,
      actorUserId: userId,
      before: {
        id: document.id,
        file_name: document.file_name,
        document_type: document.document_type,
        project_id: projectId,
      },
      description: `Deleted document "${document.file_name}" from project ${projectId}`,
    });
  }
}
