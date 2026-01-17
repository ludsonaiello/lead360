import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LeadActivitiesService, ActivityType } from './lead-activities.service';
import {
  GoogleMapsService,
  PartialAddress,
  ValidatedAddress,
} from './google-maps.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  CreateAddressDto,
  UpdateAddressDto,
} from '../dto/lead.dto';

@Injectable()
export class LeadAddressesService {
  private readonly logger = new Logger(LeadAddressesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activitiesService: LeadActivitiesService,
    private readonly googleMapsService: GoogleMapsService,
  ) {}

  /**
   * Create multiple addresses for a lead (used during lead creation)
   * @param leadId - Lead ID
   * @param addresses - Array of address objects
   * @param prismaClient - Optional Prisma transaction client
   * @returns Created addresses
   */
  async createMultiple(
    leadId: string,
    addresses: CreateAddressDto[],
    prismaClient?: any,
  ): Promise<any[]> {
    if (!addresses || addresses.length === 0) {
      return [];
    }

    // Use transaction client if provided, otherwise use default prisma
    const client = prismaClient || this.prisma;

    // Validate at least one is primary if multiple addresses provided
    const primaryCount = addresses.filter((a) => a.is_primary).length;
    if (addresses.length > 1 && primaryCount === 0) {
      // Auto-set first address as primary
      addresses[0].is_primary = true;
    } else if (primaryCount > 1) {
      throw new BadRequestException(
        'Only one address can be marked as primary',
      );
    }

    // Validate and geocode each address using Google Maps
    const validatedAddresses = await Promise.all(
      addresses.map(async (addressData) => {
        const partialAddress: PartialAddress = {
          address_line1: addressData.address_line1,
          address_line2: addressData.address_line2,
          city: addressData.city,
          state: addressData.state,
          zip_code: addressData.zip_code,
          country: addressData.country || 'US',
          latitude: addressData.latitude,
          longitude: addressData.longitude,
        };

        // MANDATORY: Validate with Google Maps (handles all 3 scenarios)
        const validatedAddress: ValidatedAddress =
          await this.googleMapsService.validateAddress(partialAddress);

        return {
          ...addressData,
          ...validatedAddress,
        };
      }),
    );

    // Create all validated addresses
    const createdAddresses = await Promise.all(
      validatedAddresses.map(async (validatedAddr) => {
        const addressId = this.generateUUID();
        return client.lead_address.create({
          data: {
            id: addressId,
            lead_id: leadId,
            address_line1: validatedAddr.address_line1,
            address_line2: validatedAddr.address_line2,
            city: validatedAddr.city,
            state: validatedAddr.state,
            zip_code: validatedAddr.zip_code,
            country: validatedAddr.country,
            latitude: new Decimal(validatedAddr.latitude),
            longitude: new Decimal(validatedAddr.longitude),
            google_place_id: validatedAddr.google_place_id,
            address_type: validatedAddr.address_type || 'service',
            is_primary: validatedAddr.is_primary || false,
          },
        });
      }),
    );

    return createdAddresses;
  }

  /**
   * Create a single address for a lead
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @param userId - User performing the action (for activity logging)
   * @param addressData - Address details
   * @returns Created address
   */
  async create(
    tenantId: string,
    leadId: string,
    userId: string,
    addressData: CreateAddressDto,
  ): Promise<any> {
    // Verify lead exists and belongs to tenant
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        tenant_id: tenantId,
      },
    });

    if (!lead) {
      throw new NotFoundException(
        `Lead with ID ${leadId} not found or access denied`,
      );
    }

    // MANDATORY: Validate with Google Maps
    const partialAddress: PartialAddress = {
      address_line1: addressData.address_line1,
      address_line2: addressData.address_line2,
      city: addressData.city,
      state: addressData.state,
      zip_code: addressData.zip_code,
      country: addressData.country || 'US',
      latitude: addressData.latitude,
      longitude: addressData.longitude,
    };

    const validatedAddress: ValidatedAddress =
      await this.googleMapsService.validateAddress(partialAddress);

    // If setting as primary, unset other primary addresses of the same type
    if (addressData.is_primary) {
      await this.prisma.lead_address.updateMany({
        where: {
          lead_id: leadId,
          address_type: addressData.address_type || 'service',
          is_primary: true,
        },
        data: {
          is_primary: false,
        },
      });
    } else {
      // If this is the first address of this type, make it primary automatically
      const existingAddressesCount = await this.prisma.lead_address.count({
        where: {
          lead_id: leadId,
          address_type: addressData.address_type || 'service',
        },
      });
      if (existingAddressesCount === 0) {
        addressData.is_primary = true;
      }
    }

    const addressId = this.generateUUID();
    const address = await this.prisma.lead_address.create({
      data: {
        id: addressId,
        lead_id: leadId,
        address_line1: validatedAddress.address_line1,
        address_line2: validatedAddress.address_line2,
        city: validatedAddress.city,
        state: validatedAddress.state,
        zip_code: validatedAddress.zip_code,
        country: validatedAddress.country,
        latitude: new Decimal(validatedAddress.latitude),
        longitude: new Decimal(validatedAddress.longitude),
        google_place_id: validatedAddress.google_place_id,
        address_type: addressData.address_type || 'service',
        is_primary: addressData.is_primary || false,
      },
    });

    // Log activity
    await this.activitiesService.logActivity(tenantId, {
      lead_id: leadId,
      activity_type: ActivityType.ADDRESS_ADDED,
      description: `Address ${address.address_line1}, ${address.city}, ${address.state} (${address.address_type}) added`,
      user_id: userId,
      metadata: {
        address_id: address.id,
        address_line1: address.address_line1,
        city: address.city,
        state: address.state,
        zip_code: address.zip_code,
        address_type: address.address_type,
        is_primary: address.is_primary,
      },
    });

    return address;
  }

  /**
   * Update an address
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @param addressId - Address ID
   * @param userId - User performing the action
   * @param updateData - Update data
   * @returns Updated address
   */
  async update(
    tenantId: string,
    leadId: string,
    addressId: string,
    userId: string,
    updateData: UpdateAddressDto,
  ): Promise<any> {
    // Verify address exists and belongs to tenant
    const address = await this.prisma.lead_address.findFirst({
      where: {
        id: addressId,
        lead_id: leadId,
        lead: {
          tenant_id: tenantId,
        },
      },
    });

    if (!address) {
      throw new NotFoundException(
        `Address with ID ${addressId} not found or access denied`,
      );
    }

    // If address components are being updated, re-validate with Google Maps
    let validatedAddress: ValidatedAddress | null = null;
    const addressComponentsChanged =
      updateData.address_line1 ||
      updateData.city ||
      updateData.state ||
      updateData.zip_code ||
      updateData.latitude ||
      updateData.longitude;

    if (addressComponentsChanged) {
      const partialAddress: PartialAddress = {
        address_line1: updateData.address_line1 || address.address_line1,
        address_line2:
          updateData.address_line2 !== undefined
            ? updateData.address_line2
            : address.address_line2 || undefined,
        city: updateData.city || address.city,
        state: updateData.state || address.state,
        zip_code: updateData.zip_code || address.zip_code,
        country: updateData.country || address.country,
        latitude: updateData.latitude || Number(address.latitude),
        longitude: updateData.longitude || Number(address.longitude),
      };

      validatedAddress =
        await this.googleMapsService.validateAddress(partialAddress);
    }

    // If setting as primary, unset other primary addresses of the same type
    if (updateData.is_primary === true) {
      await this.prisma.lead_address.updateMany({
        where: {
          lead_id: leadId,
          address_type: updateData.address_type || address.address_type,
          is_primary: true,
          id: { not: addressId },
        },
        data: {
          is_primary: false,
        },
      });
    }

    const updatedAddress = await this.prisma.lead_address.update({
      where: { id: addressId },
      data: {
        address_line1: validatedAddress?.address_line1 || updateData.address_line1,
        address_line2:
          validatedAddress?.address_line2 !== undefined
            ? validatedAddress.address_line2
            : updateData.address_line2 !== undefined
              ? updateData.address_line2
              : undefined,
        city: validatedAddress?.city || updateData.city,
        state: validatedAddress?.state || updateData.state,
        zip_code: validatedAddress?.zip_code || updateData.zip_code,
        country: validatedAddress?.country || updateData.country,
        latitude: validatedAddress
          ? new Decimal(validatedAddress.latitude)
          : updateData.latitude
            ? new Decimal(updateData.latitude)
            : undefined,
        longitude: validatedAddress
          ? new Decimal(validatedAddress.longitude)
          : updateData.longitude
            ? new Decimal(updateData.longitude)
            : undefined,
        google_place_id: validatedAddress?.google_place_id,
        address_type: updateData.address_type,
        is_primary: updateData.is_primary,
      },
    });

    // Log activity
    await this.activitiesService.logActivity(tenantId, {
      lead_id: leadId,
      activity_type: ActivityType.ADDRESS_UPDATED,
      description: `Address ${updatedAddress.address_line1}, ${updatedAddress.city}, ${updatedAddress.state} updated`,
      user_id: userId,
      metadata: {
        address_id: updatedAddress.id,
        changes: updateData,
      },
    });

    return updatedAddress;
  }

  /**
   * Delete an address
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @param addressId - Address ID
   * @param userId - User performing the action
   */
  async delete(
    tenantId: string,
    leadId: string,
    addressId: string,
    userId: string,
  ): Promise<void> {
    // Verify address exists and belongs to tenant
    const address = await this.prisma.lead_address.findFirst({
      where: {
        id: addressId,
        lead_id: leadId,
        lead: {
          tenant_id: tenantId,
        },
      },
    });

    if (!address) {
      throw new NotFoundException(
        `Address with ID ${addressId} not found or access denied`,
      );
    }

    // Check if address has associated service requests
    const serviceRequestCount = await this.prisma.service_request.count({
      where: { lead_address_id: addressId },
    });

    if (serviceRequestCount > 0) {
      throw new BadRequestException(
        `Cannot delete address. It is linked to ${serviceRequestCount} service request(s).`,
      );
    }

    await this.prisma.lead_address.delete({
      where: { id: addressId },
    });

    // If deleted address was primary, set another one as primary
    const addressType = address.address_type;
    const remainingAddressesCount = await this.prisma.lead_address.count({
      where: {
        lead_id: leadId,
        address_type: addressType,
      },
    });

    if (address.is_primary && remainingAddressesCount > 0) {
      await this.ensurePrimaryFlag(leadId, addressType);
    }

    // Log activity
    await this.activitiesService.logActivity(tenantId, {
      lead_id: leadId,
      activity_type: ActivityType.ADDRESS_DELETED,
      description: `Address ${address.address_line1}, ${address.city}, ${address.state} (${address.address_type}) deleted`,
      user_id: userId,
      metadata: {
        address_id: address.id,
        address_line1: address.address_line1,
        city: address.city,
        state: address.state,
        zip_code: address.zip_code,
        address_type: address.address_type,
      },
    });
  }

  /**
   * Get all addresses for a lead
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param leadId - Lead ID
   * @returns Array of addresses
   */
  async findAllByLead(tenantId: string, leadId: string): Promise<any[]> {
    return this.prisma.lead_address.findMany({
      where: {
        lead_id: leadId,
        lead: {
          tenant_id: tenantId,
        },
      },
      orderBy: [
        { is_primary: 'desc' }, // Primary first
        { address_type: 'asc' }, // Then by type
        { created_at: 'asc' }, // Then by creation date
      ],
    });
  }

  /**
   * Ensure at least one address of a specific type is marked as primary
   * @param leadId - Lead ID
   * @param addressType - Address type
   */
  async ensurePrimaryFlag(
    leadId: string,
    addressType: string,
  ): Promise<void> {
    const addresses = await this.prisma.lead_address.findMany({
      where: {
        lead_id: leadId,
        address_type: addressType,
      },
      orderBy: { created_at: 'asc' },
    });

    if (addresses.length === 0) {
      return;
    }

    const hasPrimary = addresses.some((a) => a.is_primary);
    if (!hasPrimary) {
      // Set first address as primary
      await this.prisma.lead_address.update({
        where: { id: addresses[0].id },
        data: { is_primary: true },
      });
    }
  }

  /**
   * Generate UUID v4
   * @returns UUID string
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0,
          v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }
}
