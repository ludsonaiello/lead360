import { ServiceUnavailableException } from '@nestjs/common';
import { FeatureFlagMiddleware } from './feature-flag.middleware';
import { FeatureFlagService } from '../services/feature-flag.service';

describe('FeatureFlagMiddleware', () => {
  let middleware: FeatureFlagMiddleware;
  let featureFlagService: jest.Mocked<FeatureFlagService>;
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    featureFlagService = {
      isEnabled: jest.fn(),
    } as any;

    middleware = new FeatureFlagMiddleware(featureFlagService);

    mockRequest = { path: '/files/upload' };
    mockResponse = {};
    mockNext = jest.fn();
  });

  it('should allow request when feature is enabled', async () => {
    featureFlagService.isEnabled.mockResolvedValue(true);

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should block request when file_storage is disabled', async () => {
    mockRequest.path = '/files/upload';
    featureFlagService.isEnabled.mockResolvedValue(false);

    await expect(
      middleware.use(mockRequest, mockResponse, mockNext),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('should block registration when user_registration is disabled', async () => {
    mockRequest.path = '/auth/register';
    featureFlagService.isEnabled.mockResolvedValue(false);

    await expect(
      middleware.use(mockRequest, mockResponse, mockNext),
    ).rejects.toThrow('User registration is currently closed');
  });

  it('should allow non-feature routes', async () => {
    mockRequest.path = '/admin/dashboard';

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(featureFlagService.isEnabled).not.toHaveBeenCalled();
  });
});
