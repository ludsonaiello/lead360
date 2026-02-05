import { Test, TestingModule } from '@nestjs/testing';
import { TenantManagementController } from './tenant-management.controller';
import { TenantManagementService } from '../services/tenant-management.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';

describe('TenantManagementController', () => {
  let controller: TenantManagementController;
  let service: jest.Mocked<TenantManagementService>;

  const mockRequest = {
    user: { id: 'admin-123', is_platform_admin: true },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantManagementController],
      providers: [
        {
          provide: TenantManagementService,
          useValue: {
            listTenants: jest.fn(),
            getTenantDetails: jest.fn(),
            createTenantManually: jest.fn(),
            suspendTenant: jest.fn(),
            activateTenant: jest.fn(),
            deleteTenant: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(PlatformAdminGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<TenantManagementController>(TenantManagementController);
    service = module.get(TenantManagementService);
  });

  describe('listTenants', () => {
    it('should return paginated tenant list', async () => {
      const mockResponse = {
        data: [{
          id: 'tenant-1',
          subdomain: 'test',
          company_name: 'Test Co',
          legal_business_name: 'Test Co LLC',
          business_entity_type: 'LLC',
          state_of_registration: 'CA',
          ein: '12-3456789',
          business_size: 'small',
          industry: 'construction',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        } as any],
        pagination: { total: 1, page: 1, limit: 20, total_pages: 1 },
      };

      service.listTenants.mockResolvedValue(mockResponse);

      const result = await controller.listTenants({ page: 1, limit: 20 });

      expect(result).toEqual(mockResponse);
      expect(service.listTenants).toHaveBeenCalled();
    });
  });

  describe('createTenant', () => {
    it('should create new tenant', async () => {
      const createDto = {
        subdomain: 'acme',
        business_name: 'Acme Inc',
        owner_email: 'owner@acme.com',
        owner_password: 'Pass123!',
        owner_first_name: 'John',
        owner_last_name: 'Doe',
      };

      const mockResponse = {
        tenant: { id: 'tenant-1', subdomain: 'acme' } as any,
        owner: { id: 'user-1', email: 'owner@acme.com' } as any,
        message: 'Tenant created successfully',
      };

      service.createTenantManually.mockResolvedValue(mockResponse);

      const result = await controller.createTenant(mockRequest, createDto);

      expect(result).toEqual(mockResponse);
      expect(service.createTenantManually).toHaveBeenCalledWith(createDto, 'admin-123');
    });
  });

  describe('suspendTenant', () => {
    it('should suspend tenant', async () => {
      service.suspendTenant.mockResolvedValue({
        id: 'tenant-1',
        is_active: false,
      } as any);

      const result = await controller.suspendTenant(mockRequest, 'tenant-1', { reason: 'Payment overdue' });

      expect(result.is_active).toBe(false);
      expect(service.suspendTenant).toHaveBeenCalledWith('tenant-1', 'admin-123', 'Payment overdue');
    });
  });

  describe('activateTenant', () => {
    it('should activate tenant', async () => {
      service.activateTenant.mockResolvedValue({
        id: 'tenant-1',
        is_active: true,
      } as any);

      const result = await controller.activateTenant(mockRequest, 'tenant-1');

      expect(result.is_active).toBe(true);
    });
  });

  describe('deleteTenant', () => {
    it('should delete tenant', async () => {
      service.deleteTenant.mockResolvedValue({
        message: 'Tenant deleted successfully',
      });

      const result = await controller.deleteTenant(mockRequest, 'tenant-1');

      expect(result).toHaveProperty('message');
    });
  });
});
