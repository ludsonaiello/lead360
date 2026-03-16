import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  GoneException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { TokenBlocklistService } from '../../../core/token-blocklist/token-blocklist.service';
import { SendEmailService } from '../../communication/services/send-email.service';

// Mock bcrypt to avoid slow hashing in tests
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_value'),
  compare: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-001';
const OTHER_TENANT_ID = 'tenant-uuid-002';
const ACTOR_USER_ID = 'actor-uuid-001';
const USER_ID = 'user-uuid-001';
const MEMBERSHIP_ID = 'membership-uuid-001';
const ROLE_ID = 'role-uuid-001';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockUserRecord = (overrides: any = {}) => ({
  id: USER_ID,
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  phone: '+15551234567',
  password_hash: 'existing_hash',
  is_active: true,
  email_verified: true,
  email_verified_at: new Date(),
  deleted_at: null,
  created_at: new Date('2026-01-15T10:00:00Z'),
  updated_at: new Date('2026-01-15T10:00:00Z'),
  ...overrides,
});

const mockRoleRecord = (overrides: any = {}) => ({
  id: ROLE_ID,
  name: 'Employee',
  ...overrides,
});

const mockMembershipRecord = (overrides: any = {}) => ({
  id: MEMBERSHIP_ID,
  user_id: USER_ID,
  tenant_id: TENANT_ID,
  role_id: ROLE_ID,
  status: 'ACTIVE',
  invite_token_hash: null,
  invite_token_expires_at: null,
  invite_accepted_at: null,
  invited_by_user_id: ACTOR_USER_ID,
  joined_at: new Date('2026-01-15T10:00:00Z'),
  left_at: null,
  created_at: new Date('2026-01-15T10:00:00Z'),
  user: mockUserRecord(),
  role: mockRoleRecord(),
  invited_by: { id: ACTOR_USER_ID, first_name: 'Admin', last_name: 'Actor' },
  tenant: { company_name: 'Acme Corp' },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user_tenant_membership: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
  role: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  audit_log: {
    count: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
};

const mockAuditLogger = {
  logTenantChange: jest.fn().mockResolvedValue(undefined),
};

const mockTokenBlocklist = {
  trackToken: jest.fn().mockResolvedValue(undefined),
  blockUserTokens: jest.fn().mockResolvedValue(undefined),
  isBlocked: jest.fn().mockResolvedValue(false),
};

const mockSendEmailService = {
  sendTemplated: jest.fn().mockResolvedValue(undefined),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('https://app.lead360.app'),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLoggerService, useValue: mockAuditLogger },
        { provide: TokenBlocklistService, useValue: mockTokenBlocklist },
        { provide: SendEmailService, useValue: mockSendEmailService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // inviteUser()
  // -----------------------------------------------------------------------

  describe('inviteUser()', () => {
    const dto = {
      email: 'new@example.com',
      first_name: 'New',
      last_name: 'User',
      role_id: ROLE_ID,
    };

    const mockRole = mockRoleRecord();
    const mockUser = mockUserRecord({ id: 'new-user-id', email: dto.email, first_name: dto.first_name, last_name: dto.last_name });
    const mockTenant = { company_name: 'Acme Corp' };
    const mockInviter = { first_name: 'Admin', last_name: 'Actor' };
    const mockCreatedMembership = { id: 'new-membership-id' };

    it('should create an invite membership for a brand new user', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce(null); // no existing active
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)        // user lookup by email: new user
        .mockResolvedValueOnce(mockInviter); // inviter lookup by ID
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.user_tenant_membership.create.mockResolvedValue(mockCreatedMembership);
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);

      const result = await service.inviteUser(TENANT_ID, ACTOR_USER_ID, dto);

      expect(result.status).toBe('INVITED');
      expect(result.email).toBe(dto.email);
      expect(result.first_name).toBe(dto.first_name);
      expect(result.last_name).toBe(dto.last_name);
      expect(result.role).toEqual({ id: mockRole.id, name: mockRole.name });

      // Verify user was created inside transaction
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: dto.email,
            first_name: dto.first_name,
            last_name: dto.last_name,
            password_hash: '', // set later on invite acceptance
            is_active: false,
          }),
        }),
      );

      // Verify audit log
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'UserMembership',
          tenantId: TENANT_ID,
          actorUserId: ACTOR_USER_ID,
        }),
      );

      // Verify email dispatched via SendEmailService (not JobQueueService)
      expect(mockSendEmailService.sendTemplated).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          to: dto.email,
          template_key: 'user-invite',
        }),
        ACTOR_USER_ID,
      );
    });

    it('should link existing user when email already has a user record (BR-12)', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser)     // existing user found by email
        .mockResolvedValueOnce(mockInviter); // inviter lookup
      mockPrisma.user_tenant_membership.create.mockResolvedValue(mockCreatedMembership);
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);

      await service.inviteUser(TENANT_ID, ACTOR_USER_ID, dto);

      // BR-12: no new user created — existing user record is reused
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.user_tenant_membership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: mockUser.id,
            tenant_id: TENANT_ID,
            role_id: dto.role_id,
            status: 'INVITED',
          }),
        }),
      );
    });

    it('should throw 409 if email already has ACTIVE membership in this tenant', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce({
        id: 'existing-membership',
        status: 'ACTIVE',
      });

      await expect(
        service.inviteUser(TENANT_ID, ACTOR_USER_ID, dto),
      ).rejects.toThrow(ConflictException);

      // No user created, no email sent
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockSendEmailService.sendTemplated).not.toHaveBeenCalled();
    });

    it('should throw 404 if role_id does not exist', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);

      await expect(
        service.inviteUser(TENANT_ID, ACTOR_USER_ID, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include invite_token_hash and expires_at in membership creation', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockInviter);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.user_tenant_membership.create.mockResolvedValue(mockCreatedMembership);
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);

      await service.inviteUser(TENANT_ID, ACTOR_USER_ID, dto);

      expect(mockPrisma.user_tenant_membership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invite_token_hash: expect.any(String),
            invite_token_expires_at: expect.any(Date),
            invited_by_user_id: ACTOR_USER_ID,
          }),
        }),
      );
    });

    it('should include invite link in email template variables', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockInviter);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.user_tenant_membership.create.mockResolvedValue(mockCreatedMembership);
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);

      await service.inviteUser(TENANT_ID, ACTOR_USER_ID, dto);

      expect(mockSendEmailService.sendTemplated).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          variables: expect.objectContaining({
            invite_link: expect.stringContaining('https://app.lead360.app/invite/'),
            tenant_name: 'Acme Corp',
            inviter_name: 'Admin Actor',
            role_name: 'Employee',
          }),
        }),
        ACTOR_USER_ID,
      );
    });
  });

  // -----------------------------------------------------------------------
  // validateInviteToken()
  // -----------------------------------------------------------------------

  describe('validateInviteToken()', () => {
    it('should return token info for a valid, unexpired, unused token', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce({
        id: MEMBERSHIP_ID,
        invite_token_hash: 'sha256-hash-value',
        invite_accepted_at: null,
        invite_token_expires_at: new Date(Date.now() + 3600 * 1000),
        user: { email: 'invited@example.com' },
        tenant: { company_name: 'Acme Corp' },
        role: { name: 'Employee' },
        invited_by: { first_name: 'John', last_name: 'Doe' },
      });

      const result = await service.validateInviteToken('raw-token-here');

      expect(result.tenant_name).toBe('Acme Corp');
      expect(result.role_name).toBe('Employee');
      expect(result.invited_by_name).toBe('John Doe');
      expect(result.email).toBe('invited@example.com');
      expect(result.expires_at).toBeDefined();
    });

    it('should return "Unknown" for invited_by_name when invited_by is null', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce({
        id: MEMBERSHIP_ID,
        invite_token_hash: 'sha256-hash-value',
        invite_accepted_at: null,
        invite_token_expires_at: new Date(Date.now() + 3600 * 1000),
        user: { email: 'invited@example.com' },
        tenant: { company_name: 'Acme Corp' },
        role: { name: 'Employee' },
        invited_by: null,
      });

      const result = await service.validateInviteToken('raw-token');

      expect(result.invited_by_name).toBe('Unknown');
    });

    it('should throw 409 ConflictException for already-used token (BR-05)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce({
        id: MEMBERSHIP_ID,
        invite_token_hash: 'sha256-hash-value',
        invite_accepted_at: new Date(), // already accepted
        invite_token_expires_at: new Date(Date.now() + 3600 * 1000),
        user: { email: 'test@example.com' },
        tenant: { company_name: 'Acme Corp' },
        role: { name: 'Employee' },
        invited_by: null,
      });

      await expect(service.validateInviteToken('used-token')).rejects.toThrow(ConflictException);
    });

    it('should throw 410 GoneException for expired token (BR-05)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce({
        id: MEMBERSHIP_ID,
        invite_token_hash: 'sha256-hash-value',
        invite_accepted_at: null,
        invite_token_expires_at: new Date(Date.now() - 3600 * 1000), // expired 1 hour ago
        user: { email: 'test@example.com' },
        tenant: { company_name: 'Acme Corp' },
        role: { name: 'Employee' },
        invited_by: null,
      });

      await expect(service.validateInviteToken('expired-token')).rejects.toThrow(GoneException);
    });

    it('should throw 404 NotFoundException for invalid token (no matching hash)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce(null);

      await expect(service.validateInviteToken('bad-token')).rejects.toThrow(NotFoundException);
    });

    it('should check accepted-at BEFORE expiry (already-used takes precedence over expired)', async () => {
      // Token is both accepted AND expired — should throw ConflictException (409), not GoneException (410)
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce({
        id: MEMBERSHIP_ID,
        invite_token_hash: 'sha256-hash-value',
        invite_accepted_at: new Date(Date.now() - 7200 * 1000), // accepted 2 hours ago
        invite_token_expires_at: new Date(Date.now() - 3600 * 1000), // expired 1 hour ago
        user: { email: 'test@example.com' },
        tenant: { company_name: 'Acme Corp' },
        role: { name: 'Employee' },
        invited_by: null,
      });

      await expect(service.validateInviteToken('dual-condition-token')).rejects.toThrow(ConflictException);
    });
  });

  // -----------------------------------------------------------------------
  // acceptInvite()
  // -----------------------------------------------------------------------

  describe('acceptInvite()', () => {
    const acceptDto = { password: 'SecureP@ss123' };

    const validMembership = {
      id: MEMBERSHIP_ID,
      user_id: USER_ID,
      tenant_id: TENANT_ID,
      invite_token_hash: 'sha256-hash-value',
      invite_accepted_at: null,
      invite_token_expires_at: new Date(Date.now() + 3600 * 1000),
      user: mockUserRecord({ is_active: false }),
      role: mockRoleRecord(),
      tenant: { company_name: 'Acme Corp' },
    };

    it('should accept a valid invite and return membership data', async () => {
      mockPrisma.user_tenant_membership.findFirst
        .mockResolvedValueOnce(validMembership)  // token lookup
        .mockResolvedValueOnce(null);             // no other active membership (BR-02)
      mockPrisma.user_tenant_membership.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.acceptInvite('raw-token', acceptDto);

      expect(result.membership_id).toBe(MEMBERSHIP_ID);
      expect(result.user_id).toBe(USER_ID);
      expect(result.tenant_id).toBe(TENANT_ID);
      expect(result.role_name).toBe('Employee');
      expect(result.user_email).toBe(validMembership.user.email);
    });

    it('should set invite_accepted_at, ACTIVE status, and clear token hash', async () => {
      mockPrisma.user_tenant_membership.findFirst
        .mockResolvedValueOnce(validMembership)
        .mockResolvedValueOnce(null);
      mockPrisma.user_tenant_membership.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      await service.acceptInvite('raw-token', acceptDto);

      expect(mockPrisma.user_tenant_membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MEMBERSHIP_ID },
          data: expect.objectContaining({
            invite_accepted_at: expect.any(Date),
            status: 'ACTIVE',
            joined_at: expect.any(Date),
            invite_token_hash: null, // consumed
          }),
        }),
      );
    });

    it('should hash the password and activate the user', async () => {
      mockPrisma.user_tenant_membership.findFirst
        .mockResolvedValueOnce(validMembership)
        .mockResolvedValueOnce(null);
      mockPrisma.user_tenant_membership.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      await service.acceptInvite('raw-token', acceptDto);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: USER_ID },
          data: expect.objectContaining({
            password_hash: 'hashed_value', // from mocked bcrypt.hash
            is_active: true,
            email_verified: true,
          }),
        }),
      );
    });

    it('should throw 409 if user already has an ACTIVE membership elsewhere (BR-02)', async () => {
      mockPrisma.user_tenant_membership.findFirst
        .mockResolvedValueOnce(validMembership)
        .mockResolvedValueOnce({ id: 'other-membership', tenant_id: OTHER_TENANT_ID, status: 'ACTIVE' });

      await expect(service.acceptInvite('raw-token', acceptDto)).rejects.toThrow(ConflictException);
    });

    it('should throw 409 if invite has already been used (BR-05)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce({
        ...validMembership,
        invite_accepted_at: new Date(), // already accepted
      });

      await expect(service.acceptInvite('used-token', acceptDto)).rejects.toThrow(ConflictException);
    });

    it('should throw 410 GoneException if invite token is expired', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce({
        ...validMembership,
        invite_token_expires_at: new Date(Date.now() - 3600 * 1000), // expired
      });

      await expect(service.acceptInvite('expired-token', acceptDto)).rejects.toThrow(GoneException);
    });

    it('should throw 404 NotFoundException for invalid token', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValueOnce(null);

      await expect(service.acceptInvite('bad-token', acceptDto)).rejects.toThrow(NotFoundException);
    });

    it('should write an audit log after successful acceptance', async () => {
      mockPrisma.user_tenant_membership.findFirst
        .mockResolvedValueOnce(validMembership)
        .mockResolvedValueOnce(null);
      mockPrisma.user_tenant_membership.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      await service.acceptInvite('raw-token', acceptDto);

      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'UserMembership',
          entityId: MEMBERSHIP_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // listUsers()
  // -----------------------------------------------------------------------

  describe('listUsers()', () => {
    const defaultQuery = { page: 1, limit: 20 };

    it('should return paginated memberships filtered by tenant_id', async () => {
      const memberships = [
        mockMembershipRecord({ id: 'mem-1' }),
        mockMembershipRecord({ id: 'mem-2' }),
      ];
      mockPrisma.user_tenant_membership.findMany.mockResolvedValue(memberships);
      mockPrisma.user_tenant_membership.count.mockResolvedValue(2);

      const result = await service.listUsers(TENANT_ID, defaultQuery);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.total_pages).toBe(1);
    });

    it('should always include tenant_id in where clause (multi-tenant isolation)', async () => {
      mockPrisma.user_tenant_membership.findMany.mockResolvedValue([]);
      mockPrisma.user_tenant_membership.count.mockResolvedValue(0);

      await service.listUsers(TENANT_ID, defaultQuery);

      expect(mockPrisma.user_tenant_membership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
      expect(mockPrisma.user_tenant_membership.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    it('should exclude soft-deleted users via relational filter (BR-07)', async () => {
      mockPrisma.user_tenant_membership.findMany.mockResolvedValue([]);
      mockPrisma.user_tenant_membership.count.mockResolvedValue(0);

      await service.listUsers(TENANT_ID, defaultQuery);

      expect(mockPrisma.user_tenant_membership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: { deleted_at: null },
          }),
        }),
      );
    });

    it('should filter by status when provided', async () => {
      mockPrisma.user_tenant_membership.findMany.mockResolvedValue([]);
      mockPrisma.user_tenant_membership.count.mockResolvedValue(0);

      await service.listUsers(TENANT_ID, { ...defaultQuery, status: 'ACTIVE' } as any);

      expect(mockPrisma.user_tenant_membership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });

    it('should filter by role_id when provided', async () => {
      mockPrisma.user_tenant_membership.findMany.mockResolvedValue([]);
      mockPrisma.user_tenant_membership.count.mockResolvedValue(0);

      await service.listUsers(TENANT_ID, { ...defaultQuery, role_id: ROLE_ID } as any);

      expect(mockPrisma.user_tenant_membership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role_id: ROLE_ID }),
        }),
      );
    });

    it('should apply correct pagination offset', async () => {
      mockPrisma.user_tenant_membership.findMany.mockResolvedValue([]);
      mockPrisma.user_tenant_membership.count.mockResolvedValue(0);

      await service.listUsers(TENANT_ID, { page: 3, limit: 10 });

      expect(mockPrisma.user_tenant_membership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3 - 1) * 10
          take: 10,
        }),
      );
    });

    it('should calculate total_pages correctly', async () => {
      mockPrisma.user_tenant_membership.findMany.mockResolvedValue([]);
      mockPrisma.user_tenant_membership.count.mockResolvedValue(45);

      const result = await service.listUsers(TENANT_ID, { page: 1, limit: 20 });

      expect(result.meta.total_pages).toBe(3); // Math.ceil(45 / 20) = 3
    });
  });

  // -----------------------------------------------------------------------
  // getUserById()
  // -----------------------------------------------------------------------

  describe('getUserById()', () => {
    it('should return formatted membership for valid membershipId and tenantId', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue(mockMembershipRecord());

      const result = await service.getUserById(TENANT_ID, MEMBERSHIP_ID);

      expect(result.id).toBe(MEMBERSHIP_ID);
      expect(result.email).toBe('test@example.com');
      expect(result.role.name).toBe('Employee');
    });

    it('should include tenant_id in lookup (multi-tenant isolation)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue(mockMembershipRecord());

      await service.getUserById(TENANT_ID, MEMBERSHIP_ID);

      expect(mockPrisma.user_tenant_membership.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MEMBERSHIP_ID, tenant_id: TENANT_ID },
        }),
      );
    });

    it('should throw 404 if membership not found in tenant', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue(null);

      await expect(service.getUserById(TENANT_ID, 'nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw 404 for cross-tenant access attempt', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue(null);

      await expect(service.getUserById(OTHER_TENANT_ID, MEMBERSHIP_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // changeRole()
  // -----------------------------------------------------------------------

  describe('changeRole()', () => {
    const dto = { role_id: 'new-role-id' };

    it('should throw 403 when Admin tries to change an Owner role (BR-09)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: MEMBERSHIP_ID,
        role: { name: 'Owner' },
      });

      const adminActor = { id: 'admin-user', roles: ['Admin'], is_platform_admin: false };

      await expect(
        service.changeRole(TENANT_ID, MEMBERSHIP_ID, adminActor, dto),
      ).rejects.toThrow(ForbiddenException);

      // Role should NOT have been changed
      expect(mockPrisma.user_tenant_membership.update).not.toHaveBeenCalled();
    });

    it('should allow Owner to change another Owner role (BR-09 exception)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: MEMBERSHIP_ID,
        role: { name: 'Owner' },
      });
      mockPrisma.role.findUnique.mockResolvedValue({ id: 'new-role-id', name: 'Admin' });
      mockPrisma.user_tenant_membership.update.mockResolvedValue(
        mockMembershipRecord({
          role: { id: 'new-role-id', name: 'Admin' },
        }),
      );

      const ownerActor = { id: 'owner-user', roles: ['Owner'], is_platform_admin: false };

      const result = await service.changeRole(TENANT_ID, MEMBERSHIP_ID, ownerActor, dto);

      expect(result.role.name).toBe('Admin');

      // BR-08: Audit log records before/after role
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'UserMembership',
          before: { role: 'Owner' },
          after: { role: 'Admin' },
        }),
      );
    });

    it('should allow platform admin to change an Owner role (BR-09 exception)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: MEMBERSHIP_ID,
        role: { name: 'Owner' },
      });
      mockPrisma.role.findUnique.mockResolvedValue({ id: 'new-role-id', name: 'Employee' });
      mockPrisma.user_tenant_membership.update.mockResolvedValue(
        mockMembershipRecord({
          role: { id: 'new-role-id', name: 'Employee' },
        }),
      );

      const platformAdmin = { id: 'platform-admin', roles: ['Admin'], is_platform_admin: true };

      const result = await service.changeRole(TENANT_ID, MEMBERSHIP_ID, platformAdmin, dto);

      expect(result.role.name).toBe('Employee');
    });

    it('should allow Admin to change a non-Owner role', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: MEMBERSHIP_ID,
        role: { name: 'Employee' },
      });
      mockPrisma.role.findUnique.mockResolvedValue({ id: 'new-role-id', name: 'Admin' });
      mockPrisma.user_tenant_membership.update.mockResolvedValue(
        mockMembershipRecord({
          role: { id: 'new-role-id', name: 'Admin' },
        }),
      );

      const adminActor = { id: 'admin-user', roles: ['Admin'], is_platform_admin: false };

      const result = await service.changeRole(TENANT_ID, MEMBERSHIP_ID, adminActor, dto);

      expect(result.role.name).toBe('Admin');
    });

    it('should throw 404 if membership not found', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue(null);

      const actor = { id: 'any-user', roles: ['Owner'], is_platform_admin: false };

      await expect(
        service.changeRole(TENANT_ID, 'nonexistent', actor, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw 404 if new role_id does not exist', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: MEMBERSHIP_ID,
        role: { name: 'Employee' },
      });
      mockPrisma.role.findUnique.mockResolvedValue(null);

      const actor = { id: 'any-user', roles: ['Owner'], is_platform_admin: false };

      await expect(
        service.changeRole(TENANT_ID, MEMBERSHIP_ID, actor, { role_id: 'invalid-role' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // deactivateUser()
  // -----------------------------------------------------------------------

  describe('deactivateUser()', () => {
    const dto = { reason: 'Left the company' };

    it('should deactivate a user and block their JWT token (BR-04)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: MEMBERSHIP_ID,
        user_id: USER_ID,
        tenant_id: TENANT_ID,
        status: 'ACTIVE',
        role: { name: 'Employee' },
      });
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      mockPrisma.user_tenant_membership.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.deactivateUser(TENANT_ID, MEMBERSHIP_ID, ACTOR_USER_ID, dto);

      expect(result.status).toBe('INACTIVE');
      expect(result.id).toBe(MEMBERSHIP_ID);
      expect(result.left_at).toBeDefined();

      // BR-04: JWT jti pushed to Redis blocklist
      expect(mockTokenBlocklist.blockUserTokens).toHaveBeenCalledWith(USER_ID);

      // Audit log
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'UserMembership',
          before: { status: 'ACTIVE' },
          after: expect.objectContaining({ status: 'INACTIVE' }),
        }),
      );
    });

    it('should include deactivation reason in audit description when provided', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: MEMBERSHIP_ID,
        user_id: USER_ID,
        tenant_id: TENANT_ID,
        status: 'ACTIVE',
        role: { name: 'Employee' },
      });
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      mockPrisma.user_tenant_membership.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      await service.deactivateUser(TENANT_ID, MEMBERSHIP_ID, ACTOR_USER_ID, { reason: 'Fired' });

      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'User deactivated: Fired',
        }),
      );
    });

    it('should omit reason suffix in audit description when reason is not provided', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: MEMBERSHIP_ID,
        user_id: USER_ID,
        tenant_id: TENANT_ID,
        status: 'ACTIVE',
        role: { name: 'Employee' },
      });
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      mockPrisma.user_tenant_membership.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      await service.deactivateUser(TENANT_ID, MEMBERSHIP_ID, ACTOR_USER_ID, {});

      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'User deactivated',
        }),
      );
    });

    it('should throw 400 when trying to deactivate the last active Owner (BR-10)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: MEMBERSHIP_ID,
        user_id: USER_ID,
        tenant_id: TENANT_ID,
        status: 'ACTIVE',
        role: { name: 'Owner' },
      });
      // Inside transaction: only 1 active Owner left
      mockPrisma.user_tenant_membership.count.mockResolvedValue(1);
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));

      await expect(
        service.deactivateUser(TENANT_ID, MEMBERSHIP_ID, ACTOR_USER_ID, dto),
      ).rejects.toThrow(BadRequestException);

      // BR-04 must NOT fire when deactivation is blocked
      expect(mockTokenBlocklist.blockUserTokens).not.toHaveBeenCalled();
    });

    it('should allow deactivating an Owner when another active Owner exists (BR-10)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: MEMBERSHIP_ID,
        user_id: USER_ID,
        tenant_id: TENANT_ID,
        status: 'ACTIVE',
        role: { name: 'Owner' },
      });
      mockPrisma.user_tenant_membership.count.mockResolvedValue(2); // 2 active Owners
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      mockPrisma.user_tenant_membership.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.deactivateUser(TENANT_ID, MEMBERSHIP_ID, ACTOR_USER_ID, dto);

      expect(result.status).toBe('INACTIVE');
      expect(mockTokenBlocklist.blockUserTokens).toHaveBeenCalledWith(USER_ID);
    });

    it('should throw 404 if active membership is not found in tenant', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue(null);

      await expect(
        service.deactivateUser(TENANT_ID, MEMBERSHIP_ID, ACTOR_USER_ID, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should set is_active=false on user record inside transaction', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: MEMBERSHIP_ID,
        user_id: USER_ID,
        tenant_id: TENANT_ID,
        status: 'ACTIVE',
        role: { name: 'Employee' },
      });
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      mockPrisma.user_tenant_membership.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      await service.deactivateUser(TENANT_ID, MEMBERSHIP_ID, ACTOR_USER_ID, dto);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: USER_ID },
          data: expect.objectContaining({ is_active: false }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // reactivateUser()
  // -----------------------------------------------------------------------

  describe('reactivateUser()', () => {
    it('should throw 409 if user has an ACTIVE membership in another tenant (BR-02, BR-03)', async () => {
      mockPrisma.user_tenant_membership.findFirst
        .mockResolvedValueOnce({ id: MEMBERSHIP_ID, user_id: USER_ID, tenant_id: TENANT_ID, status: 'INACTIVE' })
        .mockResolvedValueOnce({ id: 'other-membership', user_id: USER_ID, tenant_id: OTHER_TENANT_ID, status: 'ACTIVE' });

      await expect(
        service.reactivateUser(TENANT_ID, MEMBERSHIP_ID, ACTOR_USER_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('should reactivate a user when they have no other active memberships', async () => {
      mockPrisma.user_tenant_membership.findFirst
        .mockResolvedValueOnce({ id: MEMBERSHIP_ID, user_id: USER_ID, tenant_id: TENANT_ID, status: 'INACTIVE' })
        .mockResolvedValueOnce(null); // no other active memberships
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      mockPrisma.user_tenant_membership.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.reactivateUser(TENANT_ID, MEMBERSHIP_ID, ACTOR_USER_ID);

      expect(result.status).toBe('ACTIVE');
      expect(result.id).toBe(MEMBERSHIP_ID);
      expect(result.joined_at).toBeDefined();
    });

    it('should set is_active=true on user record and clear left_at on membership', async () => {
      mockPrisma.user_tenant_membership.findFirst
        .mockResolvedValueOnce({ id: MEMBERSHIP_ID, user_id: USER_ID, tenant_id: TENANT_ID, status: 'INACTIVE' })
        .mockResolvedValueOnce(null);
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      mockPrisma.user_tenant_membership.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      await service.reactivateUser(TENANT_ID, MEMBERSHIP_ID, ACTOR_USER_ID);

      expect(mockPrisma.user_tenant_membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACTIVE',
            left_at: null,
          }),
        }),
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is_active: true }),
        }),
      );
    });

    it('should throw 404 if inactive membership is not found', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue(null);

      await expect(
        service.reactivateUser(TENANT_ID, 'nonexistent', ACTOR_USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should write audit log after successful reactivation', async () => {
      mockPrisma.user_tenant_membership.findFirst
        .mockResolvedValueOnce({ id: MEMBERSHIP_ID, user_id: USER_ID, tenant_id: TENANT_ID, status: 'INACTIVE' })
        .mockResolvedValueOnce(null);
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      mockPrisma.user_tenant_membership.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      await service.reactivateUser(TENANT_ID, MEMBERSHIP_ID, ACTOR_USER_ID);

      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'UserMembership',
          before: { status: 'INACTIVE' },
          after: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // deleteUser()
  // -----------------------------------------------------------------------

  describe('deleteUser()', () => {
    it('should soft-delete when user has audit log references (BR-06, BR-07)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: MEMBERSHIP_ID,
        user_id: USER_ID,
        user: { email: 'user@example.com' },
        role: { name: 'Employee' },
      });
      mockPrisma.audit_log.count.mockResolvedValue(5); // has audit history
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.user_tenant_membership.update.mockResolvedValue({});

      await service.deleteUser(TENANT_ID, MEMBERSHIP_ID, ACTOR_USER_ID);

      // Soft delete: deleted_at is set
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deleted_at: expect.any(Date),
            is_active: false,
          }),
        }),
      );
      // Hard delete NOT called
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });

    it('should hard-delete when user has no audit log references (BR-06)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: MEMBERSHIP_ID,
        user_id: USER_ID,
        user: { email: 'user@example.com' },
        role: { name: 'Employee' },
      });
      mockPrisma.audit_log.count.mockResolvedValue(0); // no audit history
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      mockPrisma.user_tenant_membership.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.delete.mockResolvedValue({});

      await service.deleteUser(TENANT_ID, MEMBERSHIP_ID, ACTOR_USER_ID);

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: USER_ID } });
      expect(mockPrisma.user_tenant_membership.deleteMany).toHaveBeenCalledWith({
        where: { user_id: USER_ID },
      });
    });

    it('should fall back to soft-delete when hard-delete fails with FK constraint (BR-06)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: MEMBERSHIP_ID,
        user_id: USER_ID,
        user: { email: 'user@example.com' },
        role: { name: 'Employee' },
      });
      mockPrisma.audit_log.count.mockResolvedValue(0);
      // Hard delete fails with FK constraint error
      mockPrisma.$transaction.mockImplementation(async () => {
        const error: any = new Error('FK constraint');
        error.code = 'P2003';
        throw error;
      });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.user_tenant_membership.update.mockResolvedValue({});

      await service.deleteUser(TENANT_ID, MEMBERSHIP_ID, ACTOR_USER_ID);

      // Falls back to soft delete
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deleted_at: expect.any(Date) }),
        }),
      );
    });

    it('should fall back to soft-delete when hard-delete fails with P2014 FK constraint (BR-06)', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: MEMBERSHIP_ID,
        user_id: USER_ID,
        user: { email: 'user@example.com' },
        role: { name: 'Employee' },
      });
      mockPrisma.audit_log.count.mockResolvedValue(0);
      mockPrisma.$transaction.mockImplementation(async () => {
        const error: any = new Error('Required relation violation');
        error.code = 'P2014';
        throw error;
      });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.user_tenant_membership.update.mockResolvedValue({});

      await service.deleteUser(TENANT_ID, MEMBERSHIP_ID, ACTOR_USER_ID);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deleted_at: expect.any(Date) }),
        }),
      );
    });

    it('should re-throw unexpected errors during hard-delete', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: MEMBERSHIP_ID,
        user_id: USER_ID,
        user: { email: 'user@example.com' },
        role: { name: 'Employee' },
      });
      mockPrisma.audit_log.count.mockResolvedValue(0);
      mockPrisma.$transaction.mockImplementation(async () => {
        throw new Error('Unexpected database failure');
      });

      await expect(
        service.deleteUser(TENANT_ID, MEMBERSHIP_ID, ACTOR_USER_ID),
      ).rejects.toThrow('Unexpected database failure');
    });

    it('should throw 404 if membership not found', async () => {
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteUser(TENANT_ID, 'nonexistent', ACTOR_USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should write audit log for both soft and hard deletes', async () => {
      // Test soft-delete audit
      mockPrisma.user_tenant_membership.findFirst.mockResolvedValue({
        id: MEMBERSHIP_ID,
        user_id: USER_ID,
        user: { email: 'user@example.com' },
        role: { name: 'Employee' },
      });
      mockPrisma.audit_log.count.mockResolvedValue(5);
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.user_tenant_membership.update.mockResolvedValue({});

      await service.deleteUser(TENANT_ID, MEMBERSHIP_ID, ACTOR_USER_ID);

      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'User',
          entityId: USER_ID,
          tenantId: TENANT_ID,
          description: expect.stringContaining('soft-deleted'),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // getMe()
  // -----------------------------------------------------------------------

  describe('getMe()', () => {
    it('should return formatted user profile with membership info', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserRecord());
      mockPrisma.user_tenant_membership.findUnique.mockResolvedValue({
        id: MEMBERSHIP_ID,
        tenant_id: TENANT_ID,
        status: 'ACTIVE',
        joined_at: new Date('2026-01-15T10:00:00Z'),
        role: mockRoleRecord(),
      });

      const result = await service.getMe(USER_ID, MEMBERSHIP_ID);

      expect(result.id).toBe(USER_ID);
      expect(result.email).toBe('test@example.com');
      expect(result.first_name).toBe('Test');
      expect(result.last_name).toBe('User');
      expect(result.membership.id).toBe(MEMBERSHIP_ID);
      expect(result.membership.role.name).toBe('Employee');
      expect(result.membership.status).toBe('ACTIVE');
    });

    it('should throw 404 if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('nonexistent', MEMBERSHIP_ID)).rejects.toThrow(NotFoundException);
    });

    it('should throw 404 if membership not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserRecord());
      mockPrisma.user_tenant_membership.findUnique.mockResolvedValue(null);

      await expect(service.getMe(USER_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should return null for phone when user has no phone', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserRecord({ phone: null }));
      mockPrisma.user_tenant_membership.findUnique.mockResolvedValue({
        id: MEMBERSHIP_ID,
        tenant_id: TENANT_ID,
        status: 'ACTIVE',
        joined_at: null,
        role: mockRoleRecord(),
      });

      const result = await service.getMe(USER_ID, MEMBERSHIP_ID);

      expect(result.phone).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // updateMe()
  // -----------------------------------------------------------------------

  describe('updateMe()', () => {
    it('should update first_name when provided', async () => {
      mockPrisma.user.update.mockResolvedValue({});

      await service.updateMe(USER_ID, { first_name: 'Updated' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: expect.objectContaining({
          first_name: 'Updated',
          updated_at: expect.any(Date),
        }),
      });
    });

    it('should update last_name when provided', async () => {
      mockPrisma.user.update.mockResolvedValue({});

      await service.updateMe(USER_ID, { last_name: 'NewLastName' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: expect.objectContaining({ last_name: 'NewLastName' }),
      });
    });

    it('should update phone when provided', async () => {
      mockPrisma.user.update.mockResolvedValue({});

      await service.updateMe(USER_ID, { phone: '+15559876543' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: expect.objectContaining({ phone: '+15559876543' }),
      });
    });

    it('should only include provided fields in update (no undefined overwrites)', async () => {
      mockPrisma.user.update.mockResolvedValue({});

      await service.updateMe(USER_ID, { first_name: 'Only' });

      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('last_name');
      expect(updateCall.data).not.toHaveProperty('phone');
    });

    it('should always set updated_at even with no optional fields', async () => {
      mockPrisma.user.update.mockResolvedValue({});

      await service.updateMe(USER_ID, {});

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: expect.objectContaining({ updated_at: expect.any(Date) }),
      });
    });
  });

  // -----------------------------------------------------------------------
  // changePassword()
  // -----------------------------------------------------------------------

  describe('changePassword()', () => {
    const bcrypt = require('bcrypt');

    it('should throw 400 if current password is incorrect', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserRecord());
      bcrypt.compare.mockResolvedValue(false); // wrong password

      await expect(
        service.changePassword(USER_ID, {
          current_password: 'WrongP@ss',
          new_password: 'NewP@ss123',
        }),
      ).rejects.toThrow(BadRequestException);

      // Password should NOT have been updated
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should update password when current password is correct', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserRecord());
      bcrypt.compare.mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({});

      await service.changePassword(USER_ID, {
        current_password: 'OldP@ss123',
        new_password: 'NewP@ss123',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: USER_ID },
          data: expect.objectContaining({
            password_hash: 'hashed_value', // from mocked bcrypt.hash
          }),
        }),
      );
    });

    it('should throw 404 if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword('nonexistent', {
          current_password: 'any',
          new_password: 'any',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
