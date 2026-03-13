import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubcontractorService } from './subcontractor.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { FilesService } from '../../files/files.service';
import { CreateSubcontractorDto } from '../dto/create-subcontractor.dto';
import { CreateSubcontractorContactDto } from '../dto/create-subcontractor-contact.dto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const SUB_ID = 'sub-uuid-001';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockSubcontractorRecord = (overrides: any = {}) => ({
  id: SUB_ID,
  tenant_id: TENANT_ID,
  business_name: 'ABC Electrical',
  trade_specialty: 'Electrical',
  email: 'info@abc.com',
  website: 'https://abc-electrical.com',
  insurance_provider: 'State Farm',
  insurance_policy_number: 'POL-12345',
  insurance_expiry_date: new Date('2027-06-15'),
  coi_on_file: true,
  compliance_status: 'valid',
  default_payment_method: 'check',
  bank_name: 'Chase',
  bank_routing_encrypted: 'encrypted_routing',
  bank_account_encrypted: 'encrypted_account',
  venmo_handle: null,
  zelle_contact: null,
  notes: 'Reliable electrician',
  is_active: true,
  created_by_user_id: USER_ID,
  created_at: new Date('2026-01-15T10:30:00.000Z'),
  updated_at: new Date('2026-01-15T10:30:00.000Z'),
  contacts: [],
  documents: [],
  ...overrides,
});

const mockContactRecord = (overrides: any = {}) => ({
  id: 'contact-uuid-001',
  tenant_id: TENANT_ID,
  subcontractor_id: SUB_ID,
  contact_name: 'Mike Johnson',
  phone: '555-0101',
  role: 'Owner',
  email: 'mike@abc.com',
  is_primary: true,
  created_at: new Date('2026-01-15T10:30:00.000Z'),
  ...overrides,
});

const mockDocumentRecord = (overrides: any = {}) => ({
  id: 'doc-uuid-001',
  tenant_id: TENANT_ID,
  subcontractor_id: SUB_ID,
  file_id: 'file-uuid-001',
  file_url: '/public/tenant-001/files/file-uuid-001.pdf',
  file_name: 'coi.pdf',
  document_type: 'coi',
  description: 'COI 2026',
  uploaded_by_user_id: USER_ID,
  created_at: new Date('2026-01-15T10:30:00.000Z'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockPrismaService = {
  subcontractor: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  subcontractor_contact: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  subcontractor_document: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
};

const mockEncryptionService = {
  encrypt: jest.fn((text: string) => `encrypted:${text}`),
  decrypt: jest.fn((text: string) => {
    const map: Record<string, string> = {
      encrypted_routing: '021000021',
      encrypted_account: '123456789012',
      'encrypted:021000021': '021000021',
      'encrypted:123456789012': '123456789012',
    };
    return map[text] || 'decrypted_value';
  }),
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn(),
  log: jest.fn(),
};

const mockFilesService = {
  uploadFile: jest.fn(),
  delete: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SubcontractorService', () => {
  let service: SubcontractorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubcontractorService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
        { provide: FilesService, useValue: mockFilesService },
      ],
    }).compile();

    service = module.get<SubcontractorService>(SubcontractorService);

    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. create() — encrypts bank fields, returns response with compliance
  // -----------------------------------------------------------------------

  describe('create()', () => {
    const dto: CreateSubcontractorDto = {
      business_name: 'ABC Electrical',
      trade_specialty: 'Electrical',
      email: 'info@abc.com',
      insurance_expiry_date: '2027-06-15',
      coi_on_file: true,
      bank_routing_number: '021000021',
      bank_account_number: '123456789012',
    };

    it('should encrypt bank fields, compute compliance, and return masked response', async () => {
      const record = mockSubcontractorRecord({
        bank_routing_encrypted: 'encrypted:021000021',
        bank_account_encrypted: 'encrypted:123456789012',
      });
      mockPrismaService.subcontractor.create.mockResolvedValue(record);

      const result = await service.create(TENANT_ID, USER_ID, dto);

      // Verify encryption was called
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('021000021');
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(
        '123456789012',
      );

      // Verify prisma was called with tenant_id and encrypted data
      expect(mockPrismaService.subcontractor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            created_by_user_id: USER_ID,
            business_name: 'ABC Electrical',
            bank_routing_encrypted: 'encrypted:021000021',
            bank_account_encrypted: 'encrypted:123456789012',
          }),
        }),
      );

      // Verify response is masked
      expect(result.bank_routing_masked).toBe('****0021');
      expect(result.has_bank_routing).toBe(true);
      expect(result.bank_account_masked).toBe('****9012');
      expect(result.has_bank_account).toBe(true);
      expect(result.compliance_status).toBe('valid');
      expect(result).not.toHaveProperty('bank_routing_encrypted');
      expect(result).not.toHaveProperty('bank_account_encrypted');
    });

    it('should call auditLoggerService.logTenantChange with action created', async () => {
      mockPrismaService.subcontractor.create.mockResolvedValue(
        mockSubcontractorRecord(),
      );

      await service.create(TENANT_ID, USER_ID, dto);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'subcontractor',
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          description: expect.stringContaining('Created subcontractor'),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // 2. findAll() — tenant filter, pagination, recomputed compliance
  // -----------------------------------------------------------------------

  describe('findAll()', () => {
    it('should include tenant_id in query and return paginated response', async () => {
      const records = [
        mockSubcontractorRecord(),
        mockSubcontractorRecord({ id: 'sub-uuid-002' }),
      ];
      mockPrismaService.subcontractor.findMany.mockResolvedValue(records);
      mockPrismaService.subcontractor.count.mockResolvedValue(2);

      const result = await service.findAll(TENANT_ID, {
        page: 1,
        limit: 20,
      });

      expect(mockPrismaService.subcontractor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    // -----------------------------------------------------------------------
    // 3. findAll() — filters by compliance_status
    // -----------------------------------------------------------------------

    it('should filter by compliance_status', async () => {
      mockPrismaService.subcontractor.findMany.mockResolvedValue([]);
      mockPrismaService.subcontractor.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, { compliance_status: 'expired' });

      expect(mockPrismaService.subcontractor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            compliance_status: 'expired',
          }),
        }),
      );
    });

    it('should apply search filter across business_name, trade_specialty, email', async () => {
      mockPrismaService.subcontractor.findMany.mockResolvedValue([]);
      mockPrismaService.subcontractor.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, { search: 'ABC' });

      expect(mockPrismaService.subcontractor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            OR: [
              { business_name: { contains: 'ABC' } },
              { trade_specialty: { contains: 'ABC' } },
              { email: { contains: 'ABC' } },
            ],
          }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // 4. findOne() — includes contacts, documents, recomputes compliance
  // -----------------------------------------------------------------------

  describe('findOne()', () => {
    it('should return response with contacts, documents, and recomputed compliance', async () => {
      const record = mockSubcontractorRecord({
        contacts: [mockContactRecord()],
        documents: [mockDocumentRecord()],
      });
      mockPrismaService.subcontractor.findFirst.mockResolvedValue(record);

      const result = await service.findOne(TENANT_ID, SUB_ID);

      expect(result.id).toBe(SUB_ID);
      expect(result.compliance_status).toBe('valid');
      expect(result.bank_routing_masked).toBe('****0021');
      expect(result.contacts).toHaveLength(1);
      expect(result.contacts[0].contact_name).toBe('Mike Johnson');
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].file_name).toBe('coi.pdf');
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(TENANT_ID, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when tenant_id does not match', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('other-tenant-id', SUB_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.subcontractor.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: SUB_ID,
            tenant_id: 'other-tenant-id',
          }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // 5. update() — encrypts new bank fields, audit logs
  // -----------------------------------------------------------------------

  describe('update()', () => {
    it('should encrypt new bank fields and call audit log', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue(
        mockSubcontractorRecord(),
      );
      const updatedRecord = mockSubcontractorRecord({
        bank_routing_encrypted: 'encrypted:999888777',
        business_name: 'Updated Electrical',
        contacts: [],
        documents: [],
      });
      mockPrismaService.subcontractor.update.mockResolvedValue(updatedRecord);

      await service.update(TENANT_ID, SUB_ID, USER_ID, {
        bank_routing_number: '999888777',
        business_name: 'Updated Electrical',
      });

      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('999888777');
      expect(mockPrismaService.subcontractor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            business_name: 'Updated Electrical',
            bank_routing_encrypted: 'encrypted:999888777',
          }),
        }),
      );
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'subcontractor',
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // 6. softDelete() — sets is_active = false
  // -----------------------------------------------------------------------

  describe('softDelete()', () => {
    it('should set is_active = false and call audit log', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue(
        mockSubcontractorRecord(),
      );
      mockPrismaService.subcontractor.update.mockResolvedValue(
        mockSubcontractorRecord({ is_active: false }),
      );

      await service.softDelete(TENANT_ID, SUB_ID, USER_ID);

      expect(mockPrismaService.subcontractor.update).toHaveBeenCalledWith({
        where: { id: SUB_ID },
        data: { is_active: false },
      });
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'subcontractor',
          entityId: SUB_ID,
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // 7. revealField() — decrypts bank_routing, audit log with 'accessed'
  // -----------------------------------------------------------------------

  describe('revealField()', () => {
    it('should decrypt bank_routing and create audit log with action accessed', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue(
        mockSubcontractorRecord(),
      );

      const result = await service.revealField(
        TENANT_ID,
        SUB_ID,
        USER_ID,
        'bank_routing',
      );

      expect(result).toEqual({ field: 'bank_routing', value: '021000021' });
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith(
        'encrypted_routing',
      );
      expect(mockAuditLoggerService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: 'accessed',
          entity_type: 'subcontractor',
          entity_id: SUB_ID,
          metadata_json: expect.objectContaining({
            field_revealed: 'bank_routing',
          }),
        }),
      );
    });

    // -----------------------------------------------------------------------
    // 8. revealField() — throws for disallowed field
    // -----------------------------------------------------------------------

    it('should throw BadRequestException for disallowed field name', async () => {
      await expect(
        service.revealField(TENANT_ID, SUB_ID, USER_ID, 'email'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when field value is null', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue(
        mockSubcontractorRecord({ bank_routing_encrypted: null }),
      );

      await expect(
        service.revealField(TENANT_ID, SUB_ID, USER_ID, 'bank_routing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // 9. addContact() — creates contact, sets is_primary correctly
  // -----------------------------------------------------------------------

  describe('addContact()', () => {
    const contactDto: CreateSubcontractorContactDto = {
      contact_name: 'Mike Johnson',
      phone: '555-0101',
      role: 'Owner',
      is_primary: true,
    };

    it('should create contact and reset other primaries when is_primary = true', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue(
        mockSubcontractorRecord(),
      );
      mockPrismaService.subcontractor_contact.updateMany.mockResolvedValue({
        count: 0,
      });
      mockPrismaService.subcontractor_contact.create.mockResolvedValue(
        mockContactRecord(),
      );

      const result = await service.addContact(TENANT_ID, SUB_ID, contactDto);

      // Should reset other primaries first
      expect(
        mockPrismaService.subcontractor_contact.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_ID,
          subcontractor_id: SUB_ID,
          is_primary: true,
        },
        data: { is_primary: false },
      });

      expect(
        mockPrismaService.subcontractor_contact.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            subcontractor_id: SUB_ID,
            contact_name: 'Mike Johnson',
            is_primary: true,
          }),
        }),
      );

      expect(result.contact_name).toBe('Mike Johnson');
    });

    it('should not reset primaries when is_primary = false', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue(
        mockSubcontractorRecord(),
      );
      mockPrismaService.subcontractor_contact.create.mockResolvedValue(
        mockContactRecord({ is_primary: false }),
      );

      await service.addContact(TENANT_ID, SUB_ID, {
        contact_name: 'Jane',
        phone: '555-0102',
        is_primary: false,
      });

      expect(
        mockPrismaService.subcontractor_contact.updateMany,
      ).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 10. removeContact() — deletes contact with tenant validation
  // -----------------------------------------------------------------------

  describe('removeContact()', () => {
    it('should delete contact', async () => {
      mockPrismaService.subcontractor_contact.findFirst.mockResolvedValue(
        mockContactRecord(),
      );
      mockPrismaService.subcontractor_contact.delete.mockResolvedValue(
        mockContactRecord(),
      );

      await service.removeContact(TENANT_ID, SUB_ID, 'contact-uuid-001');

      expect(
        mockPrismaService.subcontractor_contact.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          id: 'contact-uuid-001',
          tenant_id: TENANT_ID,
          subcontractor_id: SUB_ID,
        },
      });
      expect(
        mockPrismaService.subcontractor_contact.delete,
      ).toHaveBeenCalledWith({
        where: { id: 'contact-uuid-001' },
      });
    });

    it('should throw NotFoundException when contact does not exist', async () => {
      mockPrismaService.subcontractor_contact.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.removeContact(TENANT_ID, SUB_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // 11. uploadDocument() — calls FilesService.uploadFile, creates record
  // -----------------------------------------------------------------------

  describe('uploadDocument()', () => {
    it('should call FilesService.uploadFile and create document record', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue(
        mockSubcontractorRecord(),
      );
      mockFilesService.uploadFile.mockResolvedValue({
        message: 'File uploaded successfully',
        file_id: 'file-uuid-001',
        url: '/public/tenant-001/files/file-uuid-001.pdf',
        file: {
          file_id: 'file-uuid-001',
          original_filename: 'coi.pdf',
          mime_type: 'application/pdf',
          size_bytes: 204800,
        },
      });
      mockPrismaService.subcontractor_document.create.mockResolvedValue(
        mockDocumentRecord(),
      );

      const mockFile = {
        originalname: 'coi.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('fake-pdf'),
        size: 204800,
      } as Express.Multer.File;

      const result = await service.uploadDocument(
        TENANT_ID,
        SUB_ID,
        USER_ID,
        mockFile,
        { document_type: 'coi' as any },
      );

      expect(mockFilesService.uploadFile).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        mockFile,
        expect.objectContaining({
          category: 'insurance', // coi maps to insurance
          entity_type: 'subcontractor',
          entity_id: SUB_ID,
        }),
      );

      expect(
        mockPrismaService.subcontractor_document.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            subcontractor_id: SUB_ID,
            file_id: 'file-uuid-001',
            file_url: '/public/tenant-001/files/file-uuid-001.pdf',
            file_name: 'coi.pdf',
            document_type: 'coi',
          }),
        }),
      );

      expect(result.file_name).toBe('coi.pdf');
    });
  });

  // -----------------------------------------------------------------------
  // 12. removeDocument() — deletes document record
  // -----------------------------------------------------------------------

  describe('removeDocument()', () => {
    it('should delete document record and file, then audit log', async () => {
      mockPrismaService.subcontractor_document.findFirst.mockResolvedValue(
        mockDocumentRecord(),
      );
      mockPrismaService.subcontractor_document.delete.mockResolvedValue(
        mockDocumentRecord(),
      );
      mockFilesService.delete.mockResolvedValue({ message: 'File deleted' });

      await service.removeDocument(TENANT_ID, SUB_ID, 'doc-uuid-001', USER_ID);

      expect(
        mockPrismaService.subcontractor_document.delete,
      ).toHaveBeenCalledWith({
        where: { id: 'doc-uuid-001' },
      });

      expect(mockFilesService.delete).toHaveBeenCalledWith(
        TENANT_ID,
        'file-uuid-001',
        USER_ID,
      );

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'subcontractor_document',
          entityId: 'doc-uuid-001',
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // 13-16. computeComplianceStatus()
  // -----------------------------------------------------------------------

  describe('computeComplianceStatus()', () => {
    it('should return "unknown" for null date', () => {
      const result = service.computeComplianceStatus(null);
      expect(result).toBe('unknown');
    });

    it('should return "expired" for past date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const result = service.computeComplianceStatus(pastDate);
      expect(result).toBe('expired');
    });

    it('should return "expiring_soon" for date within 30 days', () => {
      const soonDate = new Date();
      soonDate.setDate(soonDate.getDate() + 15);
      const result = service.computeComplianceStatus(soonDate);
      expect(result).toBe('expiring_soon');
    });

    it('should return "valid" for date more than 30 days out', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);
      const result = service.computeComplianceStatus(futureDate);
      expect(result).toBe('valid');
    });

    it('should return "expiring_soon" for date exactly 30 days out', () => {
      const exactly30 = new Date();
      exactly30.setUTCHours(0, 0, 0, 0);
      exactly30.setUTCDate(exactly30.getUTCDate() + 30);
      const result = service.computeComplianceStatus(exactly30);
      expect(result).toBe('expiring_soon');
    });

    it('should return "expired" for yesterday', () => {
      const yesterday = new Date();
      yesterday.setUTCHours(0, 0, 0, 0);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const result = service.computeComplianceStatus(yesterday);
      expect(result).toBe('expired');
    });
  });
});
