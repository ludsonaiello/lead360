import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { FilesService } from '../../files/files.service';
import { FileCategory } from '../../files/dto/upload-file.dto';
import { CreateSubcontractorDto } from '../dto/create-subcontractor.dto';
import { UpdateSubcontractorDto } from '../dto/update-subcontractor.dto';
import { CreateSubcontractorContactDto } from '../dto/create-subcontractor-contact.dto';
import {
  UploadSubcontractorDocumentDto,
  SubcontractorDocumentType,
} from '../dto/upload-subcontractor-document.dto';

const ALLOWED_REVEAL_FIELDS = ['bank_routing', 'bank_account'] as const;
type RevealField = (typeof ALLOWED_REVEAL_FIELDS)[number];

const ENCRYPTED_FIELD_MAP: Record<RevealField, string> = {
  bank_routing: 'bank_routing_encrypted',
  bank_account: 'bank_account_encrypted',
};

const DOC_TYPE_TO_FILE_CATEGORY: Record<
  SubcontractorDocumentType,
  FileCategory
> = {
  [SubcontractorDocumentType.INSURANCE]: FileCategory.INSURANCE,
  [SubcontractorDocumentType.COI]: FileCategory.INSURANCE,
  [SubcontractorDocumentType.CONTRACT]: FileCategory.CONTRACT,
  [SubcontractorDocumentType.AGREEMENT]: FileCategory.CONTRACT,
  [SubcontractorDocumentType.LICENSE]: FileCategory.LICENSE,
  [SubcontractorDocumentType.OTHER]: FileCategory.MISC,
};

@Injectable()
export class SubcontractorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly auditLoggerService: AuditLoggerService,
    private readonly filesService: FilesService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. create(tenantId, userId, dto)
  // ---------------------------------------------------------------------------

  async create(
    tenantId: string,
    userId: string,
    dto: CreateSubcontractorDto,
  ) {
    const encryptedData = this.encryptBankFields(dto);
    const insuranceExpiryDate = dto.insurance_expiry_date
      ? new Date(dto.insurance_expiry_date)
      : null;

    const complianceStatus = this.computeComplianceStatus(insuranceExpiryDate);

    const subcontractor = await this.prisma.subcontractor.create({
      data: {
        tenant_id: tenantId,
        created_by_user_id: userId,
        business_name: dto.business_name,
        trade_specialty: dto.trade_specialty ?? null,
        email: dto.email ?? null,
        website: dto.website ?? null,
        insurance_provider: dto.insurance_provider ?? null,
        insurance_policy_number: dto.insurance_policy_number ?? null,
        insurance_expiry_date: insuranceExpiryDate,
        coi_on_file: dto.coi_on_file ?? false,
        compliance_status: complianceStatus,
        default_payment_method: dto.default_payment_method ?? null,
        bank_name: dto.bank_name ?? null,
        venmo_handle: dto.venmo_handle ?? null,
        zelle_contact: dto.zelle_contact ?? null,
        notes: dto.notes ?? null,
        ...encryptedData,
      },
      include: {
        contacts: true,
        documents: true,
      },
    });

    const sanitizedAfter = {
      id: subcontractor.id,
      business_name: subcontractor.business_name,
      trade_specialty: subcontractor.trade_specialty,
      email: subcontractor.email,
      is_active: subcontractor.is_active,
    };

    await this.auditLoggerService.logTenantChange({
      action: 'created',
      entityType: 'subcontractor',
      entityId: subcontractor.id,
      tenantId,
      actorUserId: userId,
      after: sanitizedAfter,
      description: `Created subcontractor: ${subcontractor.business_name}`,
    });

    return this.maskResponse(subcontractor);
  }

  // ---------------------------------------------------------------------------
  // 2. findAll(tenantId, query)
  // ---------------------------------------------------------------------------

  async findAll(
    tenantId: string,
    query: {
      page?: number;
      limit?: number;
      is_active?: boolean;
      compliance_status?: string;
      search?: string;
    } = {},
  ) {
    let page = query.page ?? 1;
    let limit = query.limit ?? 20;
    if (page < 1) page = 1;
    if (limit > 100) limit = 100;
    if (limit < 1) limit = 1;

    const skip = (page - 1) * limit;

    const where: any = { tenant_id: tenantId };

    if (query.is_active !== undefined) {
      where.is_active = query.is_active;
    }

    // Use DB compliance_status for filtering (set on create/update).
    // The response will always contain the freshly recomputed value.
    if (query.compliance_status) {
      where.compliance_status = query.compliance_status;
    }

    if (query.search) {
      where.OR = [
        { business_name: { contains: query.search } },
        { trade_specialty: { contains: query.search } },
        { email: { contains: query.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.subcontractor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.subcontractor.count({ where }),
    ]);

    // Recompute compliance_status on every read and mask bank fields
    const maskedData = data.map((sub) => this.maskResponse(sub));

    return {
      data: maskedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 3. findOne(tenantId, id)
  // ---------------------------------------------------------------------------

  async findOne(tenantId: string, id: string) {
    const subcontractor = await this.prisma.subcontractor.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        contacts: true,
        documents: true,
      },
    });

    if (!subcontractor) {
      throw new NotFoundException('Subcontractor not found');
    }

    return this.maskResponse(subcontractor);
  }

  // ---------------------------------------------------------------------------
  // 4. update(tenantId, id, userId, dto)
  // ---------------------------------------------------------------------------

  async update(
    tenantId: string,
    id: string,
    userId: string,
    dto: UpdateSubcontractorDto,
  ) {
    const existing = await this.prisma.subcontractor.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Subcontractor not found');
    }

    const encryptedData = this.encryptBankFields(dto);

    const updateData: any = {};

    const directFields = [
      'business_name',
      'trade_specialty',
      'email',
      'website',
      'insurance_provider',
      'insurance_policy_number',
      'coi_on_file',
      'default_payment_method',
      'bank_name',
      'venmo_handle',
      'zelle_contact',
      'notes',
      'is_active',
    ] as const;

    for (const field of directFields) {
      if (dto[field] !== undefined) {
        updateData[field] = dto[field];
      }
    }

    // Handle insurance_expiry_date conversion
    if (dto.insurance_expiry_date !== undefined) {
      updateData.insurance_expiry_date = dto.insurance_expiry_date
        ? new Date(dto.insurance_expiry_date)
        : null;
    }

    // Merge encrypted bank fields
    Object.assign(updateData, encryptedData);

    // Recompute compliance_status based on the new or existing expiry date
    const effectiveExpiryDate =
      dto.insurance_expiry_date !== undefined
        ? updateData.insurance_expiry_date
        : existing.insurance_expiry_date;
    updateData.compliance_status =
      this.computeComplianceStatus(effectiveExpiryDate);

    const updated = await this.prisma.subcontractor.update({
      where: { id },
      data: updateData,
      include: {
        contacts: true,
        documents: true,
      },
    });

    const sanitizedBefore = {
      id: existing.id,
      business_name: existing.business_name,
      trade_specialty: existing.trade_specialty,
      email: existing.email,
      is_active: existing.is_active,
    };
    const sanitizedAfter = {
      id: updated.id,
      business_name: updated.business_name,
      trade_specialty: updated.trade_specialty,
      email: updated.email,
      is_active: updated.is_active,
    };

    await this.auditLoggerService.logTenantChange({
      action: 'updated',
      entityType: 'subcontractor',
      entityId: id,
      tenantId,
      actorUserId: userId,
      before: sanitizedBefore,
      after: sanitizedAfter,
      description: `Updated subcontractor: ${updated.business_name}`,
    });

    return this.maskResponse(updated);
  }

  // ---------------------------------------------------------------------------
  // 5. softDelete(tenantId, id, userId)
  // ---------------------------------------------------------------------------

  async softDelete(tenantId: string, id: string, userId: string) {
    const existing = await this.prisma.subcontractor.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Subcontractor not found');
    }

    await this.prisma.subcontractor.update({
      where: { id },
      data: { is_active: false },
    });

    await this.auditLoggerService.logTenantChange({
      action: 'deleted',
      entityType: 'subcontractor',
      entityId: id,
      tenantId,
      actorUserId: userId,
      before: {
        id: existing.id,
        business_name: existing.business_name,
        is_active: true,
      },
      description: `Soft-deleted subcontractor: ${existing.business_name}`,
    });
  }

  // ---------------------------------------------------------------------------
  // 6. revealField(tenantId, id, userId, field)
  // ---------------------------------------------------------------------------

  async revealField(
    tenantId: string,
    id: string,
    userId: string,
    field: string,
  ): Promise<{ field: string; value: string }> {
    if (!ALLOWED_REVEAL_FIELDS.includes(field as RevealField)) {
      throw new BadRequestException(
        `Field '${field}' is not revealable. Allowed: ${ALLOWED_REVEAL_FIELDS.join(', ')}`,
      );
    }

    const subcontractor = await this.prisma.subcontractor.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!subcontractor) {
      throw new NotFoundException('Subcontractor not found');
    }

    const encryptedColumn = ENCRYPTED_FIELD_MAP[field as RevealField];
    const encryptedValue = subcontractor[encryptedColumn];

    if (!encryptedValue) {
      throw new NotFoundException(
        `Field '${field}' has no value for this subcontractor`,
      );
    }

    const decrypted = this.encryptionService.decrypt(
      encryptedValue as string,
    );

    await this.auditLoggerService.log({
      tenant_id: tenantId,
      actor_user_id: userId,
      actor_type: 'user',
      entity_type: 'subcontractor',
      entity_id: id,
      action_type: 'accessed',
      description: `Revealed ${field} for subcontractor ${id}`,
      metadata_json: {
        field_revealed: field,
        timestamp: new Date().toISOString(),
      },
      status: 'success',
    });

    return { field, value: decrypted };
  }

  // ---------------------------------------------------------------------------
  // 7. addContact(tenantId, subcontractorId, dto)
  // ---------------------------------------------------------------------------

  async addContact(
    tenantId: string,
    subcontractorId: string,
    dto: CreateSubcontractorContactDto,
  ) {
    // Verify subcontractor exists and belongs to tenant
    const subcontractor = await this.prisma.subcontractor.findFirst({
      where: { id: subcontractorId, tenant_id: tenantId },
    });

    if (!subcontractor) {
      throw new NotFoundException('Subcontractor not found');
    }

    // If is_primary = true, reset all other contacts for this subcontractor
    if (dto.is_primary) {
      await this.prisma.subcontractor_contact.updateMany({
        where: {
          tenant_id: tenantId,
          subcontractor_id: subcontractorId,
          is_primary: true,
        },
        data: { is_primary: false },
      });
    }

    const contact = await this.prisma.subcontractor_contact.create({
      data: {
        tenant_id: tenantId,
        subcontractor_id: subcontractorId,
        contact_name: dto.contact_name,
        phone: dto.phone,
        role: dto.role ?? null,
        email: dto.email ?? null,
        is_primary: dto.is_primary ?? false,
      },
    });

    return contact;
  }

  // ---------------------------------------------------------------------------
  // 8. listContacts(tenantId, subcontractorId)
  // ---------------------------------------------------------------------------

  async listContacts(tenantId: string, subcontractorId: string) {
    // Verify subcontractor exists and belongs to tenant
    const subcontractor = await this.prisma.subcontractor.findFirst({
      where: { id: subcontractorId, tenant_id: tenantId },
    });

    if (!subcontractor) {
      throw new NotFoundException('Subcontractor not found');
    }

    return this.prisma.subcontractor_contact.findMany({
      where: {
        tenant_id: tenantId,
        subcontractor_id: subcontractorId,
      },
      orderBy: { created_at: 'asc' },
    });
  }

  // ---------------------------------------------------------------------------
  // 9. removeContact(tenantId, subcontractorId, contactId)
  // ---------------------------------------------------------------------------

  async removeContact(
    tenantId: string,
    subcontractorId: string,
    contactId: string,
  ) {
    const contact = await this.prisma.subcontractor_contact.findFirst({
      where: {
        id: contactId,
        tenant_id: tenantId,
        subcontractor_id: subcontractorId,
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    await this.prisma.subcontractor_contact.delete({
      where: { id: contactId },
    });
  }

  // ---------------------------------------------------------------------------
  // 10. uploadDocument(tenantId, subcontractorId, userId, file, dto)
  // ---------------------------------------------------------------------------

  async uploadDocument(
    tenantId: string,
    subcontractorId: string,
    userId: string,
    file: Express.Multer.File,
    dto: UploadSubcontractorDocumentDto,
  ) {
    // Verify subcontractor exists and belongs to tenant
    const subcontractor = await this.prisma.subcontractor.findFirst({
      where: { id: subcontractorId, tenant_id: tenantId },
    });

    if (!subcontractor) {
      throw new NotFoundException('Subcontractor not found');
    }

    const fileCategory = DOC_TYPE_TO_FILE_CATEGORY[dto.document_type];

    const result = await this.filesService.uploadFile(tenantId, userId, file, {
      category: fileCategory,
      entity_type: 'subcontractor',
      entity_id: subcontractorId,
    });

    const document = await this.prisma.subcontractor_document.create({
      data: {
        tenant_id: tenantId,
        subcontractor_id: subcontractorId,
        file_id: result.file.file_id,
        file_url: result.url,
        file_name: result.file.original_filename,
        document_type: dto.document_type,
        description: dto.description ?? null,
        uploaded_by_user_id: userId,
      },
    });

    return document;
  }

  // ---------------------------------------------------------------------------
  // 11. listDocuments(tenantId, subcontractorId)
  // ---------------------------------------------------------------------------

  async listDocuments(tenantId: string, subcontractorId: string) {
    // Verify subcontractor exists and belongs to tenant
    const subcontractor = await this.prisma.subcontractor.findFirst({
      where: { id: subcontractorId, tenant_id: tenantId },
    });

    if (!subcontractor) {
      throw new NotFoundException('Subcontractor not found');
    }

    return this.prisma.subcontractor_document.findMany({
      where: {
        tenant_id: tenantId,
        subcontractor_id: subcontractorId,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------
  // 12. removeDocument(tenantId, subcontractorId, documentId, userId)
  // ---------------------------------------------------------------------------

  async removeDocument(
    tenantId: string,
    subcontractorId: string,
    documentId: string,
    userId: string,
  ) {
    const document = await this.prisma.subcontractor_document.findFirst({
      where: {
        id: documentId,
        tenant_id: tenantId,
        subcontractor_id: subcontractorId,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Delete the document record first (FK constraint: onDelete Restrict on file)
    await this.prisma.subcontractor_document.delete({
      where: { id: documentId },
    });

    // Delete the file from storage
    await this.filesService.delete(tenantId, document.file_id, userId);

    await this.auditLoggerService.logTenantChange({
      action: 'deleted',
      entityType: 'subcontractor_document',
      entityId: documentId,
      tenantId,
      actorUserId: userId,
      before: {
        id: document.id,
        file_name: document.file_name,
        document_type: document.document_type,
        subcontractor_id: subcontractorId,
      },
      description: `Deleted document "${document.file_name}" from subcontractor ${subcontractorId}`,
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Compute compliance status from insurance_expiry_date.
   * Applied on every read to ensure freshness.
   */
  computeComplianceStatus(
    insuranceExpiryDate: Date | null,
  ): 'unknown' | 'expired' | 'expiring_soon' | 'valid' {
    if (!insuranceExpiryDate) return 'unknown';

    // Use UTC to avoid timezone-related date shifts.
    // Prisma @db.Date returns midnight UTC — setUTCHours keeps it stable.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const expiry = new Date(insuranceExpiryDate);
    expiry.setUTCHours(0, 0, 0, 0);

    if (expiry < today) return 'expired';

    const thirtyDaysOut = new Date(today);
    thirtyDaysOut.setUTCDate(thirtyDaysOut.getUTCDate() + 30);

    if (expiry <= thirtyDaysOut) return 'expiring_soon';

    return 'valid';
  }

  private encryptBankFields(
    dto: Partial<CreateSubcontractorDto>,
  ): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};

    if (dto.bank_routing_number !== undefined) {
      result.bank_routing_encrypted = dto.bank_routing_number
        ? this.encryptionService.encrypt(dto.bank_routing_number)
        : undefined;
    }
    if (dto.bank_account_number !== undefined) {
      result.bank_account_encrypted = dto.bank_account_number
        ? this.encryptionService.encrypt(dto.bank_account_number)
        : undefined;
    }

    return result;
  }

  private maskResponse(subcontractor: any): any {
    const response: any = {
      id: subcontractor.id,
      tenant_id: subcontractor.tenant_id,
      business_name: subcontractor.business_name,
      trade_specialty: subcontractor.trade_specialty,
      email: subcontractor.email,
      website: subcontractor.website,
      insurance_provider: subcontractor.insurance_provider,
      insurance_policy_number: subcontractor.insurance_policy_number,
      insurance_expiry_date: subcontractor.insurance_expiry_date
        ? subcontractor.insurance_expiry_date.toISOString().split('T')[0]
        : null,
      coi_on_file: subcontractor.coi_on_file,
    };

    // Recompute compliance_status on every read
    response.compliance_status = this.computeComplianceStatus(
      subcontractor.insurance_expiry_date,
    );

    response.default_payment_method = subcontractor.default_payment_method;
    response.bank_name = subcontractor.bank_name;

    // Mask bank routing
    if (subcontractor.bank_routing_encrypted) {
      const decrypted = this.encryptionService.decrypt(
        subcontractor.bank_routing_encrypted,
      );
      const last4 = decrypted.slice(-4);
      response.bank_routing_masked = `****${last4}`;
      response.has_bank_routing = true;
    } else {
      response.bank_routing_masked = null;
      response.has_bank_routing = false;
    }

    // Mask bank account
    if (subcontractor.bank_account_encrypted) {
      const decrypted = this.encryptionService.decrypt(
        subcontractor.bank_account_encrypted,
      );
      const last4 = decrypted.slice(-4);
      response.bank_account_masked = `****${last4}`;
      response.has_bank_account = true;
    } else {
      response.bank_account_masked = null;
      response.has_bank_account = false;
    }

    response.venmo_handle = subcontractor.venmo_handle;
    response.zelle_contact = subcontractor.zelle_contact;
    response.notes = subcontractor.notes;
    response.is_active = subcontractor.is_active;

    // Include contacts if loaded
    if (subcontractor.contacts) {
      response.contacts = subcontractor.contacts.map((c: any) => ({
        id: c.id,
        contact_name: c.contact_name,
        phone: c.phone,
        role: c.role,
        email: c.email,
        is_primary: c.is_primary,
        created_at: c.created_at,
      }));
    }

    // Include documents if loaded
    if (subcontractor.documents) {
      response.documents = subcontractor.documents.map((d: any) => ({
        id: d.id,
        file_url: d.file_url,
        file_name: d.file_name,
        document_type: d.document_type,
        description: d.description,
        created_at: d.created_at,
      }));
    }

    response.created_at = subcontractor.created_at;
    response.updated_at = subcontractor.updated_at;

    return response;
  }
}
