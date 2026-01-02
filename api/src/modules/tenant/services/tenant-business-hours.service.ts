import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { UpdateBusinessHoursDto } from '../dto/update-business-hours.dto';
import { CreateCustomHoursDto } from '../dto/create-custom-hours.dto';
import { UpdateCustomHoursDto } from '../dto/update-custom-hours.dto';

@Injectable()
export class TenantBusinessHoursService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get business hours for a tenant (creates default if not exists)
   */
  async findOrCreate(tenantId: string) {
    let businessHours = await this.prisma.tenantBusinessHours.findUnique({
      where: { tenant_id: tenantId } as any,
    });

    // If no business hours exist, create default (Mon-Fri 9-5)
    if (!businessHours) {
      businessHours = await this.prisma.tenantBusinessHours.create({
        data: {
          tenant_id: tenantId,
          monday_closed: false,
          monday_open1: '09:00',
          monday_close1: '17:00',
          tuesday_closed: false,
          tuesday_open1: '09:00',
          tuesday_close1: '17:00',
          wednesday_closed: false,
          wednesday_open1: '09:00',
          wednesday_close1: '17:00',
          thursday_closed: false,
          thursday_open1: '09:00',
          thursday_close1: '17:00',
          friday_closed: false,
          friday_open1: '09:00',
          friday_close1: '17:00',
          saturday_closed: true,
          sunday_closed: true,
        } as any,
      });
    }

    return businessHours;
  }

  /**
   * Validate time logic: open1 < close1, close1 < open2, open2 < close2
   */
  private validateTimeLogic(updateDto: UpdateBusinessHoursDto): void {
    const days = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ];

    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    for (const day of days) {
      const isClosed = updateDto[`${day}_closed`];
      const open1 = updateDto[`${day}_open1`];
      const close1 = updateDto[`${day}_close1`];
      const open2 = updateDto[`${day}_open2`];
      const close2 = updateDto[`${day}_close2`];

      // Skip validation if day is closed
      if (isClosed === true) continue;

      // If day is open, open1 and close1 are required
      if (isClosed === false && (!open1 || !close1)) {
        throw new BadRequestException(
          `${day}: Opening time 1 and closing time 1 are required when day is open`,
        );
      }

      // Validate open1 < close1
      if (open1 && close1) {
        if (timeToMinutes(open1) >= timeToMinutes(close1)) {
          throw new BadRequestException(
            `${day}: Opening time 1 must be before closing time 1`,
          );
        }
      }

      // If second shift exists, validate it
      if (open2 || close2) {
        if (!open2 || !close2) {
          throw new BadRequestException(
            `${day}: Both opening time 2 and closing time 2 are required for second shift`,
          );
        }

        // Validate close1 < open2
        if (close1 && open2) {
          if (timeToMinutes(close1) >= timeToMinutes(open2)) {
            throw new BadRequestException(
              `${day}: Closing time 1 must be before opening time 2 (lunch break required)`,
            );
          }
        }

        // Validate open2 < close2
        if (timeToMinutes(open2) >= timeToMinutes(close2)) {
          throw new BadRequestException(
            `${day}: Opening time 2 must be before closing time 2`,
          );
        }
      }
    }
  }

  /**
   * Update business hours with time validation
   */
  async update(tenantId: string, updateDto: UpdateBusinessHoursDto, userId: string) {
    // Validate time logic
    this.validateTimeLogic(updateDto);

    // Ensure business hours record exists
    await this.findOrCreate(tenantId);

    const businessHours = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenantBusinessHours.update({
        where: { tenant_id: tenantId } as any,
        data: updateDto,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'UPDATE',
          entity_type: 'TenantBusinessHours',
          entity_id: updated.id,
          metadata_json: {  updated: updateDto } as any,
        } as any,
      });

      return updated;
    });

    return businessHours;
  }

  /**
   * Get all custom hours (holidays, special dates) for a tenant
   */
  async findAllCustomHours(tenantId: string) {
    return this.prisma.tenantCustomHours.findMany({
      where: { tenant_id: tenantId } as any,
      orderBy: { date: 'asc' } as any,
    });
  }

  /**
   * Get custom hours for a specific date
   */
  async findCustomHoursByDate(tenantId: string, date: string) {
    return this.prisma.tenantCustomHours.findFirst({
      where: {
        tenant_id: tenantId,
        date: new Date(date),
      } as any,
    });
  }

  /**
   * Create custom hours for a special date
   */
  async createCustomHours(tenantId: string, createDto: CreateCustomHoursDto, userId: string) {
    // Check if custom hours already exist for this date
    const existing = await this.findCustomHoursByDate(tenantId, createDto.date);
    if (existing) {
      throw new BadRequestException(
        `Custom hours already exist for ${createDto.date}. Use update instead.`,
      );
    }

    // Validate time logic if not closed
    if (!createDto.closed) {
      if (!createDto.open1 || !createDto.close1) {
        throw new BadRequestException(
          'Opening time 1 and closing time 1 are required when not closed',
        );
      }

      const timeToMinutes = (time: string): number => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
      };

      if (timeToMinutes(createDto.open1) >= timeToMinutes(createDto.close1)) {
        throw new BadRequestException('Opening time 1 must be before closing time 1');
      }

      if (createDto.open2 && createDto.close2) {
        if (timeToMinutes(createDto.close1) >= timeToMinutes(createDto.open2)) {
          throw new BadRequestException(
            'Closing time 1 must be before opening time 2',
          );
        }
        if (timeToMinutes(createDto.open2) >= timeToMinutes(createDto.close2)) {
          throw new BadRequestException('Opening time 2 must be before closing time 2');
        }
      }
    }

    const customHours = await this.prisma.$transaction(async (tx) => {
      const newCustomHours = await tx.tenantCustomHours.create({
        data: {
          tenant_id: tenantId,
          ...createDto,
          date: new Date(createDto.date),
        } as any,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'CREATE',
          entity_type: 'TenantCustomHours',
          entity_id: newCustomHours.id,
          metadata_json: {  created: createDto } as any,
        } as any,
      });

      return newCustomHours;
    });

    return customHours;
  }

  /**
   * Update custom hours
   */
  async updateCustomHours(
    tenantId: string,
    customHoursId: string,
    updateDto: UpdateCustomHoursDto,
    userId: string,
  ) {
    // Verify custom hours exist and belong to tenant
    const existing = await this.prisma.tenantCustomHours.findFirst({
      where: {
        id: customHoursId,
        tenant_id: tenantId,
      } as any,
    });

    if (!existing) {
      throw new NotFoundException('Custom hours not found');
    }

    const customHours = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenantCustomHours.update({
        where: { id: customHoursId } as any,
        data: updateDto,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'UPDATE',
          entity_type: 'TenantCustomHours',
          entity_id: customHoursId,
          metadata_json: { 
            old: existing,
            new: updateDto,
          } as any,
        } as any,
      });

      return updated;
    });

    return customHours;
  }

  /**
   * Delete custom hours
   */
  async deleteCustomHours(tenantId: string, customHoursId: string, userId: string) {
    // Verify custom hours exist and belong to tenant
    const existing = await this.prisma.tenantCustomHours.findFirst({
      where: {
        id: customHoursId,
        tenant_id: tenantId,
      } as any,
    });

    if (!existing) {
      throw new NotFoundException('Custom hours not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tenantCustomHours.delete({
        where: { id: customHoursId } as any,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'DELETE',
          entity_type: 'TenantCustomHours',
          entity_id: customHoursId,
          metadata_json: {  deleted: existing } as any,
        } as any,
      });
    });

    return { message: 'Custom hours deleted successfully' };
  }
}
