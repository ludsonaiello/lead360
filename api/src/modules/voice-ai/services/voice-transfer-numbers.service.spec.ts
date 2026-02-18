import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VoiceTransferNumbersService } from './voice-transfer-numbers.service';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * VoiceTransferNumbersService Unit Tests — Sprint B13
 *
 * Test coverage (3 cases):
 *   1. Max 10 limit enforced — 11th create throws BadRequestException
 *   2. Single default enforced — setting new default unsets previous default
 *   3. Tenant isolation — cannot update/delete another tenant's number
 */
describe('VoiceTransferNumbersService', () => {
  let service: VoiceTransferNumbersService;
  let prisma: jest.Mocked<PrismaService>;

  const TENANT_A_ID = 'tenant-a-uuid';
  const TENANT_B_ID = 'tenant-b-uuid';

  const numberA1 = {
    id: 'number-a1-uuid',
    tenant_id: TENANT_A_ID,
    label: 'Sales',
    phone_number: '+15550001001',
    transfer_type: 'primary',
    description: null,
    is_default: false,
    display_order: 0,
    available_hours: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const numberA2 = {
    ...numberA1,
    id: 'number-a2-uuid',
    label: 'Support',
    phone_number: '+15550001002',
    is_default: true,
    display_order: 1,
  };

  function buildMockPrisma(overrides: {
    count?: number;
    findFirst?: object | null;
    transaction?: jest.Mock;
  } = {}) {
    const txClient = {
      tenant_voice_transfer_number: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockImplementation((args: { data: object }) => Promise.resolve({ ...numberA1, ...args.data })),
        create: jest.fn().mockImplementation((args: { data: object }) => Promise.resolve({ ...numberA1, ...args.data })),
      },
    };

    const mockPrisma = {
      tenant_voice_transfer_number: {
        count: jest.fn().mockResolvedValue(overrides.count ?? 0),
        findMany: jest.fn().mockResolvedValue([numberA1, numberA2]),
        findFirst: jest.fn().mockResolvedValue(overrides.findFirst !== undefined ? overrides.findFirst : numberA1),
        create: jest.fn().mockImplementation((args: { data: object }) => Promise.resolve({ ...numberA1, ...args.data })),
        update: jest.fn().mockImplementation((args: { data: object }) => Promise.resolve({ ...numberA1, ...args.data })),
        delete: jest.fn().mockResolvedValue(numberA1),
      },
      $transaction: overrides.transaction ?? jest.fn().mockImplementation(async (fn: (tx: typeof txClient) => Promise<unknown>) => fn(txClient)),
    } as unknown as jest.Mocked<PrismaService>;

    return { mockPrisma, txClient };
  }

  async function buildService(prismaMock: jest.Mocked<PrismaService>): Promise<VoiceTransferNumbersService> {
    prisma = prismaMock;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceTransferNumbersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    return module.get<VoiceTransferNumbersService>(VoiceTransferNumbersService);
  }

  // ─── Test 1 ──────────────────────────────────────────────────────────────────

  describe('Test 1: Max 10 limit enforced', () => {
    it('11th create() call throws BadRequestException', async () => {
      // Tenant already has 10 transfer numbers
      const { mockPrisma } = buildMockPrisma({ count: 10 });
      service = await buildService(mockPrisma);

      await expect(
        service.create(TENANT_A_ID, {
          label: 'Emergency',
          phone_number: '+15550009999',
          transfer_type: 'emergency',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create(TENANT_A_ID, {
          label: 'Emergency',
          phone_number: '+15550009999',
          transfer_type: 'emergency',
        }),
      ).rejects.toThrow('Maximum of 10 transfer numbers per tenant has been reached.');

      // No create call should have been made
      expect(prisma.tenant_voice_transfer_number.create).not.toHaveBeenCalled();
    });

    it('9 existing → create succeeds (under limit)', async () => {
      const { mockPrisma } = buildMockPrisma({ count: 9 });
      service = await buildService(mockPrisma);

      const result = await service.create(TENANT_A_ID, {
        label: 'Sales',
        phone_number: '+15550001001',
        transfer_type: 'primary',
      });

      expect(result).toBeDefined();
      expect(prisma.tenant_voice_transfer_number.create).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Test 2 ──────────────────────────────────────────────────────────────────

  describe('Test 2: Single default enforced', () => {
    it('setting is_default=true on create unsets previous default via transaction', async () => {
      const { mockPrisma, txClient } = buildMockPrisma({ count: 2 });
      service = await buildService(mockPrisma);

      await service.create(TENANT_A_ID, {
        label: 'New Default',
        phone_number: '+15550005555',
        transfer_type: 'primary',
        is_default: true,
      });

      // A transaction should have been started (to ensure atomicity)
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

      // Within the transaction: first unset any existing default
      expect(txClient.tenant_voice_transfer_number.updateMany).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_A_ID, is_default: true },
        data: { is_default: false },
      });

      // Then create the new record with is_default=true
      expect(txClient.tenant_voice_transfer_number.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is_default: true }),
        }),
      );
    });

    it('setting is_default=true on update unsets previous default via transaction', async () => {
      const { mockPrisma, txClient } = buildMockPrisma({
        findFirst: numberA1,  // Existing record found for this tenant
      });
      service = await buildService(mockPrisma);

      await service.update(TENANT_A_ID, numberA1.id, { is_default: true });

      // Transaction started
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

      // Previous default unset
      expect(txClient.tenant_voice_transfer_number.updateMany).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_A_ID, is_default: true },
        data: { is_default: false },
      });

      // Record updated with is_default=true
      expect(txClient.tenant_voice_transfer_number.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: numberA1.id },
          data: { is_default: true },
        }),
      );
    });

    it('update without is_default=true does NOT start a transaction', async () => {
      const { mockPrisma } = buildMockPrisma({ findFirst: numberA1 });
      service = await buildService(mockPrisma);

      await service.update(TENANT_A_ID, numberA1.id, { label: 'Updated Label' });

      // No transaction needed when not changing the default flag
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.tenant_voice_transfer_number.update).toHaveBeenCalledWith({
        where: { id: numberA1.id },
        data: { label: 'Updated Label' },
      });
    });
  });

  // ─── Test 3 ──────────────────────────────────────────────────────────────────

  describe('Test 3: Tenant isolation — cannot update/delete another tenant\'s number', () => {
    it('update() throws NotFoundException when number belongs to a different tenant', async () => {
      // findFirst returns null because tenant_id filter excludes Tenant B's record
      const { mockPrisma } = buildMockPrisma({ findFirst: null });
      service = await buildService(mockPrisma);

      // Tenant A tries to update Tenant B's number ID
      await expect(
        service.update(TENANT_A_ID, 'number-b-uuid', { label: 'Hijacked' }),
      ).rejects.toThrow(NotFoundException);

      // findFirst was called with both id AND tenant_id to enforce isolation
      expect(prisma.tenant_voice_transfer_number.findFirst).toHaveBeenCalledWith({
        where: { id: 'number-b-uuid', tenant_id: TENANT_A_ID },
      });

      // No actual update was performed
      expect(prisma.tenant_voice_transfer_number.update).not.toHaveBeenCalled();
    });

    it('delete() throws NotFoundException when number belongs to a different tenant', async () => {
      // findFirst returns null because the number is in Tenant B, not Tenant A
      const { mockPrisma } = buildMockPrisma({ findFirst: null });
      service = await buildService(mockPrisma);

      await expect(
        service.delete(TENANT_A_ID, 'number-b-uuid'),
      ).rejects.toThrow(NotFoundException);

      // Ownership check was performed with correct tenant filter
      expect(prisma.tenant_voice_transfer_number.findFirst).toHaveBeenCalledWith({
        where: { id: 'number-b-uuid', tenant_id: TENANT_A_ID },
      });

      // No deletion was performed
      expect(prisma.tenant_voice_transfer_number.delete).not.toHaveBeenCalled();
    });

    it('update() succeeds when number belongs to requesting tenant', async () => {
      // findFirst returns the record (belongs to Tenant A)
      const { mockPrisma } = buildMockPrisma({ findFirst: numberA1 });
      service = await buildService(mockPrisma);

      const result = await service.update(TENANT_A_ID, numberA1.id, { label: 'Emergency' });

      expect(result).toBeDefined();
      expect(prisma.tenant_voice_transfer_number.update).toHaveBeenCalledWith({
        where: { id: numberA1.id },
        data: { label: 'Emergency' },
      });
    });

    it('delete() succeeds when number belongs to requesting tenant', async () => {
      const { mockPrisma } = buildMockPrisma({ findFirst: numberA1 });
      service = await buildService(mockPrisma);

      await service.delete(TENANT_A_ID, numberA1.id);

      expect(prisma.tenant_voice_transfer_number.delete).toHaveBeenCalledWith({
        where: { id: numberA1.id },
      });
    });
  });
});
