import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { FilesService } from '../../files/files.service';
import { FileCategory } from '../../files/dto/upload-file.dto';
import { CreateCrewMemberDto } from '../dto/create-crew-member.dto';
import { UpdateCrewMemberDto } from '../dto/update-crew-member.dto';

const ALLOWED_REVEAL_FIELDS = [
  'ssn',
  'itin',
  'drivers_license_number',
  'bank_routing',
  'bank_account',
] as const;

type RevealField = (typeof ALLOWED_REVEAL_FIELDS)[number];

const ENCRYPTED_FIELD_MAP: Record<RevealField, string> = {
  ssn: 'ssn_encrypted',
  itin: 'itin_encrypted',
  drivers_license_number: 'drivers_license_number_encrypted',
  bank_routing: 'bank_routing_encrypted',
  bank_account: 'bank_account_encrypted',
};

@Injectable()
export class CrewMemberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly auditLoggerService: AuditLoggerService,
    private readonly filesService: FilesService,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    dto: CreateCrewMemberDto,
  ) {
    const encryptedData = this.encryptSensitiveFields(dto);

    const crewMember = await this.prisma.crew_member.create({
      data: {
        tenant_id: tenantId,
        created_by_user_id: userId,
        first_name: dto.first_name,
        last_name: dto.last_name,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        address_line1: dto.address_line1 ?? null,
        address_line2: dto.address_line2 ?? null,
        address_city: dto.address_city ?? null,
        address_state: dto.address_state ?? null,
        address_zip: dto.address_zip ?? null,
        date_of_birth: dto.date_of_birth
          ? new Date(dto.date_of_birth)
          : null,
        has_drivers_license: dto.has_drivers_license ?? null,
        default_hourly_rate: dto.default_hourly_rate ?? null,
        weekly_hours_schedule: dto.weekly_hours_schedule ?? null,
        overtime_enabled: dto.overtime_enabled ?? false,
        overtime_rate_multiplier: dto.overtime_rate_multiplier ?? null,
        default_payment_method: dto.default_payment_method ?? null,
        bank_name: dto.bank_name ?? null,
        venmo_handle: dto.venmo_handle ?? null,
        zelle_contact: dto.zelle_contact ?? null,
        notes: dto.notes ?? null,
        ...encryptedData,
      },
      include: { profile_photo: true },
    });

    const sanitizedAfter = {
      id: crewMember.id,
      first_name: crewMember.first_name,
      last_name: crewMember.last_name,
      email: crewMember.email,
      phone: crewMember.phone,
      is_active: crewMember.is_active,
    };

    await this.auditLoggerService.logTenantChange({
      action: 'created',
      entityType: 'crew_member',
      entityId: crewMember.id,
      tenantId,
      actorUserId: userId,
      after: sanitizedAfter,
      description: `Created crew member: ${crewMember.first_name} ${crewMember.last_name}`,
    });

    return this.maskResponse(crewMember);
  }

  async findAll(
    tenantId: string,
    query: {
      page?: number;
      limit?: number;
      is_active?: boolean;
      search?: string;
    } = {},
  ) {
    let page = query.page ?? 1;
    let limit = query.limit ?? 20;
    if (page < 1) page = 1;
    if (limit > 100) limit = 100;
    if (limit < 1) limit = 1;

    const skip = (page - 1) * limit;

    const where: any = { tenant_id: tenantId };

    if (query.is_active !== undefined) {
      where.is_active = query.is_active;
    }

    if (query.search) {
      where.OR = [
        { first_name: { contains: query.search } },
        { last_name: { contains: query.search } },
        { email: { contains: query.search } },
        { phone: { contains: query.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.crew_member.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { profile_photo: true },
      }),
      this.prisma.crew_member.count({ where }),
    ]);

    const maskedData = data.map((member) => this.maskResponse(member));

    return {
      data: maskedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const crewMember = await this.prisma.crew_member.findFirst({
      where: { id, tenant_id: tenantId },
      include: { profile_photo: true },
    });

    if (!crewMember) {
      throw new NotFoundException('Crew member not found');
    }

    return this.maskResponse(crewMember);
  }

  async update(
    tenantId: string,
    id: string,
    userId: string,
    dto: UpdateCrewMemberDto,
  ) {
    const existing = await this.prisma.crew_member.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Crew member not found');
    }

    const encryptedData = this.encryptSensitiveFields(dto);

    const updateData: any = {};

    // Only set non-sensitive fields that are explicitly provided
    const directFields = [
      'first_name',
      'last_name',
      'email',
      'phone',
      'address_line1',
      'address_line2',
      'address_city',
      'address_state',
      'address_zip',
      'has_drivers_license',
      'default_hourly_rate',
      'weekly_hours_schedule',
      'overtime_enabled',
      'overtime_rate_multiplier',
      'default_payment_method',
      'bank_name',
      'venmo_handle',
      'zelle_contact',
      'notes',
      'is_active',
    ] as const;

    for (const field of directFields) {
      if (dto[field] !== undefined) {
        updateData[field] = dto[field];
      }
    }

    if (dto.date_of_birth !== undefined) {
      updateData.date_of_birth = dto.date_of_birth
        ? new Date(dto.date_of_birth)
        : null;
    }

    // Merge encrypted fields
    Object.assign(updateData, encryptedData);

    const updated = await this.prisma.crew_member.update({
      where: { id },
      data: updateData,
      include: { profile_photo: true },
    });

    const sanitizedBefore = {
      id: existing.id,
      first_name: existing.first_name,
      last_name: existing.last_name,
      email: existing.email,
      phone: existing.phone,
      is_active: existing.is_active,
    };
    const sanitizedAfter = {
      id: updated.id,
      first_name: updated.first_name,
      last_name: updated.last_name,
      email: updated.email,
      phone: updated.phone,
      is_active: updated.is_active,
    };

    await this.auditLoggerService.logTenantChange({
      action: 'updated',
      entityType: 'crew_member',
      entityId: id,
      tenantId,
      actorUserId: userId,
      before: sanitizedBefore,
      after: sanitizedAfter,
      description: `Updated crew member: ${updated.first_name} ${updated.last_name}`,
    });

    return this.maskResponse(updated);
  }

  async softDelete(tenantId: string, id: string, userId: string) {
    const existing = await this.prisma.crew_member.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Crew member not found');
    }

    await this.prisma.crew_member.update({
      where: { id },
      data: { is_active: false },
    });

    await this.auditLoggerService.logTenantChange({
      action: 'deleted',
      entityType: 'crew_member',
      entityId: id,
      tenantId,
      actorUserId: userId,
      before: {
        id: existing.id,
        first_name: existing.first_name,
        last_name: existing.last_name,
        is_active: true,
      },
      description: `Soft-deleted crew member: ${existing.first_name} ${existing.last_name}`,
    });
  }

  async revealField(
    tenantId: string,
    id: string,
    userId: string,
    field: string,
  ): Promise<{ field: string; value: string }> {
    if (!ALLOWED_REVEAL_FIELDS.includes(field as RevealField)) {
      throw new BadRequestException(
        `Field '${field}' is not revealable. Allowed: ${ALLOWED_REVEAL_FIELDS.join(', ')}`,
      );
    }

    const crewMember = await this.prisma.crew_member.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!crewMember) {
      throw new NotFoundException('Crew member not found');
    }

    const encryptedColumn = ENCRYPTED_FIELD_MAP[field as RevealField];
    const encryptedValue = crewMember[encryptedColumn];

    if (!encryptedValue) {
      throw new NotFoundException(
        `Field '${field}' has no value for this crew member`,
      );
    }

    const decrypted = this.encryptionService.decrypt(encryptedValue as string);

    // Audit log using generic log() since logTenantChange doesn't support 'accessed' action
    await this.auditLoggerService.log({
      tenant_id: tenantId,
      actor_user_id: userId,
      actor_type: 'user',
      entity_type: 'crew_member',
      entity_id: id,
      action_type: 'accessed',
      description: `Revealed ${field} for crew member ${id}`,
      metadata_json: {
        field_revealed: field,
        timestamp: new Date().toISOString(),
      },
      status: 'success',
    });

    return { field, value: decrypted };
  }

  async uploadProfilePhoto(
    tenantId: string,
    crewMemberId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    const crewMember = await this.prisma.crew_member.findFirst({
      where: { id: crewMemberId, tenant_id: tenantId },
    });

    if (!crewMember) {
      throw new NotFoundException('Crew member not found');
    }

    const result = await this.filesService.uploadFile(tenantId, userId, file, {
      category: FileCategory.PHOTO,
      entity_type: 'crew_member',
      entity_id: crewMemberId,
    });

    const updated = await this.prisma.crew_member.update({
      where: { id: crewMemberId },
      data: { profile_photo_file_id: result.file.file_id },
      include: { profile_photo: true },
    });

    return this.maskResponse(updated);
  }

  async deleteProfilePhoto(
    tenantId: string,
    crewMemberId: string,
    userId: string,
  ) {
    const crewMember = await this.prisma.crew_member.findFirst({
      where: { id: crewMemberId, tenant_id: tenantId },
    });

    if (!crewMember) {
      throw new NotFoundException('Crew member not found');
    }

    if (!crewMember.profile_photo_file_id) {
      throw new NotFoundException('Crew member has no profile photo');
    }

    // Remove from storage
    await this.filesService.delete(
      tenantId,
      crewMember.profile_photo_file_id,
      userId,
    );

    // Clear the FK on the crew member
    await this.prisma.crew_member.update({
      where: { id: crewMemberId },
      data: { profile_photo_file_id: null },
    });

    await this.auditLoggerService.logTenantChange({
      action: 'updated',
      entityType: 'crew_member',
      entityId: crewMemberId,
      tenantId,
      actorUserId: userId,
      description: `Deleted profile photo for crew member: ${crewMember.first_name} ${crewMember.last_name}`,
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private encryptSensitiveFields(
    dto: Partial<CreateCrewMemberDto>,
  ): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};

    if (dto.ssn !== undefined) {
      result.ssn_encrypted = dto.ssn
        ? this.encryptionService.encrypt(dto.ssn)
        : undefined;
    }
    if (dto.itin !== undefined) {
      result.itin_encrypted = dto.itin
        ? this.encryptionService.encrypt(dto.itin)
        : undefined;
    }
    if (dto.drivers_license_number !== undefined) {
      result.drivers_license_number_encrypted = dto.drivers_license_number
        ? this.encryptionService.encrypt(dto.drivers_license_number)
        : undefined;
    }
    if (dto.bank_routing_number !== undefined) {
      result.bank_routing_encrypted = dto.bank_routing_number
        ? this.encryptionService.encrypt(dto.bank_routing_number)
        : undefined;
    }
    if (dto.bank_account_number !== undefined) {
      result.bank_account_encrypted = dto.bank_account_number
        ? this.encryptionService.encrypt(dto.bank_account_number)
        : undefined;
    }

    return result;
  }

  private maskResponse(crewMember: any): any {
    const response: any = {
      id: crewMember.id,
      tenant_id: crewMember.tenant_id,
      first_name: crewMember.first_name,
      last_name: crewMember.last_name,
      email: crewMember.email,
      phone: crewMember.phone,
      address_line1: crewMember.address_line1,
      address_line2: crewMember.address_line2,
      address_city: crewMember.address_city,
      address_state: crewMember.address_state,
      address_zip: crewMember.address_zip,
      date_of_birth: crewMember.date_of_birth
        ? crewMember.date_of_birth.toISOString().split('T')[0]
        : null,
    };

    // Mask SSN
    if (crewMember.ssn_encrypted) {
      const decrypted = this.encryptionService.decrypt(
        crewMember.ssn_encrypted,
      );
      const last4 = decrypted.replace(/\D/g, '').slice(-4);
      response.ssn_masked = `***-**-${last4}`;
      response.has_ssn = true;
    } else {
      response.ssn_masked = null;
      response.has_ssn = false;
    }

    // Mask ITIN
    if (crewMember.itin_encrypted) {
      const decrypted = this.encryptionService.decrypt(
        crewMember.itin_encrypted,
      );
      const last4 = decrypted.replace(/\D/g, '').slice(-4);
      response.itin_masked = `***-**-${last4}`;
      response.has_itin = true;
    } else {
      response.itin_masked = null;
      response.has_itin = false;
    }

    response.has_drivers_license = crewMember.has_drivers_license;

    // Mask drivers license
    if (crewMember.drivers_license_number_encrypted) {
      const decrypted = this.encryptionService.decrypt(
        crewMember.drivers_license_number_encrypted,
      );
      const last4 = decrypted.slice(-4);
      response.drivers_license_masked = `****${last4}`;
      response.has_drivers_license_number = true;
    } else {
      response.drivers_license_masked = null;
      response.has_drivers_license_number = false;
    }

    response.default_hourly_rate = crewMember.default_hourly_rate
      ? Number(crewMember.default_hourly_rate)
      : null;
    response.weekly_hours_schedule = crewMember.weekly_hours_schedule;
    response.overtime_enabled = crewMember.overtime_enabled;
    response.overtime_rate_multiplier = crewMember.overtime_rate_multiplier
      ? Number(crewMember.overtime_rate_multiplier)
      : null;
    response.default_payment_method = crewMember.default_payment_method;
    response.bank_name = crewMember.bank_name;

    // Mask bank routing
    if (crewMember.bank_routing_encrypted) {
      const decrypted = this.encryptionService.decrypt(
        crewMember.bank_routing_encrypted,
      );
      const last4 = decrypted.slice(-4);
      response.bank_routing_masked = `****${last4}`;
      response.has_bank_routing = true;
    } else {
      response.bank_routing_masked = null;
      response.has_bank_routing = false;
    }

    // Mask bank account
    if (crewMember.bank_account_encrypted) {
      const decrypted = this.encryptionService.decrypt(
        crewMember.bank_account_encrypted,
      );
      const last4 = decrypted.slice(-4);
      response.bank_account_masked = `****${last4}`;
      response.has_bank_account = true;
    } else {
      response.bank_account_masked = null;
      response.has_bank_account = false;
    }

    response.venmo_handle = crewMember.venmo_handle;
    response.zelle_contact = crewMember.zelle_contact;

    // Resolve profile photo URL from the included relation
    response.profile_photo_url = crewMember.profile_photo
      ? crewMember.profile_photo.storage_path
      : null;

    response.notes = crewMember.notes;
    response.is_active = crewMember.is_active;
    response.created_by_user_id = crewMember.created_by_user_id;
    response.created_at = crewMember.created_at;
    response.updated_at = crewMember.updated_at;

    return response;
  }
}
