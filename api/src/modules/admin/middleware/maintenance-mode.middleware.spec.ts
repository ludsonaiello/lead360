import { MaintenanceModeMiddleware } from './maintenance-mode.middleware';
import { MaintenanceModeService } from '../services/maintenance-mode.service';

describe('MaintenanceModeMiddleware', () => {
  let middleware: MaintenanceModeMiddleware;
  let maintenanceModeService: jest.Mocked<MaintenanceModeService>;
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    maintenanceModeService = {
      isInMaintenanceMode: jest.fn(),
      getMaintenanceConfig: jest.fn(),
    } as any;

    middleware = new MaintenanceModeMiddleware(maintenanceModeService);

    mockRequest = { path: '/api/tenants', ip: '192.168.1.100' };
    mockResponse = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    mockNext = jest.fn();
  });

  it('should allow request when maintenance disabled', async () => {
    maintenanceModeService.isInMaintenanceMode.mockResolvedValue(false);

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should block request when maintenance enabled', async () => {
    maintenanceModeService.isInMaintenanceMode.mockResolvedValue(true);
    maintenanceModeService.getMaintenanceConfig.mockResolvedValue({
      message: 'System maintenance',
      allowed_ips: '192.168.1.1',
    });

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(503);
    expect(mockResponse.json).toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should allow whitelisted IP during maintenance', async () => {
    mockRequest.ip = '192.168.1.1';
    maintenanceModeService.isInMaintenanceMode.mockResolvedValue(true);
    maintenanceModeService.getMaintenanceConfig.mockResolvedValue({
      message: 'System maintenance',
      allowed_ips: '192.168.1.1, 10.0.0.1',
    });

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should always allow admin routes', async () => {
    mockRequest.path = '/admin/dashboard';
    maintenanceModeService.isInMaintenanceMode.mockResolvedValue(true);

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});
