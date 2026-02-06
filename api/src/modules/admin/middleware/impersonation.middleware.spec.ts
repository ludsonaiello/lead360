import { ImpersonationMiddleware } from './impersonation.middleware';
import { ImpersonationService } from '../services/impersonation.service';

describe('ImpersonationMiddleware', () => {
  let middleware: ImpersonationMiddleware;
  let impersonationService: jest.Mocked<ImpersonationService>;
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    impersonationService = {
      validateImpersonationSession: jest.fn(),
    } as any;

    middleware = new ImpersonationMiddleware(impersonationService);

    mockRequest = { headers: {}, user: { id: 'admin-1' } };
    mockResponse = {};
    mockNext = jest.fn();
  });

  it('should pass through when no impersonation token', async () => {
    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(
      impersonationService.validateImpersonationSession,
    ).not.toHaveBeenCalled();
  });

  it('should override user when valid impersonation token', async () => {
    mockRequest.headers['x-impersonation-token'] = 'valid-token';

    impersonationService.validateImpersonationSession.mockResolvedValue({
      impersonated_user: {
        id: 'user-1',
        email: 'user@test.com',
        is_active: true,
        tenant_id: 'tenant-1',
        first_name: 'Test',
        last_name: 'User',
      },
      admin_user: {
        id: 'admin-1',
        email: 'admin@test.com',
        first_name: 'Admin',
        last_name: 'User',
        is_platform_admin: true,
      },
    });

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockRequest.user.id).toBe('user-1');
    expect(mockRequest.impersonating_admin.id).toBe('admin-1');
    expect(mockRequest.is_impersonating).toBe(true);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should ignore invalid impersonation token', async () => {
    mockRequest.headers['x-impersonation-token'] = 'invalid-token';
    impersonationService.validateImpersonationSession.mockRejectedValue(
      new Error('Invalid token'),
    );

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockRequest.user.id).toBe('admin-1');
    expect(mockNext).toHaveBeenCalled();
  });
});
