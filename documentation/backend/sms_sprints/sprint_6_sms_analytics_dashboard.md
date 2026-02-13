# Sprint 6: SMS Analytics Dashboard (Backend)

**Priority:** 🟢 MEDIUM
**Estimated Effort:** 5-7 days
**Developer:** AI Developer #6
**Dependencies:** Sprints 1-5 (all SMS features)
**Assigned Date:** February 13, 2026

---

## ⚠️ CRITICAL INSTRUCTIONS

**REVIEW FIRST:**
1. Study `communication_event` table structure
2. Review existing analytics patterns in codebase
3. Understand aggregation queries in Prisma
4. Check existing admin analytics endpoints
5. Review date range filtering patterns
6. **YOUR DOCUMENTATION**
   - MUST BE SAVED AT documentation/backend/sms_sprints

**DO NOT:**
- Create real-time calculations (cache aggregations)
- Run expensive queries without indexes
- Skip tenant_id filtering
- Expose cross-tenant data to non-admins

---

## Objective

Build SMS analytics dashboard endpoints providing insights into SMS usage, delivery rates, costs, and trends.

## Requirements

### 1. Analytics Service

**File:** `api/src/modules/communication/services/sms-analytics.service.ts` (NEW)

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

export interface SmsAnalyticsSummary {
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  delivery_rate: number;
  total_cost: number;
  unique_recipients: number;
  opt_out_count: number;
}

export interface SmsAnalyticsTrend {
  date: string;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
}

@Injectable()
export class SmsAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get SMS summary for tenant
   * CRITICAL: Filter by tenant_id
   */
  async getSummary(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SmsAnalyticsSummary> {
    const where = {
      tenant_id: tenantId,
      channel: 'sms' as const,
      created_at: {
        gte: startDate,
        lte: endDate,
      },
    };

    const [events, optOutCount, uniqueRecipients] = await Promise.all([
      this.prisma.communication_event.findMany({
        where,
        select: {
          status: true,
          provider_metadata: true,  // Contains cost
        },
      }),
      this.prisma.lead.count({
        where: {
          tenant_id: tenantId,
          sms_opt_out: true,
        },
      }),
      this.prisma.communication_event.groupBy({
        by: ['to_phone'],
        where,
        _count: true,
      }),
    ]);

    const total_sent = events.filter((e) =>
      ['sent', 'delivered'].includes(e.status),
    ).length;

    const total_delivered = events.filter((e) => e.status === 'delivered').length;

    const total_failed = events.filter((e) => e.status === 'failed').length;

    const delivery_rate = total_sent > 0 ? (total_delivered / total_sent) * 100 : 0;

    // Calculate cost from provider_metadata
    const total_cost = events.reduce((sum, event) => {
      const metadata = event.provider_metadata as any;
      return sum + (parseFloat(metadata?.price) || 0);
    }, 0);

    return {
      total_sent,
      total_delivered,
      total_failed,
      delivery_rate: Math.round(delivery_rate * 100) / 100,
      total_cost: Math.round(total_cost * 100) / 100,
      unique_recipients: uniqueRecipients.length,
      opt_out_count: optOutCount,
    };
  }

  /**
   * Get daily SMS trends
   */
  async getTrends(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SmsAnalyticsTrend[]> {
    // Use raw SQL for date grouping (more efficient)
    const trends = await this.prisma.$queryRaw<any[]>`
      SELECT 
        DATE(created_at) as date,
        SUM(CASE WHEN status IN ('sent', 'delivered') THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
      FROM communication_event
      WHERE tenant_id = ${tenantId}
        AND channel = 'sms'
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    return trends.map((t) => ({
      date: t.date.toISOString().split('T')[0],
      sent_count: Number(t.sent_count),
      delivered_count: Number(t.delivered_count),
      failed_count: Number(t.failed_count),
    }));
  }

  /**
   * Get failure breakdown by error code
   */
  async getFailureBreakdown(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const failures = await this.prisma.communication_event.findMany({
      where: {
        tenant_id: tenantId,
        channel: 'sms',
        status: 'failed',
        created_at: { gte: startDate, lte: endDate },
      },
      select: {
        error_message: true,
        provider_metadata: true,
      },
    });

    // Group by error code
    const breakdown: Record<string, number> = {};
    failures.forEach((f) => {
      const metadata = f.provider_metadata as any;
      const errorCode = metadata?.errorCode || 'unknown';
      breakdown[errorCode] = (breakdown[errorCode] || 0) + 1;
    });

    return Object.entries(breakdown)
      .map(([error_code, count]) => ({ error_code, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get top recipients (most SMS'd Leads)
   */
  async getTopRecipients(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 10,
  ) {
    const topRecipients = await this.prisma.communication_event.groupBy({
      by: ['to_phone'],
      where: {
        tenant_id: tenantId,
        channel: 'sms',
        created_at: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    // Enrich with Lead data
    const recipientsWithLeads = await Promise.all(
      topRecipients.map(async (r) => {
        const lead = await this.prisma.lead.findFirst({
          where: {
            tenant_id: tenantId,
            phone: r.to_phone,
          },
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        });

        return {
          to_phone: r.to_phone,
          sms_count: r._count.id,
          lead,
        };
      }),
    );

    return recipientsWithLeads;
  }
}
```

---

### 2. Analytics Controller

**File:** `api/src/modules/communication/controllers/sms-analytics.controller.ts` (NEW)

```typescript
import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';
import { Roles } from '../../../core/auth/roles.decorator';
import { SmsAnalyticsService } from '../services/sms-analytics.service';

@Controller('communication/sms/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Owner', 'Admin', 'Manager')  // Read-only analytics
export class SmsAnalyticsController {
  constructor(private readonly analyticsService: SmsAnalyticsService) {}

  @Get('summary')
  async getSummary(
    @Req() req: any,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const tenantId = req.user.tenant_id;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return await this.analyticsService.getSummary(tenantId, start, end);
  }

  @Get('trends')
  async getTrends(
    @Req() req: any,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const tenantId = req.user.tenant_id;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return await this.analyticsService.getTrends(tenantId, start, end);
  }

  @Get('failures')
  async getFailureBreakdown(
    @Req() req: any,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const tenantId = req.user.tenant_id;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return await this.analyticsService.getFailureBreakdown(tenantId, start, end);
  }

  @Get('top-recipients')
  async getTopRecipients(
    @Req() req: any,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('limit') limit: number = 10,
  ) {
    const tenantId = req.user.tenant_id;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return await this.analyticsService.getTopRecipients(tenantId, start, end, limit);
  }
}
```

---

### 3. Admin Cross-Tenant Analytics

**File:** `api/src/modules/communication/controllers/admin/sms-analytics-admin.controller.ts`

```typescript
@Controller('admin/communication/sms/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SystemAdmin')
export class SmsAnalyticsAdminController {
  // Similar endpoints but with optional tenant_id filter
  // Aggregate across all tenants if no filter
}
```

---

## Testing

**Test 1: Summary**
- GET /sms/analytics/summary?start_date=2026-01-01&end_date=2026-02-13
- Verify: Correct counts, delivery rate, cost

**Test 2: Trends**
- GET /sms/analytics/trends
- Verify: Daily breakdown returned

**Test 3: Multi-Tenant Isolation**
- Request analytics as Tenant A
- Verify: Only Tenant A's data returned

---

## Acceptance Criteria

- [ ] SmsAnalyticsService implemented
- [ ] Summary endpoint works
- [ ] Trends endpoint works
- [ ] Failure breakdown works
- [ ] Top recipients works
- [ ] Multi-tenant isolation verified
- [ ] Admin cross-tenant analytics works
- [ ] All tests pass
- [ ] API documentation updated

---

**END OF SPRINT 6**
