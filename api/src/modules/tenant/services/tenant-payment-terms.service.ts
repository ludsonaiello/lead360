import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { UpdatePaymentTermsDto, PaymentTermType } from '../dto/update-payment-terms.dto';

@Injectable()
export class TenantPaymentTermsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get payment terms for a tenant (creates default if not exists)
   */
  async findOrCreate(tenantId: string) {
    let paymentTerms = await this.prisma.tenantPaymentTerms.findUnique({
      where: { tenant_id: tenantId } as any,
    });

    // If no payment terms exist, create default (100% upfront)
    if (!paymentTerms) {
      paymentTerms = await this.prisma.tenantPaymentTerms.create({
        data: {
          tenant_id: tenantId,
          terms_json: [
            {
              sequence: 1,
              type: PaymentTermType.PERCENTAGE,
              amount: 100,
              description: 'Full payment upfront',
            },
          ],
        } as any,
      });
    }

    return paymentTerms;
  }

  /**
   * Update payment terms with comprehensive validation
   */
  async update(tenantId: string, updatePaymentTermsDto: UpdatePaymentTermsDto, userId: string) {
    // Validate sequence numbers are sequential (1, 2, 3, ...)
    const sequences = updatePaymentTermsDto.terms.map((t) => t.sequence).sort((a, b) => a - b);
    const expectedSequences = Array.from(
      { length: sequences.length } as any,
      (_, i) => i + 1,
    );

    if (JSON.stringify(sequences) !== JSON.stringify(expectedSequences)) {
      throw new BadRequestException(
        'Sequence numbers must be sequential starting from 1 (e.g., 1, 2, 3, ...)',
      );
    }

    // Check if all percentage terms sum to 100% (warning only, not error)
    const percentageTerms = updatePaymentTermsDto.terms.filter(
      (t) => t.type === PaymentTermType.PERCENTAGE,
    );
    const percentageSum = percentageTerms.reduce((sum, t) => sum + t.amount, 0);
    const hasPercentageWarning = percentageTerms.length > 0 && percentageSum !== 100;

    // Ensure payment terms record exists
    await this.findOrCreate(tenantId);

    const paymentTerms = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenantPaymentTerms.update({
        where: { tenant_id: tenantId } as any,
        data: {
          terms_json: updatePaymentTermsDto.terms,
        } as any,
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'UPDATE',
          entity_type: 'TenantPaymentTerms',
          entity_id: updated.id,
          metadata_json: { 
            updated: updatePaymentTermsDto,
            percentage_warning: hasPercentageWarning
              ? `Percentage terms sum to ${percentageSum}%, not 100%`
              : null,
          } as any,
        } as any,
      });

      return updated;
    });

    return {
      ...paymentTerms,
      validation: {
        percentage_sum: percentageSum,
        percentage_warning: hasPercentageWarning
          ? `Warning: Percentage terms sum to ${percentageSum}%, not 100%. This may cause calculation issues.`
          : null,
      } as any,
    };
  }

  /**
   * Get default payment term template (useful for UI)
   */
  getDefaultTemplate() {
    return {
      '50_25_25': [
        {
          sequence: 1,
          type: PaymentTermType.PERCENTAGE,
          amount: 50,
          description: 'Upfront deposit',
        } as any,
        {
          sequence: 2,
          type: PaymentTermType.PERCENTAGE,
          amount: 25,
          description: 'Upon permit approval',
        } as any,
        {
          sequence: 3,
          type: PaymentTermType.PERCENTAGE,
          amount: 25,
          description: 'Upon completion',
        } as any,
      ],
      '33_33_34': [
        {
          sequence: 1,
          type: PaymentTermType.PERCENTAGE,
          amount: 33,
          description: 'Upfront deposit',
        } as any,
        {
          sequence: 2,
          type: PaymentTermType.PERCENTAGE,
          amount: 33,
          description: 'Mid-project',
        } as any,
        {
          sequence: 3,
          type: PaymentTermType.PERCENTAGE,
          amount: 34,
          description: 'Upon completion',
        } as any,
      ],
      '100_upfront': [
        {
          sequence: 1,
          type: PaymentTermType.PERCENTAGE,
          amount: 100,
          description: 'Full payment upfront',
        } as any,
      ],
    };
  }
}
