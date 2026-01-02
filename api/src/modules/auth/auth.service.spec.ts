import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../core/database/prisma.service';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 'user-uuid',
    tenant_id: 'tenant-uuid',
    email: 'test@example.com',
    password_hash: 'hashed_password',
    first_name: 'John',
    last_name: 'Doe',
    phone: '+15551234567',
    is_active: true,
    is_platform_admin: false,
    email_verified: true,
    email_verified_at: new Date(),
    activation_token: null,
    activation_token_expires: null,
    password_reset_token: null,
    password_reset_expires: null,
    last_login_at: new Date(),
    mfa_enabled: false,
    mfa_secret: null,
    oauth_provider: null,
    oauth_provider_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    user_roles: [
      {
        id: 'user-role-uuid',
        user_id: 'user-uuid',
        role_id: 'role-uuid',
        role: { id: 'role-uuid', name: 'Owner' },
      },
    ],
  };

  const mockTenant = {
    id: 'tenant-uuid',
    subdomain: 'test-company',
    company_name: 'Test Company LLC',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      tenant: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      role: {
        create: jest.fn(),
      },
      userRole: {
        create: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) =>
        callback({
          tenant: { create: jest.fn().mockResolvedValue(mockTenant) },
          user: { create: jest.fn().mockResolvedValue(mockUser) },
          role: {
            create: jest
              .fn()
              .mockResolvedValue({ id: 'role-uuid', name: 'Owner' }),
          },
          userRole: { create: jest.fn() },
          tenantBusinessHours: {
            create: jest.fn().mockResolvedValue({
              id: 'hours-uuid',
              tenant_id: 'tenant-uuid',
              monday_closed: false,
              monday_open1: '09:00',
              monday_close1: '17:00',
            }),
          },
          auditLog: { create: jest.fn() },
        }),
      ),
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          JWT_SECRET: 'test-jwt-secret',
          JWT_REFRESH_SECRET: 'test-refresh-secret',
          APP_URL: 'https://app.lead360.app',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'SecurePass@123',
      first_name: 'Jane',
      last_name: 'Smith',
      phone: '+15559876543',
      tenant_subdomain: 'new-company',
      company_name: 'New Company LLC',
      legal_business_name: 'New Company LLC',
      business_entity_type: 'llc',
      state_of_registration: 'CA',
      ein: '12-3456789',
      primary_contact_phone: '5551234567',
      primary_contact_email: 'contact@newcompany.com',
    };

    it('should successfully register a new user and tenant', async () => {
      (prismaService.tenant.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');

      // Override $transaction to return proper data
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const newUser = {
            ...mockUser,
            id: 'new-user-uuid',
            email: registerDto.email,
            first_name: registerDto.first_name,
            last_name: registerDto.last_name,
            is_active: false,
            email_verified: false,
          };
          const newTenant = {
            ...mockTenant,
            id: 'new-tenant-uuid',
            subdomain: registerDto.tenant_subdomain,
            company_name: registerDto.company_name,
          };
          return callback({
            tenant: { create: jest.fn().mockResolvedValue(newTenant) },
            user: { create: jest.fn().mockResolvedValue(newUser) },
            role: {
              create: jest
                .fn()
                .mockResolvedValue({ id: 'role-uuid', name: 'Owner' }),
            },
            userRole: { create: jest.fn() },
            tenantBusinessHours: {
              create: jest.fn().mockResolvedValue({
                id: 'hours-uuid',
                tenant_id: newTenant.id,
              }),
            },
            auditLog: { create: jest.fn() },
          });
        },
      );

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tenant');
      expect(result).toHaveProperty('message');
      expect(result.user.email).toBe(registerDto.email);
      expect(result.user.is_active).toBe(false);
    });

    it('should throw ConflictException if subdomain is taken', async () => {
      (prismaService.tenant.findUnique as jest.Mock).mockResolvedValue(
        mockTenant,
      );

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      (prismaService.tenant.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should hash password with bcrypt', async () => {
      (prismaService.tenant.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');

      await service.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'SecurePass@123',
      remember_me: false,
    };

    it('should successfully login with valid credentials', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.login(loginDto, '127.0.0.1', 'TestAgent');

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result).toHaveProperty('user');
      expect(result.token_type).toBe('Bearer');
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      await expect(
        service.login(loginDto, '127.0.0.1', 'TestAgent'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login(loginDto, '127.0.0.1', 'TestAgent'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException if account not activated', async () => {
      const inactiveUser = { ...mockUser, is_active: false };
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(
        inactiveUser,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login(loginDto, '127.0.0.1', 'TestAgent'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if email not verified', async () => {
      const unverifiedUser = { ...mockUser, email_verified: false };
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(
        unverifiedUser,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login(loginDto, '127.0.0.1', 'TestAgent'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update last_login_at on successful login', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.login(loginDto, '127.0.0.1', 'TestAgent');

      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({ last_login_at: expect.any(Date) }),
        }),
      );
    });

    it('should create refresh token record', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.login(loginDto, '127.0.0.1', 'TestAgent');

      expect(prismaService.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should return new access token', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.refresh(mockUser.id);

      expect(result).toHaveProperty('access_token');
      expect(result.token_type).toBe('Bearer');
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.refresh('invalid-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke refresh token', async () => {
      (prismaService.refreshToken.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.logout(mockUser.id, 'token-hash');

      expect(result.message).toBe('Logged out successfully');
      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user_id: mockUser.id,
            token_hash: 'token-hash',
          }),
        }),
      );
    });
  });

  describe('logoutAll', () => {
    it('should revoke all refresh tokens', async () => {
      (prismaService.refreshToken.updateMany as jest.Mock).mockResolvedValue({
        count: 3,
      });
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.logoutAll(mockUser.id);

      expect(result.sessions_revoked).toBe(3);
    });
  });

  describe('forgotPassword', () => {
    it('should return success even if email does not exist', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'noone@test.com' });

      expect(result.message).toContain(
        'If an account with that email exists',
      );
    });

    it('should generate reset token for existing user', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.forgotPassword({ email: mockUser.email });

      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password_reset_token: expect.any(String),
            password_reset_expires: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const userWithToken = {
        ...mockUser,
        password_reset_token: 'valid-token',
        password_reset_expires: new Date(Date.now() + 3600000),
      };
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(
        userWithToken,
      );
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.refreshToken.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.resetPassword({
        token: 'valid-token',
        password: 'NewSecure@Pass456',
      });

      expect(result.message).toContain('Password reset successfully');
    });

    it('should throw BadRequestException for invalid token', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: 'invalid-token',
          password: 'NewSecure@Pass456',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should revoke all refresh tokens after password reset', async () => {
      const userWithToken = {
        ...mockUser,
        password_reset_token: 'valid-token',
        password_reset_expires: new Date(Date.now() + 3600000),
      };
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(
        userWithToken,
      );
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.refreshToken.updateMany as jest.Mock).mockResolvedValue({
        count: 2,
      });
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.resetPassword({
        token: 'valid-token',
        password: 'NewSecure@Pass456',
      });

      expect(prismaService.refreshToken.updateMany).toHaveBeenCalled();
    });
  });

  describe('activateAccount', () => {
    it('should activate account with valid token', async () => {
      const inactiveUser = {
        ...mockUser,
        is_active: false,
        email_verified: false,
        activation_token: 'valid-token',
        activation_token_expires: new Date(Date.now() + 3600000),
      };
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(
        inactiveUser,
      );
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.activateAccount({ token: 'valid-token' });

      expect(result.message).toContain('Account activated successfully');
    });

    it('should throw BadRequestException for invalid token', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.activateAccount({ token: 'invalid-token' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if already activated', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.activateAccount({ token: 'some-token' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // current password correct
        .mockResolvedValueOnce(false); // new password different
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.refreshToken.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.changePassword(mockUser.id, {
        current_password: 'OldPass@123',
        new_password: 'NewSecure@Pass456',
      });

      expect(result.message).toBe('Password changed successfully');
    });

    it('should throw BadRequestException for incorrect current password', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(mockUser.id, {
          current_password: 'WrongPass@123',
          new_password: 'NewSecure@Pass456',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if new password is same as current', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // current password correct
        .mockResolvedValueOnce(true); // new password same

      await expect(
        service.changePassword(mockUser.id, {
          current_password: 'SamePass@123',
          new_password: 'SamePass@123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should revoke other sessions but keep current', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.refreshToken.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.changePassword(
        mockUser.id,
        {
          current_password: 'OldPass@123',
          new_password: 'NewSecure@Pass456',
        },
        'current-token-hash',
      );

      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            token_hash: { not: 'current-token-hash' },
          }),
        }),
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.getProfile(mockUser.id);

      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(result.roles).toContain('Owner');
    });

    it('should throw NotFoundException if user not found', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getProfile('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        first_name: 'Updated',
      });
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.updateProfile(mockUser.id, {
        first_name: 'Updated',
      });

      expect(result.first_name).toBe('Updated');
    });

    it('should throw BadRequestException if no fields to update', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.updateProfile(mockUser.id, {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('listSessions', () => {
    it('should return list of sessions', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          token_hash: 'hash-1',
          device_name: 'Chrome on Windows',
          ip_address: '127.0.0.1',
          created_at: new Date(),
          expires_at: new Date(Date.now() + 86400000),
        },
      ];
      (prismaService.refreshToken.findMany as jest.Mock).mockResolvedValue(
        mockSessions,
      );

      const result = await service.listSessions(mockUser.id, 'hash-1');

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].is_current).toBe(true);
    });
  });

  describe('revokeSession', () => {
    it('should revoke session successfully', async () => {
      const mockSession = {
        id: 'session-1',
        user_id: mockUser.id,
        revoked_at: null,
      };
      (prismaService.refreshToken.findFirst as jest.Mock).mockResolvedValue(
        mockSession,
      );
      (prismaService.refreshToken.update as jest.Mock).mockResolvedValue({});
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.revokeSession(mockUser.id, 'session-1');

      expect(result.message).toBe('Session revoked successfully');
    });

    it('should throw NotFoundException if session not found', async () => {
      (prismaService.refreshToken.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.revokeSession(mockUser.id, 'invalid-session'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkSubdomain', () => {
    it('should return available=true for non-existent subdomain', async () => {
      (prismaService.tenant.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.checkSubdomain('new-subdomain');

      expect(result.available).toBe(true);
      expect(result.subdomain).toBe('new-subdomain');
    });

    it('should return available=false for existing subdomain', async () => {
      (prismaService.tenant.findUnique as jest.Mock).mockResolvedValue(
        mockTenant,
      );

      const result = await service.checkSubdomain('test-company');

      expect(result.available).toBe(false);
    });
  });
});
