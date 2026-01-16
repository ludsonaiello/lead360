import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';

describe('PlatformAdminGuard', () => {
  let guard: PlatformAdminGuard;

  beforeEach(() => {
    guard = new PlatformAdminGuard();
  });

  it('should allow platform admin', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'admin-1', is_platform_admin: true },
        }),
      }),
    } as ExecutionContext;

    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should deny non-platform admin', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user-1', is_platform_admin: false },
        }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
  });

  it('should deny missing user', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user: null }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
  });
});
