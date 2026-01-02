# Testing Requirements & Standards

**Platform**: Lead360 Multi-Tenant SaaS CRM/ERP  
**Applies To**: Backend Agent, Frontend Agent  
**Philosophy**: Test early, test often, test comprehensively

---

## Testing Philosophy

1. **Tests are mandatory** - No code merged without tests
2. **Tests are documentation** - They explain how code should behave
3. **Tests prevent regressions** - They catch bugs before production
4. **Tests enable refactoring** - Confident code changes
5. **Tests are fast** - Run frequently during development

---

## Coverage Requirements

### **Backend (NestJS/API)**

| Category | Minimum Coverage | Target |
|----------|-----------------|--------|
| **Services** (business logic) | 80% | 90%+ |
| **Controllers** | 70% | 80%+ |
| **Critical business rules** | 100% | 100% |
| **Tenant isolation** | 100% | 100% |
| **RBAC enforcement** | 100% | 100% |

### **Frontend (Next.js/React)**

| Category | Minimum Coverage | Target |
|----------|-----------------|--------|
| **Components** | 70% | 80%+ |
| **Critical user flows** | 100% | 100% |
| **Form validation** | 80% | 90%+ |
| **API integration** | 70% | 80%+ |

**Critical business rules** = Invoice cap, quote versioning, time clock geo-fencing, financial calculations

---

## Backend Testing

### **1. Unit Tests (Services)**

**Purpose**: Test business logic in isolation.

**Framework**: Jest

**Location**: Next to the file being tested: `{file}.spec.ts`

---

#### **Example: Service Unit Test**

```typescript
// leads.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LeadsService', () => {
  let service: LeadsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LeadsService, PrismaService],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('should create a lead with tenant_id', async () => {
      const tenantId = 'tenant-123';
      const dto = {
        name: 'John Smith',
        phone: '5551234567',
        email: 'john@example.com',
      };

      // Mock Prisma call
      jest.spyOn(prisma.lead, 'create').mockResolvedValue({
        id: 'lead-1',
        tenant_id: tenantId,
        ...dto,
        status: 'NEW',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.create(tenantId, dto);

      expect(result).toBeDefined();
      expect(result.tenant_id).toBe(tenantId);
      expect(result.name).toBe(dto.name);
      expect(prisma.lead.create).toHaveBeenCalledWith({
        data: {
          tenant_id: tenantId,
          ...dto,
        },
      });
    });

    it('should throw ConflictException if phone already exists', async () => {
      const tenantId = 'tenant-123';
      const dto = { name: 'John', phone: '5551234567' };

      // Mock existing lead
      jest.spyOn(prisma.lead, 'findFirst').mockResolvedValue({
        id: 'existing-lead',
        tenant_id: tenantId,
        phone: dto.phone,
      } as any);

      await expect(service.create(tenantId, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated leads for tenant', async () => {
      const tenantId = 'tenant-123';
      const mockLeads = [
        { id: 'lead-1', name: 'John', tenant_id: tenantId },
        { id: 'lead-2', name: 'Jane', tenant_id: tenantId },
      ];

      jest.spyOn(prisma.lead, 'findMany').mockResolvedValue(mockLeads as any);
      jest.spyOn(prisma.lead, 'count').mockResolvedValue(2);

      const result = await service.findAll(tenantId, 1, 20);

      expect(result.data).toEqual(mockLeads);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('should filter leads by tenant_id', async () => {
      const tenantId = 'tenant-123';
      jest.spyOn(prisma.lead, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.lead, 'count').mockResolvedValue(0);

      await service.findAll(tenantId);

      expect(prisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: tenantId }),
        }),
      );
    });
  });
});
```

---

### **2. Integration Tests (Controllers)**

**Purpose**: Test API endpoints end-to-end (request → controller → service → database → response).

**Framework**: Jest + Supertest

**Location**: `test/` directory (e.g., `test/leads.e2e-spec.ts`)

---

#### **Example: Controller Integration Test**

```typescript
// test/leads.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('LeadsController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password' });
    
    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/leads', () => {
    it('should create a lead', () => {
      return request(app.getHttpServer())
        .post('/api/v1/leads')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'John Smith',
          phone: '5551234567',
          email: 'john@example.com',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('John Smith');
          expect(res.body.phone).toBe('5551234567');
        });
    });

    it('should return 400 if validation fails', () => {
      return request(app.getHttpServer())
        .post('/api/v1/leads')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'J',  // Too short
          phone: '123', // Invalid
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.errors).toBeDefined();
          expect(res.body.errors.length).toBeGreaterThan(0);
        });
    });

    it('should return 401 if not authenticated', () => {
      return request(app.getHttpServer())
        .post('/api/v1/leads')
        .send({ name: 'John', phone: '5551234567' })
        .expect(401);
    });
  });

  describe('GET /api/v1/leads', () => {
    it('should return paginated leads', () => {
      return request(app.getHttpServer())
        .get('/api/v1/leads?page=1&limit=20')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('meta');
          expect(res.body.meta).toHaveProperty('total');
          expect(res.body.meta).toHaveProperty('page');
        });
    });
  });
});
```

---

### **3. Tenant Isolation Tests (MANDATORY)**

**Purpose**: Verify users cannot access other tenants' data.

**Every module MUST have these tests.**

---

#### **Template: Tenant Isolation Tests**

```typescript
describe('Tenant Isolation', () => {
  let tenantAToken: string;
  let tenantBToken: string;
  let leadInTenantA: any;

  beforeAll(async () => {
    // Setup: Create users in different tenants
    tenantAToken = await getAuthToken({ tenantId: 'tenant-a' });
    tenantBToken = await getAuthToken({ tenantId: 'tenant-b' });
    
    // Create lead in tenant A
    const response = await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({ name: 'John', phone: '5551234567' });
    
    leadInTenantA = response.body;
  });

  it('should not return leads from other tenants in list', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/leads')
      .set('Authorization', `Bearer ${tenantBToken}`)
      .expect(200);
    
    // Tenant B should not see tenant A's lead
    const leadIds = response.body.data.map(lead => lead.id);
    expect(leadIds).not.toContain(leadInTenantA.id);
  });

  it('should return 404 when accessing other tenant lead by ID', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/leads/${leadInTenantA.id}`)
      .set('Authorization', `Bearer ${tenantBToken}`)
      .expect(404);
  });

  it('should not update other tenant lead', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/leads/${leadInTenantA.id}`)
      .set('Authorization', `Bearer ${tenantBToken}`)
      .send({ name: 'Hacked' })
      .expect(404);
  });

  it('should not delete other tenant lead', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/leads/${leadInTenantA.id}`)
      .set('Authorization', `Bearer ${tenantBToken}`)
      .expect(404);
  });
});
```

---

### **4. RBAC Tests (MANDATORY)**

**Purpose**: Verify role-based access control works correctly.

---

#### **Template: RBAC Tests**

```typescript
describe('RBAC Enforcement', () => {
  let ownerToken: string;
  let employeeToken: string;

  beforeAll(async () => {
    ownerToken = await getAuthToken({ roles: ['Owner'] });
    employeeToken = await getAuthToken({ roles: ['Employee'] });
  });

  it('should allow Owner to create quote', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(validQuoteDto)
      .expect(201);
  });

  it('should deny Employee from creating quote', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send(validQuoteDto)
      .expect(403);
  });

  it('should allow Owner to edit sent quote', async () => {
    const quote = await createQuote({ status: 'SENT' });
    
    await request(app.getHttpServer())
      .patch(`/api/v1/quotes/${quote.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ notes: 'Updated' })
      .expect(200);
  });

  it('should deny Estimator from editing sent quote', async () => {
    const estimatorToken = await getAuthToken({ roles: ['Estimator'] });
    const quote = await createQuote({ status: 'SENT' });
    
    await request(app.getHttpServer())
      .patch(`/api/v1/quotes/${quote.id}`)
      .set('Authorization', `Bearer ${estimatorToken}`)
      .send({ notes: 'Updated' })
      .expect(403);
  });
});
```

---

### **5. Business Rule Tests**

**Purpose**: Test critical business logic.

**Examples**:
- Invoice cap enforcement
- Quote versioning
- Time clock geo-fencing

---

#### **Example: Invoice Cap Test**

```typescript
describe('Invoice Cap Enforcement', () => {
  it('should prevent invoicing more than quote total + change orders', async () => {
    // Create quote: $10,000
    const quote = await createQuote({ total: 10000 });
    const project = await acceptQuote(quote.id);
    
    // Invoice $7,000
    await createInvoice(project.id, { amount: 7000 });
    
    // Try to invoice another $5,000 (exceeds cap)
    await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ project_id: project.id, amount: 5000 })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('exceeds allowable amount');
      });
  });

  it('should allow invoicing up to quote + change orders', async () => {
    const quote = await createQuote({ total: 10000 });
    const project = await acceptQuote(quote.id);
    
    // Add change order: +$2,000
    await createChangeOrder(project.id, { amount: 2000, status: 'ACCEPTED' });
    
    // Invoice $12,000 (should succeed)
    await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ project_id: project.id, amount: 12000 })
      .expect(201);
  });
});
```

---

## Frontend Testing

### **1. Component Tests**

**Purpose**: Test individual React components.

**Framework**: Jest + React Testing Library

**Location**: Next to component: `{Component}.test.tsx`

---

#### **Example: Component Test**

```typescript
// components/leads/LeadCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { LeadCard } from './LeadCard';

describe('LeadCard', () => {
  const mockLead = {
    id: 'lead-1',
    name: 'John Smith',
    phone: '5551234567',
    email: 'john@example.com',
    status: 'NEW',
  };

  it('renders lead information', () => {
    render(<LeadCard lead={mockLead} />);
    
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('5551234567')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const onSelect = jest.fn();
    render(<LeadCard lead={mockLead} onSelect={onSelect} />);
    
    fireEvent.click(screen.getByText('John Smith'));
    expect(onSelect).toHaveBeenCalledWith('lead-1');
  });

  it('does not call onSelect if not provided', () => {
    // Should not throw error
    render(<LeadCard lead={mockLead} />);
    fireEvent.click(screen.getByText('John Smith'));
  });
});
```

---

### **2. Form Tests**

**Purpose**: Test form validation and submission.

---

#### **Example: Form Test**

```typescript
// components/leads/LeadForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LeadForm } from './LeadForm';
import { leadsApi } from '@/lib/api/leads';

jest.mock('@/lib/api/leads');

describe('LeadForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows validation errors for empty fields', async () => {
    render(<LeadForm />);
    
    const submitButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/phone is required/i)).toBeInTheDocument();
    });
    
    // Should not call API
    expect(leadsApi.create).not.toHaveBeenCalled();
  });

  it('shows validation error for invalid phone', async () => {
    render(<LeadForm />);
    
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'John Smith' },
    });
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: '123' },
    });
    
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/phone must be 10-15 digits/i)).toBeInTheDocument();
    });
  });

  it('submits form successfully', async () => {
    const mockLead = { id: 'lead-1', name: 'John Smith', phone: '5551234567' };
    (leadsApi.create as jest.Mock).mockResolvedValue(mockLead);
    
    const onSubmit = jest.fn();
    render(<LeadForm onSubmit={onSubmit} />);
    
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'John Smith' },
    });
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: '5551234567' },
    });
    
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    
    await waitFor(() => {
      expect(leadsApi.create).toHaveBeenCalledWith({
        name: 'John Smith',
        phone: '5551234567',
        email: '',
      });
      expect(onSubmit).toHaveBeenCalledWith(mockLead);
    });
  });

  it('shows error modal on API failure', async () => {
    (leadsApi.create as jest.Mock).mockRejectedValue(new Error('API Error'));
    
    render(<LeadForm />);
    
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'John Smith' },
    });
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: '5551234567' },
    });
    
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/failed to create lead/i)).toBeInTheDocument();
    });
  });
});
```

---

### **3. API Integration Tests (Mocked)**

**Purpose**: Test API client functions.

---

#### **Example: API Client Test**

```typescript
// lib/api/leads.test.ts
import { leadsApi } from './leads';
import { apiClient } from './client';

jest.mock('./client');

describe('leadsApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('calls correct endpoint', async () => {
      const mockResponse = { data: [], meta: { total: 0 } };
      (apiClient as jest.Mock).mockResolvedValue(mockResponse);
      
      const result = await leadsApi.getAll();
      
      expect(apiClient).toHaveBeenCalledWith('/leads');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('create', () => {
    it('sends POST request with data', async () => {
      const dto = { name: 'John', phone: '5551234567' };
      const mockLead = { id: 'lead-1', ...dto };
      (apiClient as jest.Mock).mockResolvedValue(mockLead);
      
      const result = await leadsApi.create(dto);
      
      expect(apiClient).toHaveBeenCalledWith('/leads', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      expect(result).toEqual(mockLead);
    });
  });
});
```

---

### **4. E2E Tests (Critical Flows)**

**Purpose**: Test complete user journeys.

**Framework**: Playwright or Cypress

**Examples**:
- Create lead → Send SMS → View timeline
- Create quote → Send to customer → Customer views → Accept

---

#### **Example: E2E Test (Playwright)**

```typescript
// e2e/leads.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Lead Management', () => {
  test('create and view lead', async ({ page }) => {
    // Login
    await page.goto('https://app.lead360.app/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to leads
    await page.click('text=Leads');
    await expect(page).toHaveURL(/.*\/leads/);
    
    // Create new lead
    await page.click('text=Create Lead');
    await page.fill('input[name="name"]', 'John Smith');
    await page.fill('input[name="phone"]', '5551234567');
    await page.fill('input[name="email"]', 'john@example.com');
    await page.click('button:has-text("Save")');
    
    // Verify success
    await expect(page.locator('text=Lead created successfully')).toBeVisible();
    
    // Verify lead in list
    await expect(page.locator('text=John Smith')).toBeVisible();
  });
});
```

---

## Test Data Management

### **Factories** (for creating test data)

```typescript
// test/factories/lead.factory.ts
export const createLeadFactory = (overrides = {}) => ({
  id: `lead-${Date.now()}`,
  tenant_id: 'test-tenant',
  name: 'John Smith',
  phone: '5551234567',
  email: 'john@example.com',
  status: 'NEW',
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});
```

**Usage**:
```typescript
const lead = createLeadFactory({ name: 'Jane Doe' });
```

---

## Mocking

### **Backend: Mock Prisma**

```typescript
const mockPrismaService = {
  lead: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};
```

### **Frontend: Mock API**

**MSW (Mock Service Worker)** recommended:

```typescript
// mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('https://api.lead360.app/api/v1/leads', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        data: [
          { id: 'lead-1', name: 'John Smith' },
        ],
        meta: { total: 1, page: 1, limit: 20 },
      })
    );
  }),
  
  rest.post('https://api.lead360.app/api/v1/leads', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        id: 'lead-new',
        ...req.body,
      })
    );
  }),
];
```

---

## Running Tests

### **Backend**

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific file
npm test leads.service.spec.ts

# Run in watch mode
npm test -- --watch
```

### **Frontend**

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run E2E tests
npm run test:e2e
```

---

## Coverage Reports

### **Generate Coverage Report**

```bash
npm test -- --coverage
```

**Output**: `coverage/` directory with HTML report.

**View**: Open `coverage/lcov-report/index.html` in browser.

---

## CI/CD Integration

### **GitHub Actions Example**

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

---

## Testing Checklist

Before marking module complete, verify:

### **Backend**
- [ ] Unit tests for all service methods (>80% coverage)
- [ ] Integration tests for all API endpoints
- [ ] Tenant isolation tests pass (cannot access other tenant data)
- [ ] RBAC tests pass (roles enforced correctly)
- [ ] Business rule tests pass (critical logic verified)
- [ ] All tests passing in CI/CD

### **Frontend**
- [ ] Component tests for UI components (>70% coverage)
- [ ] Form validation tests
- [ ] API integration tests (mocked)
- [ ] E2E tests for critical user flows
- [ ] All tests passing locally

---

## Best Practices

### **Write Tests First** (TDD when possible)
1. Write failing test
2. Write minimum code to pass
3. Refactor

### **Test Behavior, Not Implementation**
```typescript
// ✅ GOOD - Tests behavior
it('should create lead with tenant_id', async () => {
  const result = await service.create(tenantId, dto);
  expect(result.tenant_id).toBe(tenantId);
});

// ❌ BAD - Tests implementation
it('should call prisma.lead.create', async () => {
  await service.create(tenantId, dto);
  expect(prisma.lead.create).toHaveBeenCalled();
});
```

### **Descriptive Test Names**
```typescript
// ✅ GOOD
it('should return 404 when lead not found');
it('should prevent invoicing more than quote total');

// ❌ BAD
it('works');
it('test create');
```

### **Arrange-Act-Assert Pattern**
```typescript
it('should create lead', async () => {
  // Arrange
  const tenantId = 'tenant-123';
  const dto = { name: 'John', phone: '555-1234' };
  
  // Act
  const result = await service.create(tenantId, dto);
  
  // Assert
  expect(result).toBeDefined();
  expect(result.name).toBe('John');
});
```

---

## Summary

**Testing is NOT optional. It's part of development.**

**Key Requirements**:
- Services: >80% coverage
- Controllers: >70% coverage
- Critical business logic: 100% coverage
- Tenant isolation tests: Mandatory
- RBAC tests: Mandatory

**Test Types**:
- Unit tests (isolated logic)
- Integration tests (API endpoints)
- E2E tests (user flows)
- Tenant isolation tests
- RBAC tests

**No code merged without tests.**

---

**End of Testing Requirements**

All agents must write comprehensive tests for all code.