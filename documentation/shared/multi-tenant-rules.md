# Multi-Tenant Isolation Rules

**Platform**: Lead360 Multi-Tenant SaaS CRM/ERP  
**Criticality**: ABSOLUTE - Violations = Data Breach  
**Applies To**: Backend Agent, Frontend Agent, All Modules

---

## The Golden Rule

**Every database query MUST include `tenant_id` filter.**

**No exceptions. No shortcuts. No "it's just a quick query."**

A single missing `tenant_id` filter = complete platform compromise = cross-tenant data exposure.

---

## What is Multi-Tenancy?

Lead360 serves multiple businesses (tenants) from a single application and database. Each business must:
- See ONLY their own data
- Never access another business's data
- Operate in complete isolation

**Think of it like apartment buildings**: Each business has their own apartment. They should never be able to open another tenant's door.

---

## Tenant Identification

### **How Tenants Are Identified**

**1. In the Database**:
- Every business-owned table has a `tenant_id` column (UUID)
- This column links the row to a specific business

**2. In the Application**:
- Extracted from JWT token payload: `{ userId, tenantId, roles, ... }`
- Never sent by client in request body
- Never trusted from client

**3. Via Subdomain** (for public customer portals):
- `https://acmeplumbing.lead360.app` → tenant slug: `acmeplumbing`
- Slug resolved to `tenant_id` via database lookup
- Only for public-facing portal, not admin app

---

## Database Schema Requirements

### **Tables That MUST Have `tenant_id`**

All tables that store business data:
- ✅ Leads, Customers
- ✅ Addresses
- ✅ Service Requests
- ✅ Quotes, Quote Items
- ✅ Projects, Tasks
- ✅ Invoices, Payments, Credits
- ✅ Financial Entries
- ✅ Time Clock Events
- ✅ Communication Events (calls, SMS, emails)
- ✅ Users (users belong to tenants)
- ✅ Files/Attachments

### **Tables That DO NOT Need `tenant_id`**

System/global tables:
- ❌ Tenants table itself
- ❌ System configuration
- ❌ Audit logs (stores tenant_id as data, not filter)

---

## Backend Implementation Rules

### **Rule 1: Always Filter by `tenant_id`**

**Every Prisma query MUST include tenant filter**:

```typescript
// ✅ CORRECT
const leads = await prisma.lead.findMany({
  where: {
    tenant_id: tenantId,  // ALWAYS include this
    status: 'NEW',
  },
});

// ❌ WRONG - Missing tenant_id
const leads = await prisma.lead.findMany({
  where: {
    status: 'NEW',  // This will return ALL tenants' leads!
  },
});
```

**No exceptions, even for:**
- Count queries
- Exists checks
- Single record lookups
- Soft deletes
- Updates
- Deletes

---

### **Rule 2: Extract `tenant_id` from JWT (Backend)**

**NEVER accept `tenant_id` from client**:

```typescript
// ✅ CORRECT - Extract from authenticated user
@Post()
async create(
  @Body() dto: CreateLeadDto,  // NO tenant_id in DTO
  @TenantId() tenantId: string,  // From JWT via decorator
) {
  return this.service.create(tenantId, dto);
}

// ❌ WRONG - Accepting tenant_id from client
@Post()
async create(@Body() dto: CreateLeadDto) {
  return this.service.create(dto.tenant_id, dto);  // Client can fake this!
}
```

**Custom Decorator Pattern**:
```typescript
// src/core/decorators/tenant-id.decorator.ts
export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user.tenantId;  // From JWT payload
  },
);
```

---

### **Rule 3: Use Middleware/Guard for Tenant Resolution**

**Tenant Middleware** (runs on every request):
```typescript
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Extract tenant from JWT
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      throw new UnauthorizedException('No tenant context');
    }
    
    // Attach to request for easy access
    req.tenantId = tenantId;
    next();
  }
}
```

---

### **Rule 4: Prisma Middleware for Global Enforcement**

**RECOMMENDED**: Add Prisma middleware to catch missing `tenant_id`:

```typescript
// src/core/prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
    
    // Global tenant enforcement
    this.$use(async (params, next) => {
      // List of models that require tenant_id
      const TENANT_SCOPED_MODELS = [
        'Lead', 'Address', 'ServiceRequest', 'Quote', 'Project', 
        'Invoice', 'Payment', 'FinancialEntry', 'TimeClockEvent',
        'CommunicationEvent', 'User', 'File',
      ];
      
      if (TENANT_SCOPED_MODELS.includes(params.model)) {
        // Check if query includes tenant_id
        if (!params.args.where?.tenant_id) {
          throw new Error(
            `SECURITY: Missing tenant_id in ${params.action} for ${params.model}`
          );
        }
      }
      
      return next(params);
    });
  }
}
```

**This catches errors before they become data breaches.**

---

### **Rule 5: Composite Indexes for Performance**

**Always create composite indexes with `tenant_id` first**:

```prisma
model Lead {
  id         String   @id @default(uuid())
  tenant_id  String
  status     String
  created_at DateTime @default(now())
  
  @@index([tenant_id, created_at])  // Most common: chronological
  @@index([tenant_id, status])      // Filter by status
  @@index([tenant_id, phone])       // Unique phone per tenant
}
```

**Why `tenant_id` first?**
- Database can quickly filter to single tenant
- Then apply additional filters
- Massive performance improvement

---

## Frontend Implementation Rules

### **Rule 1: NEVER Send `tenant_id` from Client**

**Frontend NEVER includes `tenant_id` in requests**:

```typescript
// ✅ CORRECT - No tenant_id
const response = await fetch('/api/v1/leads', {
  method: 'POST',
  body: JSON.stringify({
    name: 'John Smith',
    phone: '5551234567',
    // NO tenant_id here
  }),
});

// ❌ WRONG - Sending tenant_id
const response = await fetch('/api/v1/leads', {
  method: 'POST',
  body: JSON.stringify({
    tenant_id: 'some-uuid',  // NEVER do this - security risk
    name: 'John Smith',
  }),
});
```

**Why?** Client can fake any `tenant_id` and access other tenants' data.

---

### **Rule 2: Trust Backend for Tenant Scoping**

Frontend assumes:
- Backend automatically filters by tenant
- All returned data belongs to current tenant
- No manual tenant filtering needed client-side

---

### **Rule 3: Tenant Context from Subdomain (Portal Only)**

**For customer portals** (`https://{tenant}.lead360.app`):

```typescript
// Middleware extracts tenant from subdomain
// middleware.ts
export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const subdomain = hostname.split('.')[0];
  
  // NOT a reserved subdomain
  if (!['app', 'api', 'www'].includes(subdomain)) {
    // This is a tenant subdomain
    const response = NextResponse.next();
    response.headers.set('x-tenant-slug', subdomain);
    return response;
  }
}
```

**Backend resolves slug to `tenant_id`**:
```typescript
// Backend converts slug → tenant_id
const tenant = await prisma.tenant.findUnique({
  where: { slug: tenantSlug },
});

// Then uses tenant.id for queries
```

---

## Testing Requirements

### **Tenant Isolation Tests (MANDATORY)**

**Every module MUST have tests that verify**:

**Test 1: Cannot Access Other Tenant's Data**
```typescript
it('should not return leads from other tenants', async () => {
  // Create lead for tenant A
  const leadA = await createLead({ tenant_id: 'tenant-a' });
  
  // Create lead for tenant B
  const leadB = await createLead({ tenant_id: 'tenant-b' });
  
  // Query as tenant A
  const result = await service.findAll('tenant-a');
  
  // Should only see tenant A's lead
  expect(result).toHaveLength(1);
  expect(result[0].id).toBe(leadA.id);
  expect(result).not.toContainEqual(expect.objectContaining({ id: leadB.id }));
});
```

**Test 2: Cannot Update Other Tenant's Data**
```typescript
it('should not update leads from other tenants', async () => {
  const lead = await createLead({ tenant_id: 'tenant-a' });
  
  // Try to update as tenant B
  await expect(
    service.update('tenant-b', lead.id, { name: 'Hacked' })
  ).rejects.toThrow(NotFoundException);
});
```

**Test 3: Cannot Delete Other Tenant's Data**
```typescript
it('should not delete leads from other tenants', async () => {
  const lead = await createLead({ tenant_id: 'tenant-a' });
  
  // Try to delete as tenant B
  await expect(
    service.delete('tenant-b', lead.id)
  ).rejects.toThrow(NotFoundException);
});
```

**These tests MUST pass before module is complete.**

---

## Common Pitfalls & How to Avoid

### **Pitfall 1: Forgetting `tenant_id` in WHERE clause**

**Problem**:
```typescript
const lead = await prisma.lead.findUnique({
  where: { id: leadId },  // Missing tenant_id
});
```

**Solution**: Use Prisma middleware (Rule 4) to catch this automatically.

---

### **Pitfall 2: Accepting `tenant_id` from Client**

**Problem**:
```typescript
@Post()
create(@Body() dto: CreateLeadDto) {
  // dto.tenant_id came from client - attacker can set this
}
```

**Solution**: Extract from JWT, never from request body.

---

### **Pitfall 3: Admin/Superadmin Cross-Tenant Access**

**Problem**: "We need admin to see all tenants."

**Solution**: 
- DO NOT build cross-tenant queries in main app
- Build separate admin console with explicit safeguards
- Require separate authentication
- Log all cross-tenant access

**For MVP**: No cross-tenant access at all.

---

### **Pitfall 4: Forgetting Tenant in Related Queries**

**Problem**:
```typescript
const lead = await prisma.lead.findUnique({
  where: { id: leadId, tenant_id: tenantId },  // Good
  include: {
    addresses: true,  // BAD - doesn't filter addresses by tenant
  },
});
```

**Solution**: Relations inherit tenant via foreign key, but be explicit:
```typescript
const lead = await prisma.lead.findUnique({
  where: { id: leadId, tenant_id: tenantId },
  include: {
    addresses: {
      where: { tenant_id: tenantId },  // Explicit
    },
  },
});
```

Or ensure foreign key relationship guarantees data integrity.

---

## Emergency Response Protocol

### **If Tenant Isolation Bug is Discovered**

**IMMEDIATE ACTIONS**:

1. **STOP ALL DEVELOPMENT** immediately
2. **Document the bug** in detail:
   - Which endpoint?
   - Which queries?
   - How many records exposed?
3. **Assess blast radius**:
   - Which tenants affected?
   - What data was exposed?
   - Was data modified?
4. **Notify human operator** immediately
5. **Rollback to last known good state**
6. **Add test to prevent recurrence**
7. **Review all similar code patterns**

**Never deploy with known tenant isolation bugs.**

---

## Checklist for Every Module

Before marking any module complete, verify:

- [ ] All tables have `tenant_id` column (if business data)
- [ ] All queries include `tenant_id` filter
- [ ] `tenant_id` extracted from JWT (backend)
- [ ] `tenant_id` NEVER accepted from client
- [ ] Composite indexes created with `tenant_id` first
- [ ] Prisma middleware enforces tenant filtering
- [ ] Tenant isolation tests written and passing
- [ ] Cannot access other tenant's data (tested)
- [ ] Cannot update other tenant's data (tested)
- [ ] Cannot delete other tenant's data (tested)

---

## Summary

**Multi-tenant isolation is not optional. It's not a feature. It's the foundation.**

**One mistake = entire platform compromise.**

Follow these rules religiously. Test thoroughly. Never skip tenant filtering.

**When in doubt, ask. Never assume.**

---

**End of Multi-Tenant Isolation Rules**

All agents must internalize these rules before writing any code.