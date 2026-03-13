import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CrewMemberService } from './crew-member.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { FilesService } from '../../files/files.service';
import { CreateCrewMemberDto } from '../dto/create-crew-member.dto';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';

const mockCrewMemberRecord = (overrides: any = {}) => ({
  id: 'crew-uuid-001',
  tenant_id: TENANT_ID,
  user_id: null,
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  phone: '9781234567',
  address_line1: '123 Main St',
  address_line2: null,
  address_city: 'Boston',
  address_state: 'MA',
  address_zip: '02101',
  date_of_birth: new Date('1990-01-15'),
  ssn_encrypted: 'encrypted_ssn',
  itin_encrypted: null,
  has_drivers_license: true,
  drivers_license_number_encrypted: 'encrypted_dl',
  default_hourly_rate: 25.0,
  weekly_hours_schedule: 40,
  overtime_enabled: true,
  overtime_rate_multiplier: 1.5,
  default_payment_method: 'bank_transfer',
  bank_name: 'Bank of America',
  bank_routing_encrypted: 'encrypted_routing',
  bank_account_encrypted: 'encrypted_account',
  venmo_handle: '@johndoe',
  zelle_contact: 'john@email.com',
  profile_photo_file_id: null,
  profile_photo: null,
  notes: 'Experienced framer',
  is_active: true,
  created_by_user_id: USER_ID,
  created_at: new Date('2026-01-15T10:30:00.000Z'),
  updated_at: new Date('2026-01-15T10:30:00.000Z'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockPrismaService = {
  crew_member: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
};

const mockEncryptionService = {
  encrypt: jest.fn((text: string) => `encrypted:${text}`),
  decrypt: jest.fn((text: string) => {
    // Return realistic values so masking logic can extract last 4
    const map: Record<string, string> = {
      encrypted_ssn: '123-45-6789',
      encrypted_dl: 'S12345678',
      encrypted_routing: '021000021',
      encrypted_account: '123456789012',
      'encrypted:123-45-6789': '123-45-6789',
      'encrypted:S12345678': 'S12345678',
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

describe('CrewMemberService', () => {
  let service: CrewMemberService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrewMemberService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
        { provide: FilesService, useValue: mockFilesService },
      ],
    }).compile();

    service = module.get<CrewMemberService>(CrewMemberService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // create()
  // -----------------------------------------------------------------------

  describe('create()', () => {
    const dto: CreateCrewMemberDto = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      ssn: '123-45-6789',
      bank_routing_number: '021000021',
      bank_account_number: '123456789012',
      drivers_license_number: 'S12345678',
    };

    it('should encrypt sensitive fields, call prisma.create, and return masked response', async () => {
      const record = mockCrewMemberRecord({
        ssn_encrypted: 'encrypted:123-45-6789',
        drivers_license_number_encrypted: 'encrypted:S12345678',
        bank_routing_encrypted: 'encrypted:021000021',
        bank_account_encrypted: 'encrypted:123456789012',
      });
      mockPrismaService.crew_member.create.mockResolvedValue(record);

      const result = await service.create(TENANT_ID, USER_ID, dto);

      // Verify encryption was called for sensitive fields
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('123-45-6789');
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('021000021');
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(
        '123456789012',
      );
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('S12345678');

      // Verify prisma was called with tenant_id
      expect(mockPrismaService.crew_member.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            created_by_user_id: USER_ID,
            first_name: 'John',
            last_name: 'Doe',
          }),
        }),
      );

      // Verify response is masked (no raw encrypted values)
      expect(result.ssn_masked).toBe('***-**-6789');
      expect(result.has_ssn).toBe(true);
      expect(result.bank_routing_masked).toBe('****0021');
      expect(result.has_bank_routing).toBe(true);
      expect(result).not.toHaveProperty('ssn_encrypted');
      expect(result).not.toHaveProperty('bank_routing_encrypted');
    });

    it('should call auditLoggerService.logTenantChange with action created', async () => {
      mockPrismaService.crew_member.create.mockResolvedValue(
        mockCrewMemberRecord(),
      );

      await service.create(TENANT_ID, USER_ID, dto);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'crew_member',
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          description: expect.stringContaining('Created crew member'),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // findAll()
  // -----------------------------------------------------------------------

  describe('findAll()', () => {
    it('should include tenant_id in query and return paginated response', async () => {
      const records = [mockCrewMemberRecord(), mockCrewMemberRecord({ id: 'crew-uuid-002' })];
      mockPrismaService.crew_member.findMany.mockResolvedValue(records);
      mockPrismaService.crew_member.count.mockResolvedValue(2);

      const result = await service.findAll(TENANT_ID, { page: 1, limit: 20 });

      // Verify tenant_id filter
      expect(mockPrismaService.crew_member.findMany).toHaveBeenCalledWith(
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

    it('should apply search filter across first_name, last_name, email, phone', async () => {
      mockPrismaService.crew_member.findMany.mockResolvedValue([]);
      mockPrismaService.crew_member.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, { search: 'John' });

      expect(mockPrismaService.crew_member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            OR: [
              { first_name: { contains: 'John' } },
              { last_name: { contains: 'John' } },
              { email: { contains: 'John' } },
              { phone: { contains: 'John' } },
            ],
          }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // findOne()
  // -----------------------------------------------------------------------

  describe('findOne()', () => {
    it('should return masked response with has_ssn, ssn_masked etc.', async () => {
      mockPrismaService.crew_member.findFirst.mockResolvedValue(
        mockCrewMemberRecord(),
      );

      const result = await service.findOne(TENANT_ID, 'crew-uuid-001');

      expect(result.ssn_masked).toBe('***-**-6789');
      expect(result.has_ssn).toBe(true);
      expect(result.itin_masked).toBeNull();
      expect(result.has_itin).toBe(false);
      expect(result.drivers_license_masked).toBe('****5678');
      expect(result.has_drivers_license_number).toBe(true);
      expect(result.bank_routing_masked).toBe('****0021');
      expect(result.has_bank_routing).toBe(true);
      expect(result.bank_account_masked).toBe('****9012');
      expect(result.has_bank_account).toBe(true);
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrismaService.crew_member.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(TENANT_ID, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when tenant_id does not match', async () => {
      // Simulate: record exists for different tenant, findFirst returns null
      // because tenant_id filter is in the query
      mockPrismaService.crew_member.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('other-tenant-id', 'crew-uuid-001'),
      ).rejects.toThrow(NotFoundException);

      // Verify the query included the tenant_id filter
      expect(mockPrismaService.crew_member.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'crew-uuid-001',
            tenant_id: 'other-tenant-id',
          }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // update()
  // -----------------------------------------------------------------------

  describe('update()', () => {
    it('should encrypt new sensitive fields and call audit log', async () => {
      mockPrismaService.crew_member.findFirst.mockResolvedValue(
        mockCrewMemberRecord(),
      );
      const updatedRecord = mockCrewMemberRecord({
        ssn_encrypted: 'encrypted:999-88-7777',
      });
      mockPrismaService.crew_member.update.mockResolvedValue(updatedRecord);

      await service.update(TENANT_ID, 'crew-uuid-001', USER_ID, {
        ssn: '999-88-7777',
        first_name: 'Jane',
      });

      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(
        '999-88-7777',
      );
      expect(mockPrismaService.crew_member.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            first_name: 'Jane',
            ssn_encrypted: 'encrypted:999-88-7777',
          }),
        }),
      );
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'crew_member',
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // softDelete()
  // -----------------------------------------------------------------------

  describe('softDelete()', () => {
    it('should set is_active = false and call audit log', async () => {
      mockPrismaService.crew_member.findFirst.mockResolvedValue(
        mockCrewMemberRecord(),
      );
      mockPrismaService.crew_member.update.mockResolvedValue(
        mockCrewMemberRecord({ is_active: false }),
      );

      await service.softDelete(TENANT_ID, 'crew-uuid-001', USER_ID);

      expect(mockPrismaService.crew_member.update).toHaveBeenCalledWith({
        where: { id: 'crew-uuid-001' },
        data: { is_active: false },
      });
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'crew_member',
          entityId: 'crew-uuid-001',
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // revealField()
  // -----------------------------------------------------------------------

  describe('revealField()', () => {
    it('should decrypt field, return raw value, and call audit log with action accessed', async () => {
      mockPrismaService.crew_member.findFirst.mockResolvedValue(
        mockCrewMemberRecord(),
      );

      const result = await service.revealField(
        TENANT_ID,
        'crew-uuid-001',
        USER_ID,
        'ssn',
      );

      expect(result).toEqual({ field: 'ssn', value: '123-45-6789' });
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith(
        'encrypted_ssn',
      );
      expect(mockAuditLoggerService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: 'accessed',
          entity_type: 'crew_member',
          entity_id: 'crew-uuid-001',
          metadata_json: expect.objectContaining({
            field_revealed: 'ssn',
          }),
        }),
      );
    });

    it('should throw BadRequestException for disallowed field name', async () => {
      await expect(
        service.revealField(TENANT_ID, 'crew-uuid-001', USER_ID, 'email'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when field value is null', async () => {
      mockPrismaService.crew_member.findFirst.mockResolvedValue(
        mockCrewMemberRecord({ itin_encrypted: null }),
      );

      await expect(
        service.revealField(TENANT_ID, 'crew-uuid-001', USER_ID, 'itin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // uploadProfilePhoto()
  // -----------------------------------------------------------------------

  describe('uploadProfilePhoto()', () => {
    it('should call FilesService.uploadFile and update profile_photo_file_id', async () => {
      mockPrismaService.crew_member.findFirst.mockResolvedValue(
        mockCrewMemberRecord(),
      );
      mockFilesService.uploadFile.mockResolvedValue({
        file_id: 'photo-file-uuid',
        url: '/public/tenant-001/images/photo.webp',
        file: {
          file_id: 'photo-file-uuid',
          original_filename: 'photo.jpg',
          mime_type: 'image/jpeg',
          size_bytes: 102400,
          url: '/public/tenant-001/images/photo.webp',
        },
      });
      mockPrismaService.crew_member.update.mockResolvedValue(
        mockCrewMemberRecord({
          profile_photo_file_id: 'photo-file-uuid',
          profile_photo: {
            storage_path: '/public/tenant-001/images/photo.webp',
          },
        }),
      );

      const mockFile = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake'),
        size: 102400,
      } as Express.Multer.File;

      const result = await service.uploadProfilePhoto(
        TENANT_ID,
        'crew-uuid-001',
        USER_ID,
        mockFile,
      );

      expect(mockFilesService.uploadFile).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        mockFile,
        expect.objectContaining({
          category: 'photo',
          entity_type: 'crew_member',
          entity_id: 'crew-uuid-001',
        }),
      );
      expect(mockPrismaService.crew_member.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { profile_photo_file_id: 'photo-file-uuid' },
        }),
      );
      expect(result.profile_photo_url).toBe(
        '/public/tenant-001/images/photo.webp',
      );
    });
  });
});
