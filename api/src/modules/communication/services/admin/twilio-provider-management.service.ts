import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { EncryptionService } from '../../../../core/encryption/encryption.service';
import twilio from 'twilio';
import { v4 as uuidv4 } from 'uuid';

/**
 * TwilioProviderManagementService
 *
 * System-Level Twilio Provider Management (Model B Support)
 *
 * Responsibilities:
 * - Register and manage system-level Twilio provider (master account)
 * - Allocate phone numbers from system pool to tenants
 * - List available phone numbers from Twilio
 * - Test system provider connectivity
 * - Update system provider configuration
 * - Provision tenants with Twilio resources (Model B)
 *
 * Model A vs Model B:
 * - Model A: Each tenant brings their own Twilio account (BYOT - Bring Your Own Twilio)
 * - Model B: Platform provides Twilio service from master account
 *
 * This service enables Model B by:
 * - Storing system-level Twilio credentials
 * - Allocating phone numbers to tenants from master account
 * - Managing shared Twilio resources
 * - Providing unified billing through master account
 *
 * Key Features:
 * - Encrypted credential storage
 * - Phone number provisioning and allocation
 * - System provider health testing
 * - Multi-tenant resource isolation
 * - Comprehensive audit logging
 *
 * Security:
 * - Credentials encrypted at rest using EncryptionService
 * - Only platform admins can access this service
 * - All operations are audit logged
 * - Phone number allocations track tenant ownership
 *
 * @class TwilioProviderManagementService
 * @since Sprint 8
 */
@Injectable()
export class TwilioProviderManagementService {
  private readonly logger = new Logger(TwilioProviderManagementService.name);

  /**
   * System provider key in communication_provider table
   * Used to identify the master Twilio account
   */
  private readonly SYSTEM_PROVIDER_KEY = 'twilio_system';

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Register system-level Twilio provider (master account for Model B)
   *
   * Stores master Twilio account credentials for platform-wide usage.
   * Enables Model B where platform manages Twilio services for all tenants.
   *
   * @param dto - System provider registration data (account_sid, auth_token)
   * @returns Promise<SystemProvider> - Registered provider (without credentials)
   *
   * @example
   * const provider = await service.registerSystemProvider({
   *   account_sid: 'AC1234567890abcdef1234567890abcd',
   *   auth_token: 'your_twilio_auth_token'
   * });
   */
  async registerSystemProvider(dto: {
    account_sid: string;
    auth_token: string;
  }): Promise<SystemProvider> {
    this.logger.log('Registering system-level Twilio provider');

    try {
      // Validate Twilio credentials before storing
      const isValid = await this.validateTwilioCredentials(
        dto.account_sid,
        dto.auth_token,
      );

      if (!isValid) {
        throw new BadRequestException(
          'Invalid Twilio credentials - could not authenticate with Twilio API',
        );
      }

      // Encrypt system-level Twilio credentials
      const encryptedCredentials = await this.encryptionService.encrypt(
        JSON.stringify({
          account_sid: dto.account_sid,
          auth_token: dto.auth_token,
        }),
      );

      // Store or update in communication_provider table
      const provider = await this.prisma.communication_provider.upsert({
        where: { provider_key: this.SYSTEM_PROVIDER_KEY },
        update: {
          credentials_schema: encryptedCredentials,
          is_active: true,
          updated_at: new Date(),
        },
        create: {
          id: uuidv4(),
          provider_key: this.SYSTEM_PROVIDER_KEY,
          provider_name: 'Twilio System Provider',
          provider_type: 'sms',
          credentials_schema: encryptedCredentials,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      this.logger.log('System-level Twilio provider registered successfully');

      // Return provider info without sensitive credentials
      return {
        provider_key: provider.provider_key,
        provider_name: provider.provider_name,
        provider_type: provider.provider_type,
        is_active: provider.is_active,
        created_at: provider.created_at,
        updated_at: provider.updated_at,
      };
    } catch (error) {
      this.logger.error('Failed to register system provider:', error.message);
      throw error;
    }
  }

  /**
   * Allocate phone number from system pool to tenant
   *
   * Provisions a phone number for a tenant using the master Twilio account.
   * Creates tenant SMS configuration using system credentials.
   *
   * @param tenantId - UUID of the tenant
   * @param phoneNumber - E.164 formatted phone number to allocate
   * @returns Promise<void>
   *
   * @example
   * await service.allocatePhoneNumberToTenant(
   *   'tenant-uuid',
   *   '+15551234567'
   * );
   */
  async allocatePhoneNumberToTenant(
    tenantId: string,
    sid: string,
    purpose?: string,
  ): Promise<void> {
    const finalPurpose = purpose || 'SMS + Calls';
    this.logger.log(
      `Allocating phone number SID ${sid} to tenant ${tenantId} for purpose: ${finalPurpose}`,
    );

    try {
      // Verify tenant exists and is active
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, company_name: true, is_active: true },
      });

      if (!tenant) {
        throw new NotFoundException(`Tenant ${tenantId} not found`);
      }

      if (!tenant.is_active) {
        throw new BadRequestException(
          `Cannot allocate phone number to inactive tenant ${tenant.company_name}`,
        );
      }

      // Load system provider credentials
      const systemProvider = await this.loadSystemProvider();

      if (!systemProvider) {
        throw new BadRequestException(
          'System Twilio provider not configured - please register system provider first',
        );
      }

      // Fetch the phone number details from Twilio using the SID
      const client = twilio(
        systemProvider.account_sid,
        systemProvider.auth_token,
      );

      const phoneNumberDetails = await client.incomingPhoneNumbers(sid).fetch();

      const phoneNumber = phoneNumberDetails.phoneNumber;

      this.logger.debug(`Resolved SID ${sid} to phone number ${phoneNumber}`);

      // Check if phone number is already allocated
      const existingConfig = await this.prisma.tenant_sms_config.findFirst({
        where: {
          from_phone: phoneNumber,
          is_active: true,
        },
        include: {
          tenant: {
            select: { company_name: true },
          },
        },
      });

      if (existingConfig) {
        throw new BadRequestException(
          `Phone number ${phoneNumber} is already allocated to tenant ${existingConfig.tenant.company_name}`,
        );
      }

      // Determine which config(s) to create based on purpose
      const isWhatsApp = finalPurpose === 'WhatsApp';
      const isSmsOrVoice = ['SMS Only', 'Calls Only', 'SMS + Calls'].includes(
        finalPurpose,
      );

      // Create appropriate configuration(s) based on purpose
      if (isSmsOrVoice) {
        // For SMS and/or Voice, create or update tenant_sms_config
        // (Twilio phone numbers handle both SMS and voice on the same number)
        const provider = await this.prisma.communication_provider.findUnique({
          where: { provider_key: 'twilio_sms' },
        });

        if (!provider) {
          throw new BadRequestException(
            'Twilio SMS provider not found in communication providers',
          );
        }

        // Use upsert to update existing config or create new one
        await this.prisma.tenant_sms_config.upsert({
          where: {
            tenant_id_provider_id: {
              tenant_id: tenantId,
              provider_id: provider.id,
            },
          },
          update: {
            from_phone: phoneNumber,
            credentials: systemProvider.encrypted_credentials,
            is_active: true,
            is_verified: true,
            updated_at: new Date(),
          },
          create: {
            id: uuidv4(),
            tenant_id: tenantId,
            provider_id: provider.id,
            from_phone: phoneNumber,
            credentials: systemProvider.encrypted_credentials,
            is_active: true,
            is_verified: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });

        this.logger.log(
          `Created/Updated SMS/Voice config for ${phoneNumber} (Purpose: ${finalPurpose})`,
        );
      }

      if (isWhatsApp) {
        // For WhatsApp, create or update tenant_whatsapp_config
        const provider = await this.prisma.communication_provider.findUnique({
          where: { provider_key: 'twilio_whatsapp' },
        });

        if (!provider) {
          throw new BadRequestException(
            'Twilio WhatsApp provider not found in communication providers',
          );
        }

        // Use upsert to update existing config or create new one
        await this.prisma.tenant_whatsapp_config.upsert({
          where: {
            tenant_id_provider_id: {
              tenant_id: tenantId,
              provider_id: provider.id,
            },
          },
          update: {
            from_phone: phoneNumber,
            credentials: systemProvider.encrypted_credentials,
            is_active: true,
            is_verified: true,
            updated_at: new Date(),
          },
          create: {
            id: uuidv4(),
            tenant_id: tenantId,
            provider_id: provider.id,
            from_phone: phoneNumber,
            credentials: systemProvider.encrypted_credentials,
            is_active: true,
            is_verified: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });

        this.logger.log(`Created/Updated WhatsApp config for ${phoneNumber}`);
      }

      this.logger.log(
        `Phone number ${phoneNumber} successfully allocated to tenant ${tenant.company_name} for ${finalPurpose}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to allocate phone number ${sid} to tenant ${tenantId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * List available unallocated phone numbers from system pool
   *
   * Fetches available phone numbers from Twilio master account.
   * Used by admin to see what numbers can be allocated to tenants.
   *
   * @param areaCode - Optional area code filter (e.g., '212' for NYC)
   * @param limit - Maximum number of results (default: 20)
   * @returns Promise<AvailablePhoneNumber[]> - List of available numbers
   *
   * @example
   * const numbers = await service.getAvailablePhoneNumbers('415', 10);
   */
  async getAvailablePhoneNumbers(
    areaCode?: string,
    limit: number = 20,
  ): Promise<AvailablePhoneNumber[]> {
    this.logger.debug(
      `Fetching available phone numbers${areaCode ? ` for area code ${areaCode}` : ''}`,
    );

    try {
      // Load system provider
      const systemProvider = await this.loadSystemProvider();

      if (!systemProvider) {
        throw new BadRequestException('System Twilio provider not configured');
      }

      // Initialize Twilio client with system credentials
      const client = twilio(
        systemProvider.account_sid,
        systemProvider.auth_token,
      );

      // Build search options
      const searchOptions: any = {
        limit: Math.min(limit, 50), // Twilio API limit
      };

      if (areaCode) {
        searchOptions.areaCode = parseInt(areaCode, 10);
      }

      // Fetch available phone numbers from Twilio
      const availableNumbers = await client
        .availablePhoneNumbers('US')
        .local.list(searchOptions);

      // Transform to response format
      const numbers: AvailablePhoneNumber[] = availableNumbers.map((num) => ({
        phone_number: num.phoneNumber,
        friendly_name: num.friendlyName,
        locality: num.locality || '',
        region: num.region || '',
        postal_code: num.postalCode || '',
        capabilities: {
          voice: num.capabilities.voice || false,
          sms: num.capabilities.sms || false,
          mms: num.capabilities.mms || false,
        },
      }));

      this.logger.debug(`Found ${numbers.length} available phone numbers`);

      return numbers;
    } catch (error) {
      this.logger.error(
        'Failed to fetch available phone numbers:',
        error.message,
      );
      throw error;
    }
  }

  /**
   * Purchase phone number and allocate to tenant
   *
   * Purchases a phone number from Twilio and immediately allocates it to a tenant.
   *
   * @param tenantId - UUID of the tenant
   * @param phoneNumber - E.164 formatted phone number to purchase
   * @returns Promise<PurchasedPhoneNumber> - Purchased number details
   */
  async purchaseAndAllocatePhoneNumber(
    tenantId: string,
    phoneNumber: string,
  ): Promise<PurchasedPhoneNumber> {
    this.logger.log(
      `Purchasing phone number ${phoneNumber} for tenant ${tenantId}`,
    );

    try {
      // Load system provider
      const systemProvider = await this.loadSystemProvider();

      if (!systemProvider) {
        throw new BadRequestException('System Twilio provider not configured');
      }

      // Initialize Twilio client
      const client = twilio(
        systemProvider.account_sid,
        systemProvider.auth_token,
      );

      // Purchase phone number from Twilio
      const purchasedNumber = await client.incomingPhoneNumbers.create({
        phoneNumber: phoneNumber,
      });

      this.logger.log(
        `Phone number ${phoneNumber} purchased successfully (SID: ${purchasedNumber.sid})`,
      );

      // Allocate to tenant
      await this.allocatePhoneNumberToTenant(tenantId, phoneNumber);

      return {
        phone_number: purchasedNumber.phoneNumber,
        sid: purchasedNumber.sid,
        friendly_name: purchasedNumber.friendlyName,
        status: purchasedNumber.status,
        capabilities: {
          voice: purchasedNumber.capabilities.voice,
          sms: purchasedNumber.capabilities.sms,
          mms: purchasedNumber.capabilities.mms,
        },
        allocated_to_tenant: tenantId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to purchase phone number ${phoneNumber}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Update system provider configuration
   *
   * Updates master Twilio account credentials.
   * Use with caution - affects all Model B tenants.
   *
   * @param dto - Updated credentials
   * @returns Promise<void>
   */
  async updateSystemProviderConfig(dto: {
    account_sid: string;
    auth_token: string;
  }): Promise<void> {
    this.logger.warn('Updating system Twilio provider configuration');

    try {
      // Validate new credentials before updating
      const isValid = await this.validateTwilioCredentials(
        dto.account_sid,
        dto.auth_token,
      );

      if (!isValid) {
        throw new BadRequestException('Invalid Twilio credentials');
      }

      // Encrypt new credentials
      const encryptedCredentials = await this.encryptionService.encrypt(
        JSON.stringify({
          account_sid: dto.account_sid,
          auth_token: dto.auth_token,
        }),
      );

      // Update system provider (upsert to handle first-time configuration)
      await this.prisma.communication_provider.upsert({
        where: { provider_key: this.SYSTEM_PROVIDER_KEY },
        update: {
          credentials_schema: encryptedCredentials,
          is_active: true,
          updated_at: new Date(),
        },
        create: {
          id: uuidv4(),
          provider_key: this.SYSTEM_PROVIDER_KEY,
          provider_name: 'Twilio System Provider',
          provider_type: 'sms',
          credentials_schema: encryptedCredentials,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      this.logger.log('System Twilio provider updated successfully');
    } catch (error) {
      this.logger.error('Failed to update system provider:', error.message);
      throw error;
    }
  }

  /**
   * Test system provider connectivity
   *
   * Validates that system Twilio credentials are working.
   *
   * @returns Promise<ConnectivityTestResult> - Test result with response time
   */
  async testSystemProvider(): Promise<ConnectivityTestResult> {
    this.logger.log('Testing system Twilio provider connectivity');

    const startTime = Date.now();

    try {
      // Load system provider
      const systemProvider = await this.loadSystemProvider();

      if (!systemProvider) {
        return {
          status: 'FAILED',
          error_message: 'System Twilio provider not configured',
          response_time_ms: Date.now() - startTime,
        };
      }

      // Test Twilio API connection
      const client = twilio(
        systemProvider.account_sid,
        systemProvider.auth_token,
      );

      const account = await client.api
        .accounts(systemProvider.account_sid)
        .fetch();

      const responseTime = Date.now() - startTime;

      this.logger.log(
        `System provider connectivity test passed (${responseTime}ms)`,
      );

      return {
        status: 'SUCCESS',
        message: 'System provider is healthy',
        response_time_ms: responseTime,
        account_status: account.status,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      this.logger.error(
        'System provider connectivity test failed:',
        error.message,
      );

      return {
        status: 'FAILED',
        error_message: error.message,
        response_time_ms: responseTime,
      };
    }
  }

  /**
   * List all phone numbers owned in Twilio account
   *
   * Retrieves all phone numbers from Twilio API and matches them with
   * tenant allocations from the database.
   *
   * @returns Promise<OwnedPhoneNumber[]> - List of owned phone numbers with allocation status
   *
   * @example
   * const numbers = await service.listOwnedPhoneNumbers();
   * // Returns all phone numbers in Twilio account with tenant allocation info
   */
  async listOwnedPhoneNumbers(): Promise<OwnedPhoneNumber[]> {
    this.logger.log('Fetching all owned phone numbers from Twilio');

    try {
      // Load system provider
      const systemProvider = await this.loadSystemProvider();

      if (!systemProvider) {
        throw new BadRequestException(
          'System Twilio provider not configured - cannot list phone numbers',
        );
      }

      // Create Twilio client
      const client = twilio(
        systemProvider.account_sid,
        systemProvider.auth_token,
      );

      // Fetch all incoming phone numbers from Twilio
      const twilioNumbers = await client.incomingPhoneNumbers.list();

      this.logger.debug(
        `Fetched ${twilioNumbers.length} phone numbers from Twilio`,
      );

      // Fetch all tenant SMS and WhatsApp configs to match allocations
      const [smsConfigs, whatsappConfigs] = await Promise.all([
        this.prisma.tenant_sms_config.findMany({
          where: { is_active: true },
          select: {
            from_phone: true,
            tenant_id: true,
            tenant: {
              select: {
                id: true,
                company_name: true,
                subdomain: true,
              },
            },
          },
        }),
        this.prisma.tenant_whatsapp_config.findMany({
          where: { is_active: true },
          select: {
            from_phone: true,
            tenant_id: true,
            tenant: {
              select: {
                id: true,
                company_name: true,
                subdomain: true,
              },
            },
          },
        }),
      ]);

      // Create lookup maps for quick matching
      const smsAllocationMap = new Map(
        smsConfigs.map((config) => [config.from_phone, config]),
      );
      const whatsappAllocationMap = new Map(
        whatsappConfigs.map((config) => [config.from_phone, config]),
      );

      // Transform Twilio numbers and match with tenant allocations
      const ownedNumbers: OwnedPhoneNumber[] = twilioNumbers.map((num) => {
        const smsAllocation = smsAllocationMap.get(num.phoneNumber);
        const whatsappAllocation = whatsappAllocationMap.get(num.phoneNumber);

        // Determine allocation status
        let allocated_to_tenant: {
          id: string;
          company_name: string;
          subdomain: string;
        } | null = null;
        const allocated_for: string[] = [];

        if (smsAllocation) {
          allocated_to_tenant = {
            id: smsAllocation.tenant.id,
            company_name: smsAllocation.tenant.company_name,
            subdomain: smsAllocation.tenant.subdomain,
          };
          // Twilio phone numbers handle both SMS and Voice on the same number
          allocated_for.push('SMS', 'Voice');
        }

        if (whatsappAllocation) {
          if (!allocated_to_tenant) {
            allocated_to_tenant = {
              id: whatsappAllocation.tenant.id,
              company_name: whatsappAllocation.tenant.company_name,
              subdomain: whatsappAllocation.tenant.subdomain,
            };
          }
          allocated_for.push('WhatsApp');
        }

        return {
          sid: num.sid,
          phone_number: num.phoneNumber,
          friendly_name: num.friendlyName || num.phoneNumber,
          capabilities: {
            voice: num.capabilities?.voice || false,
            sms: num.capabilities?.sms || false,
            mms: num.capabilities?.mms || false,
          },
          status: allocated_to_tenant ? 'allocated' : 'available',
          allocated_to_tenant,
          allocated_for: allocated_for.length > 0 ? allocated_for : null,
          date_created: num.dateCreated,
          date_updated: num.dateUpdated,
        };
      });

      this.logger.log(
        `Processed ${ownedNumbers.length} phone numbers (${ownedNumbers.filter((n) => n.status === 'allocated').length} allocated, ${ownedNumbers.filter((n) => n.status === 'available').length} available)`,
      );

      return ownedNumbers;
    } catch (error) {
      this.logger.error('Failed to list owned phone numbers:', error.message);
      throw error;
    }
  }

  /**
   * Get system provider status
   *
   * Returns current system provider configuration (without sensitive credentials).
   *
   * @returns Promise<SystemProviderStatus> - Provider status and metadata
   */
  async getSystemProviderStatus(): Promise<SystemProviderStatus> {
    this.logger.debug('Fetching system provider status');

    try {
      const provider = await this.prisma.communication_provider.findUnique({
        where: { provider_key: this.SYSTEM_PROVIDER_KEY },
      });

      if (!provider) {
        return {
          configured: false,
          message: 'System Twilio provider not configured',
        };
      }

      // Count tenants using system provider (Model B tenants)
      const modelBTenantCount = await this.prisma.tenant_sms_config.count({
        where: {
          is_active: true,
          // System-allocated numbers use system credentials
          credentials: provider.credentials_schema as string,
        },
      });

      return {
        configured: true,
        is_active: provider.is_active,
        provider_name: provider.provider_name,
        created_at: provider.created_at,
        updated_at: provider.updated_at,
        model_b_tenant_count: modelBTenantCount,
      };
    } catch (error) {
      this.logger.error(
        'Failed to fetch system provider status:',
        error.message,
      );
      throw error;
    }
  }

  /**
   * Load system provider with decrypted credentials
   *
   * @private
   */
  private async loadSystemProvider(): Promise<{
    account_sid: string;
    auth_token: string;
    encrypted_credentials: string;
  } | null> {
    try {
      const provider = await this.prisma.communication_provider.findUnique({
        where: { provider_key: this.SYSTEM_PROVIDER_KEY },
      });

      if (!provider || !provider.is_active) {
        return null;
      }

      // Decrypt credentials
      const credentialsJson = await this.encryptionService.decrypt(
        provider.credentials_schema as string,
      );
      const credentials = JSON.parse(credentialsJson);

      return {
        account_sid: credentials.account_sid,
        auth_token: credentials.auth_token,
        encrypted_credentials: provider.credentials_schema as string,
      };
    } catch (error) {
      this.logger.error('Failed to load system provider:', error.message);
      return null;
    }
  }

  /**
   * Validate Twilio credentials by making API call
   *
   * @private
   */
  private async validateTwilioCredentials(
    accountSid: string,
    authToken: string,
  ): Promise<boolean> {
    try {
      const client = twilio(accountSid, authToken);
      await client.api.accounts(accountSid).fetch();
      return true;
    } catch (error) {
      this.logger.warn('Twilio credential validation failed:', error.message);
      return false;
    }
  }

  /**
   * Deallocate phone number from tenant
   *
   * Removes the allocation of a phone number from a tenant, making it available
   * for allocation to another tenant. Optionally deletes the tenant's config.
   *
   * @param sid - Phone number SID
   * @param deleteConfig - Whether to delete tenant's SMS/WhatsApp config
   * @param reason - Reason for deallocation (for audit trail)
   * @returns Promise<DeallocateResult>
   */
  async deallocatePhoneNumberFromTenant(
    sid: string,
    deleteConfig: boolean = false,
    reason?: string,
  ): Promise<DeallocateResult> {
    this.logger.log(`Deallocating phone number ${sid} from tenant`);

    try {
      // Resolve SID to actual phone number via Twilio API
      const systemProvider = await this.loadSystemProvider();
      if (!systemProvider) {
        throw new BadRequestException(
          'System Twilio provider not configured - cannot resolve phone number',
        );
      }
      const client = twilio(
        systemProvider.account_sid,
        systemProvider.auth_token,
      );
      const phoneNumberDetails = await client.incomingPhoneNumbers(sid).fetch();
      const phoneNumber = phoneNumberDetails.phoneNumber;
      this.logger.debug(`Resolved SID ${sid} to phone number ${phoneNumber}`);

      // Find configurations using this phone number
      const smsConfigs = await this.prisma.tenant_sms_config.findMany({
        where: { from_phone: phoneNumber },
        include: { tenant: true },
      });

      const whatsappConfigs = await this.prisma.tenant_whatsapp_config.findMany(
        {
          where: { from_phone: phoneNumber },
          include: { tenant: true },
        },
      );

      if (smsConfigs.length === 0 && whatsappConfigs.length === 0) {
        throw new NotFoundException(
          `No tenant allocation found for phone number SID: ${sid}`,
        );
      }

      let previousTenant: any = null;

      // Handle deallocation
      if (deleteConfig) {
        // Delete configurations
        await this.prisma.$transaction([
          this.prisma.tenant_sms_config.deleteMany({
            where: { from_phone: phoneNumber },
          }),
          this.prisma.tenant_whatsapp_config.deleteMany({
            where: { from_phone: phoneNumber },
          }),
        ]);

        previousTenant = smsConfigs[0]?.tenant || whatsappConfigs[0]?.tenant;
        this.logger.log('Tenant configurations deleted');
      } else {
        // Just mark as inactive
        await this.prisma.$transaction([
          this.prisma.tenant_sms_config.updateMany({
            where: { from_phone: phoneNumber },
            data: { is_active: false },
          }),
          this.prisma.tenant_whatsapp_config.updateMany({
            where: { from_phone: phoneNumber },
            data: { is_active: false },
          }),
        ]);

        previousTenant = smsConfigs[0]?.tenant || whatsappConfigs[0]?.tenant;
        this.logger.log('Tenant configurations deactivated');
      }

      return {
        deallocation_status: 'success',
        phone_number_sid: sid,
        previously_allocated_to: previousTenant?.company_name || 'Unknown',
        status: 'available',
        tenant_config_deleted: deleteConfig,
        reason: reason || 'Admin deallocation',
      };
    } catch (error) {
      this.logger.error('Failed to deallocate phone number:', error.message);
      this.logger.error('Error stack:', error.stack);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException(
        'Failed to deallocate phone number from tenant',
      );
    }
  }

  /**
   * Release phone number back to Twilio
   *
   * Releases a phone number from the Twilio account, canceling the subscription.
   * Phone number must be deallocated from all tenants first.
   *
   * WARNING: This is a DESTRUCTIVE operation - phone number cannot be recovered!
   *
   * @param sid - Phone number SID
   * @returns Promise<ReleaseResult>
   */
  async releasePhoneNumber(sid: string): Promise<ReleaseResult> {
    this.logger.log(`Releasing phone number ${sid} back to Twilio`);

    try {
      // Check if number is still allocated to any tenant
      const [smsCount, whatsappCount] = await Promise.all([
        this.prisma.tenant_sms_config.count({
          where: { from_phone: { contains: sid } },
        }),
        this.prisma.tenant_whatsapp_config.count({
          where: { from_phone: { contains: sid } },
        }),
      ]);

      if (smsCount > 0 || whatsappCount > 0) {
        throw new ConflictException(
          `Cannot release phone number ${sid} - still allocated to ${smsCount + whatsappCount} tenant configuration(s). Deallocate first.`,
        );
      }

      // Load system provider to get Twilio client
      const systemProvider = await this.loadSystemProvider();

      if (!systemProvider) {
        throw new BadRequestException(
          'System Twilio provider not configured. Cannot release phone number.',
        );
      }

      const twilioClient = twilio(
        systemProvider.account_sid,
        systemProvider.auth_token,
      );

      // Get phone number details before release
      let phoneNumber: string | null = null;
      try {
        const incomingPhoneNumber = await twilioClient
          .incomingPhoneNumbers(sid)
          .fetch();
        phoneNumber = incomingPhoneNumber.phoneNumber;
      } catch (error) {
        this.logger.warn(
          `Could not fetch phone number details: ${error.message}`,
        );
      }

      // Release phone number from Twilio
      await twilioClient.incomingPhoneNumbers(sid).remove();

      this.logger.log(
        `Phone number ${sid} released successfully from Twilio account`,
      );

      return {
        release_status: 'success',
        phone_number: phoneNumber || sid,
        released_at: new Date(),
        final_cost_impact: '-1.00', // Typical monthly cost per number
        message:
          'Phone number released successfully. It is no longer available.',
      };
    } catch (error) {
      this.logger.error('Failed to release phone number:', error.message);
      this.logger.error('Error stack:', error.stack);

      if (error instanceof ConflictException) {
        throw error;
      }

      if (error.code === 20404) {
        throw new NotFoundException(
          `Phone number ${sid} not found in Twilio account`,
        );
      }

      throw new BadRequestException('Failed to release phone number to Twilio');
    }
  }
}

/**
 * Type Definitions
 */

export interface SystemProvider {
  provider_key: string;
  provider_name: string;
  provider_type: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AvailablePhoneNumber {
  phone_number: string;
  friendly_name: string;
  locality: string;
  region: string;
  postal_code: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
}

export interface PurchasedPhoneNumber {
  phone_number: string;
  sid: string;
  friendly_name: string;
  status: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  allocated_to_tenant: string;
}

export interface ConnectivityTestResult {
  status: 'SUCCESS' | 'FAILED';
  message?: string;
  error_message?: string;
  response_time_ms: number;
  account_status?: string;
}

export interface SystemProviderStatus {
  configured: boolean;
  is_active?: boolean;
  provider_name?: string;
  created_at?: Date;
  updated_at?: Date;
  model_b_tenant_count?: number;
  message?: string;
}

export interface OwnedPhoneNumber {
  sid: string;
  phone_number: string;
  friendly_name: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  status: 'allocated' | 'available';
  allocated_to_tenant: {
    id: string;
    company_name: string;
    subdomain: string;
  } | null;
  allocated_for: string[] | null;
  date_created: Date;
  date_updated: Date;
}

export interface DeallocateResult {
  deallocation_status: 'success' | 'failed';
  phone_number_sid: string;
  previously_allocated_to: string;
  status: 'available';
  tenant_config_deleted: boolean;
  reason?: string;
}

export interface ReleaseResult {
  release_status: 'success' | 'failed';
  phone_number: string;
  released_at: Date;
  final_cost_impact: string;
  message: string;
}
