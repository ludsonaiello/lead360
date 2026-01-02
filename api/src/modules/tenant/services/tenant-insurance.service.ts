import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { UpdateInsuranceDto } from '../dto/update-insurance.dto';

@Injectable()
export class TenantInsuranceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get insurance for a tenant (creates default record if not exists)
   */
  async findOrCreate(tenantId: string) {
    let insurance = await this.prisma.tenantInsurance.findUnique({
      where: { tenant_id: tenantId } as any,
    });

    // If no insurance record exists, create empty one
    if (!insurance) {
      insurance = await this.prisma.tenantInsurance.create({
        data: { tenant_id: tenantId } as any,
      });
    }

    return insurance;
  }

  /**
   * Update insurance information
   */
  async update(tenantId: string, updateInsuranceDto: UpdateInsuranceDto, userId: string) {
    // Ensure insurance record exists
    await this.findOrCreate(tenantId);

    const insurance = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenantInsurance.update({
        where: { tenant_id: tenantId } as any,
        data: updateInsuranceDto,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'UPDATE',
          entity_type: 'TenantInsurance',
          entity_id: updated.id,
          metadata_json: {  updated: updateInsuranceDto } as any,
        } as any,
      });

      return updated;
    });

    return insurance;
  }

  /**
   * Find insurance expiring within specified days (for background jobs)
   */
  async findExpiring(daysFromNow: number) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysFromNow);

    const startOfDay = new Date(expiryDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(expiryDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Find tenants with GL or WC insurance expiring on this date
    const expiringInsurance = await this.prisma.tenantInsurance.findMany({
      where: {
        OR: [
          {
            gl_expiry_date: {
              gte: startOfDay,
              lte: endOfDay,
            } as any,
          } as any,
          {
            wc_expiry_date: {
              gte: startOfDay,
              lte: endOfDay,
            } as any,
          } as any,
        ],
      } as any,
      include: {
        tenant: {
          select: {
            id: true,
            company_name: true,
            subdomain: true,
            primary_contact_email: true,
          } as any,
        } as any,
      } as any,
    });

    return expiringInsurance;
  }

  /**
   * Get insurance status (expired, expiring soon, or valid)
   */
  async getInsuranceStatus(tenantId: string) {
    const insurance = await this.findOrCreate(tenantId);
    const now = new Date();

    const calculateStatus = (expiryDate: Date | null) => {
      if (!expiryDate) return null;

      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      let status: 'expired' | 'expiring_soon' | 'valid';
      if (daysUntilExpiry < 0) {
        status = 'expired';
      } else if (daysUntilExpiry <= 30) {
        status = 'expiring_soon';
      } else {
        status = 'valid';
      }

      return { status, days_until_expiry: daysUntilExpiry };
    };

    return {
      insurance,
      gl_status: calculateStatus(insurance.gl_expiry_date),
      wc_status: calculateStatus(insurance.wc_expiry_date),
    };
  }

  /**
   * Check if both GL and WC insurance are valid
   */
  async checkCoverage(tenantId: string): Promise<{
    gl_covered: boolean;
    wc_covered: boolean;
    all_covered: boolean;
  }> {
    const insurance = await this.findOrCreate(tenantId);
    const now = new Date();

    const glCovered = insurance.gl_expiry_date
      ? new Date(insurance.gl_expiry_date) > now
      : false;
    const wcCovered = insurance.wc_expiry_date
      ? new Date(insurance.wc_expiry_date) > now
      : false;

    return {
      gl_covered: glCovered,
      wc_covered: wcCovered,
      all_covered: glCovered && wcCovered,
    };
  }
}
