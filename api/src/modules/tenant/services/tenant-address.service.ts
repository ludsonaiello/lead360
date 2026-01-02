import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateAddressDto } from '../dto/create-address.dto';
import { UpdateAddressDto } from '../dto/update-address.dto';
import { AddressType } from '../dto/create-address.dto';

@Injectable()
export class TenantAddressService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all addresses for a tenant
   */
  async findAll(tenantId: string) {
    return this.prisma.tenantAddress.findMany({
      where: { tenant_id: tenantId } as any,
      orderBy: [{ is_default: 'desc' }, { address_type: 'asc' }],
    });
  }

  /**
   * Get a specific address by ID
   */
  async findOne(tenantId: string, addressId: string) {
    const address = await this.prisma.tenantAddress.findFirst({
      where: {
        id: addressId,
        tenant_id: tenantId, // CRITICAL: Tenant isolation
      } as any,
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return address;
  }

  /**
   * Get default address for a specific type
   */
  async findDefaultByType(tenantId: string, addressType: AddressType) {
    const address = await this.prisma.tenantAddress.findFirst({
      where: {
        tenant_id: tenantId,
        address_type: addressType,
        is_default: true,
      } as any,
    });

    if (!address) {
      // Return first address of this type if no default is set
      return this.prisma.tenantAddress.findFirst({
        where: {
          tenant_id: tenantId,
          address_type: addressType,
        } as any,
      });
    }

    return address;
  }

  /**
   * Create a new address
   */
  async create(tenantId: string, createAddressDto: CreateAddressDto, userId: string) {
    // Business rule: Legal address cannot be a PO Box
    if (
      createAddressDto.address_type === AddressType.LEGAL &&
      createAddressDto.is_po_box
    ) {
      throw new BadRequestException('Legal address cannot be a PO Box');
    }

    // Check if this is the first address of this type
    const existingCount = await this.prisma.tenantAddress.count({
      where: {
        tenant_id: tenantId,
        address_type: createAddressDto.address_type,
      } as any,
    });

    // If first address of this type, auto-set as default
    const shouldBeDefault = existingCount === 0 || createAddressDto.is_default === true;

    const address = await this.prisma.$transaction(async (tx) => {
      // If setting as default, un-set other defaults of same type
      if (shouldBeDefault) {
        await tx.tenantAddress.updateMany({
          where: {
            tenant_id: tenantId,
            address_type: createAddressDto.address_type,
            is_default: true,
          } as any,
          data: { is_default: false } as any,
        });
      }

      const newAddress = await tx.tenantAddress.create({
        data: {
          tenant_id: tenantId,
          ...createAddressDto,
          is_default: shouldBeDefault,
        } as any,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'CREATE',
          entity_type: 'TenantAddress',
          entity_id: newAddress.id,
          metadata_json: {  created: createAddressDto } as any,
        } as any,
      });

      return newAddress;
    });

    return address;
  }

  /**
   * Update an address
   */
  async update(
    tenantId: string,
    addressId: string,
    updateAddressDto: UpdateAddressDto,
    userId: string,
  ) {
    // Verify address exists and belongs to tenant
    const existingAddress = await this.findOne(tenantId, addressId);

    // Business rule: Legal address cannot be a PO Box
    if (
      existingAddress.address_type === AddressType.LEGAL &&
      updateAddressDto.is_po_box === true
    ) {
      throw new BadRequestException('Legal address cannot be a PO Box');
    }

    const address = await this.prisma.$transaction(async (tx) => {
      // If setting as default, un-set other defaults of same type
      if (updateAddressDto.is_default === true) {
        await tx.tenantAddress.updateMany({
          where: {
            tenant_id: tenantId,
            address_type: existingAddress.address_type,
            is_default: true,
            NOT: { id: addressId } as any,
          } as any,
          data: { is_default: false } as any,
        });
      }

      const updated = await tx.tenantAddress.update({
        where: { id: addressId } as any,
        data: updateAddressDto,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'UPDATE',
          entity_type: 'TenantAddress',
          entity_id: addressId,
          metadata_json: { 
            old: existingAddress,
            new: updateAddressDto,
          } as any,
        } as any,
      });

      return updated;
    });

    return address;
  }

  /**
   * Delete an address
   */
  async delete(tenantId: string, addressId: string, userId: string) {
    // Verify address exists and belongs to tenant
    const existingAddress = await this.findOne(tenantId, addressId);

    // Business rule: Cannot delete last legal address
    if (existingAddress.address_type === AddressType.LEGAL) {
      const legalAddressCount = await this.prisma.tenantAddress.count({
        where: {
          tenant_id: tenantId,
          address_type: AddressType.LEGAL,
        } as any,
      });

      if (legalAddressCount === 1) {
        throw new ForbiddenException(
          'Cannot delete the last legal address. Please add another legal address before deleting this one.',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // If deleting default address, set another one as default
      if (existingAddress.is_default) {
        const nextAddress = await tx.tenantAddress.findFirst({
          where: {
            tenant_id: tenantId,
            address_type: existingAddress.address_type,
            NOT: { id: addressId } as any,
          } as any,
        });

        if (nextAddress) {
          await tx.tenantAddress.update({
            where: { id: nextAddress.id } as any,
            data: { is_default: true } as any,
          });
        }
      }

      await tx.tenantAddress.delete({
        where: { id: addressId } as any,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'DELETE',
          entity_type: 'TenantAddress',
          entity_id: addressId,
          metadata_json: {  deleted: existingAddress } as any,
        } as any,
      });
    });

    return { message: 'Address deleted successfully' };
  }

  /**
   * Set an address as default for its type
   */
  async setAsDefault(tenantId: string, addressId: string, userId: string) {
    const address = await this.findOne(tenantId, addressId);

    await this.prisma.$transaction(async (tx) => {
      // Un-set other defaults of same type
      await tx.tenantAddress.updateMany({
        where: {
          tenant_id: tenantId,
          address_type: address.address_type,
          is_default: true,
          NOT: { id: addressId } as any,
        } as any,
        data: { is_default: false } as any,
      });

      // Set this one as default
      await tx.tenantAddress.update({
        where: { id: addressId } as any,
        data: { is_default: true } as any,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'UPDATE',
          entity_type: 'TenantAddress',
          entity_id: addressId,
          metadata_json: {  is_default: { old: false, new: true } } as any,
        } as any,
      });
    });

    return { message: 'Address set as default successfully' };
  }
}
