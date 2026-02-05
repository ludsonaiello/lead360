import { Test, TestingModule } from '@nestjs/testing';
import { ImpersonationController } from './impersonation.controller';
import { ImpersonationService } from '../services/impersonation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';

describe('ImpersonationController', () => {
  let controller: ImpersonationController;
  let service: jest.Mocked<ImpersonationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImpersonationController],
      providers: [
        {
          provide: ImpersonationService,
          useValue: {
            startImpersonation: jest.fn(),
            endImpersonation: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(PlatformAdminGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<ImpersonationController>(ImpersonationController);
    service = module.get(ImpersonationService);
  });

  it('should start impersonation', async () => {
    service.startImpersonation.mockResolvedValue({
      session_token: 'a'.repeat(64),
      expires_at: new Date(),
      impersonated_user: {
        id: 'user-1',
        email: 'user@test.com',
        first_name: 'Test',
        last_name: 'User',
        tenant_id: 'tenant-1',
        tenant: { id: 'tenant-1', subdomain: 'test', company_name: 'Test Company' },
      },
    });

    const result = await controller.startImpersonation(
      { user: { id: 'admin-1' } },
      'tenant-1',
      { user_id: 'user-1' },
    );

    expect(result).toHaveProperty('session_token');
  });

  it('should end impersonation', async () => {
    service.endImpersonation.mockResolvedValue({
      message: 'Impersonation ended successfully',
    });

    const result = await controller.exitImpersonation({ session_token: 'token' });

    expect(result).toHaveProperty('message');
  });
});
