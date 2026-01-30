import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { GoogleMapsService } from '../../leads/services/google-maps.service';
import { JobsiteAddressDto } from '../dto/quote';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuid } from 'uuid';

@Injectable()
export class QuoteJobsiteAddressService {
  private readonly logger = new Logger(QuoteJobsiteAddressService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleMapsService: GoogleMapsService,
  ) {}

  /**
   * Create and validate jobsite address using Google Maps API
   *
   * Handles 3 scenarios:
   * 1. Frontend provides lat/lng → validates components, uses provided coordinates
   * 2. Lat/lng missing → geocodes address
   * 3. City/state missing → fetches from Google Maps
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param dto - Jobsite address data transfer object
   * @param transaction - Optional Prisma transaction client
   * @returns Created quote_jobsite_address record
   */
  async createAndValidate(
    tenantId: string,
    dto: JobsiteAddressDto,
    transaction?: any,
  ): Promise<any> {
    const prismaClient = transaction || this.prisma;

    try {
      // Validate address via Google Maps
      const validatedAddress = await this.googleMapsService.validateAddress({
        address_line1: dto.address_line1,
        address_line2: dto.address_line2,
        city: dto.city,
        state: dto.state,
        zip_code: dto.zip_code,
        latitude: dto.latitude,
        longitude: dto.longitude,
      });

      this.logger.log(
        `Address validated successfully: ${validatedAddress.address_line1}, ${validatedAddress.city}, ${validatedAddress.state}`,
      );

      // Create quote_jobsite_address record
      const jobsiteAddress = await prismaClient.quote_jobsite_address.create({
        data: {
          id: uuid(),
          tenant_id: tenantId,
          address_line1: validatedAddress.address_line1,
          address_line2: validatedAddress.address_line2 || null,
          city: validatedAddress.city,
          state: validatedAddress.state,
          zip_code: validatedAddress.zip_code,
          latitude: new Decimal(validatedAddress.latitude),
          longitude: new Decimal(validatedAddress.longitude),
          google_place_id: validatedAddress.google_place_id || null,
        },
      });

      return jobsiteAddress;
    } catch (error) {
      this.logger.error('Address validation failed:', error);

      if (error instanceof UnprocessableEntityException) {
        throw error;
      }

      throw new UnprocessableEntityException(
        `Address validation failed: ${error.message}`,
      );
    }
  }

  /**
   * Update existing jobsite address with re-validation
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param addressId - Existing jobsite address UUID
   * @param dto - Updated jobsite address data
   * @param transaction - Optional Prisma transaction client
   * @returns Updated quote_jobsite_address record
   */
  async updateAndValidate(
    tenantId: string,
    addressId: string,
    dto: JobsiteAddressDto,
    transaction?: any,
  ): Promise<any> {
    const prismaClient = transaction || this.prisma;

    try {
      // Validate new address via Google Maps
      const validatedAddress = await this.googleMapsService.validateAddress({
        address_line1: dto.address_line1,
        address_line2: dto.address_line2,
        city: dto.city,
        state: dto.state,
        zip_code: dto.zip_code,
        latitude: dto.latitude,
        longitude: dto.longitude,
      });

      this.logger.log(
        `Address re-validated successfully: ${validatedAddress.address_line1}, ${validatedAddress.city}, ${validatedAddress.state}`,
      );

      // Update quote_jobsite_address record
      const updatedAddress = await prismaClient.quote_jobsite_address.update({
        where: {
          id: addressId,
          tenant_id: tenantId,
        },
        data: {
          address_line1: validatedAddress.address_line1,
          address_line2: validatedAddress.address_line2 || null,
          city: validatedAddress.city,
          state: validatedAddress.state,
          zip_code: validatedAddress.zip_code,
          country: validatedAddress.country || 'US',
          latitude: new Decimal(validatedAddress.latitude),
          longitude: new Decimal(validatedAddress.longitude),
          google_place_id: validatedAddress.google_place_id || null,
        },
      });

      return updatedAddress;
    } catch (error) {
      this.logger.error('Address update and validation failed:', error);

      if (error instanceof UnprocessableEntityException) {
        throw error;
      }

      throw new UnprocessableEntityException(
        `Address validation failed: ${error.message}`,
      );
    }
  }

  /**
   * Get jobsite address by ID
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param addressId - Jobsite address UUID
   * @returns quote_jobsite_address record
   */
  async findOne(tenantId: string, addressId: string): Promise<any> {
    const address = await this.prisma.quote_jobsite_address.findFirst({
      where: {
        id: addressId,
        tenant_id: tenantId,
      },
    });

    if (!address) {
      throw new Error(`Jobsite address not found: ${addressId}`);
    }

    return address;
  }

  /**
   * Clone jobsite address for quote duplication
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param sourceAddressId - Source address UUID
   * @param transaction - Optional Prisma transaction client
   * @returns Newly created jobsite address record
   */
  async clone(tenantId: string, sourceAddressId: string, transaction?: any): Promise<any> {
    const prismaClient = transaction || this.prisma;

    const sourceAddress = await this.findOne(tenantId, sourceAddressId);

    const clonedAddress = await prismaClient.quote_jobsite_address.create({
      data: {
        id: uuid(),
        tenant_id: tenantId,
        address_line1: sourceAddress.address_line1,
        address_line2: sourceAddress.address_line2,
        city: sourceAddress.city,
        state: sourceAddress.state,
        zip_code: sourceAddress.zip_code,
        country: sourceAddress.country,
        latitude: sourceAddress.latitude,
        longitude: sourceAddress.longitude,
        google_place_id: sourceAddress.google_place_id,
      },
    });

    this.logger.log(
      `Cloned jobsite address: ${sourceAddressId} → ${clonedAddress.id}`,
    );

    return clonedAddress;
  }
}
