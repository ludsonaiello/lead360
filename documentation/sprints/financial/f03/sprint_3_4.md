# Sprint 3_4 — Controller + Module Registration: PaymentMethodRegistryController

**Module:** Financial
**File:** ./documentation/sprints/financial/f03/sprint_3_4.md
**Type:** Backend
**Depends On:** Sprint 3_3 (Service Layer must be complete)
**Gate:** STOP — All 6 endpoints must be accessible via Swagger docs and respond correctly before Sprint 3_5.
**Estimated Complexity:** Medium

> **You are a masterclass-level engineer whose work makes Google, Amazon, and Apple engineers jealous of the quality.** Every line you write must reflect that standard.

> **WARNING:** This platform is 85% production-ready. Never leave the dev server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

---

## Objective

Create `PaymentMethodRegistryController` with 6 endpoints matching the API contract. Register the controller and service in `FinancialModule`. Export `PaymentMethodRegistryService` from the module so Sprint F-04 can call `findDefault()`. Verify all endpoints appear in Swagger documentation.

---

## Pre-Sprint Checklist

- [ ] Sprint 3_3 complete — `PaymentMethodRegistryService` exists with all 7 methods
- [ ] Read existing controller files for patterns:
  - `/var/www/lead360.app/api/src/modules/financial/controllers/crew-payment.controller.ts`
  - `/var/www/lead360.app/api/src/modules/quotes/controllers/vendor.controller.ts`
  - `/var/www/lead360.app/api/src/modules/financial/controllers/financial-category.controller.ts`
- [ ] Read the module file: `/var/www/lead360.app/api/src/modules/financial/financial.module.ts`
- [ ] Verify the service file exists: `/var/www/lead360.app/api/src/modules/financial/services/payment-method-registry.service.ts`

---

## Dev Server

> This project does NOT use PM2. Do not reference or run PM2 commands.
> Do NOT use `pkill -f` — it does not work reliably. Always use `lsof` + `kill {PID}`.

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   <- must return nothing before proceeding

START the dev server:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT — the server takes 60 to 120 seconds to compile and become ready.
Do NOT attempt to hit any endpoint until the health check passes:
  curl -s http://localhost:8000/health   <- must return 200 before proceeding

Keep retrying the health check every 10 seconds until it responds.

KEEP the server running for the entire duration of the sprint.
Do NOT stop and restart between tests — keep it open.

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID}
  Confirm port is free: lsof -i :8000   <- must return nothing
```

**MySQL credentials** are in `/var/www/lead360.app/api/.env` — do not hardcode any database credentials.

---

## Tasks

### Task 1 — Read Existing Controller Patterns

**What:** Read these files before writing any code:

1. `/var/www/lead360.app/api/src/modules/financial/controllers/crew-payment.controller.ts`
2. `/var/www/lead360.app/api/src/modules/quotes/controllers/vendor.controller.ts`
3. `/var/www/lead360.app/api/src/modules/financial/financial.module.ts`

**Why:** Match the exact import style, decorator usage, guard configuration, and module registration pattern.

---

### Task 2 — Create `PaymentMethodRegistryController`

**What:** Create the file at:
```
/var/www/lead360.app/api/src/modules/financial/controllers/payment-method-registry.controller.ts
```

**Full implementation:**

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PaymentMethodRegistryService } from '../services/payment-method-registry.service';
import { CreatePaymentMethodRegistryDto } from '../dto/create-payment-method-registry.dto';
import { UpdatePaymentMethodRegistryDto } from '../dto/update-payment-method-registry.dto';
import { ListPaymentMethodsDto } from '../dto/list-payment-methods.dto';

@ApiTags('Payment Method Registry')
@ApiBearerAuth()
@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentMethodRegistryController {
  constructor(
    private readonly paymentMethodRegistryService: PaymentMethodRegistryService,
  ) {}

  // --- Endpoints defined in Tasks 3–8 below ---
}
```

**Key patterns to match:**
- `@Controller('financial')` — same base path as other financial controllers
- `@UseGuards(JwtAuthGuard, RolesGuard)` — class-level guards
- `@ApiTags('Payment Method Registry')` — Swagger grouping
- `@ApiBearerAuth()` — indicates JWT requirement in Swagger
- All imports from the exact paths shown above

**Do NOT:**
- Create a separate controller class — all 6 endpoints go in one controller
- Use `@TenantId()` decorator — use `@Request() req` and access `req.user.tenant_id` (matching the existing financial controller pattern)
- Import from incorrect paths

---

### Task 3 — Implement `GET /financial/payment-methods` (List)

```typescript
@Get('payment-methods')
@Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Sales', 'Employee')
@ApiOperation({ summary: 'List payment methods for tenant' })
@ApiQuery({ name: 'is_active', required: false, type: Boolean, description: 'Filter by active status (default: true)' })
@ApiQuery({ name: 'type', required: false, enum: ['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'], description: 'Filter by payment type' })
@ApiResponse({ status: 200, description: 'Array of payment methods with usage data' })
async findAll(@Request() req, @Query() query: ListPaymentMethodsDto) {
  return this.paymentMethodRegistryService.findAll(req.user.tenant_id, query);
}
```

**Contract:** All roles can list (read access needed for expense entry form).

---

### Task 4 — Implement `POST /financial/payment-methods` (Create)

```typescript
@Post('payment-methods')
@Roles('Owner', 'Admin', 'Bookkeeper')
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Create a payment method' })
@ApiResponse({ status: 201, description: 'Payment method created successfully' })
@ApiResponse({ status: 400, description: 'Validation error (invalid last_four, limit reached, invalid type)' })
@ApiResponse({ status: 409, description: 'Nickname already exists for this tenant' })
async create(@Request() req, @Body() dto: CreatePaymentMethodRegistryDto) {
  return this.paymentMethodRegistryService.create(
    req.user.tenant_id,
    req.user.id,
    dto,
  );
}
```

**Contract:** Only Owner, Admin, Bookkeeper can create.

---

### Task 5 — Implement `GET /financial/payment-methods/:id` (Get One)

```typescript
@Get('payment-methods/:id')
@Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Sales', 'Employee')
@ApiOperation({ summary: 'Get a single payment method' })
@ApiParam({ name: 'id', description: 'Payment method UUID' })
@ApiResponse({ status: 200, description: 'Payment method with usage data' })
@ApiResponse({ status: 404, description: 'Payment method not found' })
async findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
  return this.paymentMethodRegistryService.findOne(req.user.tenant_id, id);
}
```

**Contract:** All roles can read.

---

### Task 6 — Implement `PATCH /financial/payment-methods/:id` (Update)

```typescript
@Patch('payment-methods/:id')
@Roles('Owner', 'Admin', 'Bookkeeper')
@ApiOperation({ summary: 'Update a payment method' })
@ApiParam({ name: 'id', description: 'Payment method UUID' })
@ApiResponse({ status: 200, description: 'Payment method updated successfully' })
@ApiResponse({ status: 400, description: 'Validation error (invalid last_four)' })
@ApiResponse({ status: 404, description: 'Payment method not found' })
@ApiResponse({ status: 409, description: 'Nickname already exists for this tenant' })
async update(
  @Request() req,
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: UpdatePaymentMethodRegistryDto,
) {
  return this.paymentMethodRegistryService.update(
    req.user.tenant_id,
    id,
    req.user.id,
    dto,
  );
}
```

---

### Task 7 — Implement `DELETE /financial/payment-methods/:id` (Soft Delete)

```typescript
@Delete('payment-methods/:id')
@Roles('Owner', 'Admin')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Soft-delete (deactivate) a payment method' })
@ApiParam({ name: 'id', description: 'Payment method UUID' })
@ApiResponse({ status: 200, description: 'Payment method deactivated. Returns the updated record.' })
@ApiResponse({ status: 404, description: 'Payment method not found' })
async remove(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
  return this.paymentMethodRegistryService.softDelete(
    req.user.tenant_id,
    id,
    req.user.id,
  );
}
```

**Important:** Returns HTTP 200 with the deactivated object — NOT 204 No Content. This is explicitly stated in the contract: "Response: 200 OK with the updated (deactivated) payment method object."

**Contract:** Only Owner, Admin can delete.

---

### Task 8 — Implement `POST /financial/payment-methods/:id/set-default` (Set Default)

```typescript
@Post('payment-methods/:id/set-default')
@Roles('Owner', 'Admin', 'Bookkeeper')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Set a payment method as the tenant default' })
@ApiParam({ name: 'id', description: 'Payment method UUID' })
@ApiResponse({ status: 200, description: 'Payment method set as default successfully' })
@ApiResponse({ status: 400, description: 'Payment method is inactive' })
@ApiResponse({ status: 404, description: 'Payment method not found' })
async setDefault(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
  return this.paymentMethodRegistryService.setDefault(
    req.user.tenant_id,
    id,
    req.user.id,
  );
}
```

**Contract note:** This endpoint uses `POST`, NOT `PATCH`. The vendor controller uses `PATCH` for its `set-default`, but the F-03 contract explicitly specifies `POST`. Follow the contract.

**No request body** — the ID comes from the URL path.

---

### Task 9 — Register in FinancialModule

**What:** Edit `/var/www/lead360.app/api/src/modules/financial/financial.module.ts` to register the new controller and service.

**Add these imports at the top of the file:**

```typescript
// Sprint F-03: Payment Method Registry
import { PaymentMethodRegistryService } from './services/payment-method-registry.service';
import { PaymentMethodRegistryController } from './controllers/payment-method-registry.controller';
```

**Add to the `controllers` array:**
```typescript
// Sprint F-03
PaymentMethodRegistryController,
```

**Add to the `providers` array:**
```typescript
// Sprint F-03
PaymentMethodRegistryService,
```

**Add to the `exports` array:**
```typescript
// Sprint F-03
PaymentMethodRegistryService,
```

**Why the service must be exported:** Sprint F-04's expense entry service will call `PaymentMethodRegistryService.findDefault()` to pre-populate new expense entries with the tenant's default payment method.

**Do NOT:**
- Remove any existing imports, controllers, providers, or exports
- Change the order of existing entries
- Modify any other module file

---

### Task 10 — Verify Endpoints in Swagger

**What:** After starting the dev server:

1. Verify health check: `curl -s http://localhost:8000/health`
2. Open Swagger docs: `curl -s http://localhost:8000/api/docs-json | python3 -m json.tool | head -100`
3. Verify all 6 payment-methods endpoints appear in the Swagger JSON:
   - `GET /financial/payment-methods`
   - `POST /financial/payment-methods`
   - `GET /financial/payment-methods/{id}`
   - `PATCH /financial/payment-methods/{id}`
   - `DELETE /financial/payment-methods/{id}`
   - `POST /financial/payment-methods/{id}/set-default`

**Acceptance:** All 6 endpoints are visible in Swagger docs with correct method, path, and descriptions.

---

### Task 11 — Smoke Test Endpoints

**What:** After the server is running, test the endpoints with curl. You'll need a valid JWT token. Use the test credentials:

```bash
# Get JWT token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

# Test list (should return empty array or existing records)
curl -s -X GET http://localhost:8000/financial/payment-methods \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Test create
curl -s -X POST http://localhost:8000/financial/payment-methods \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"Chase Business Visa","type":"credit_card","bank_name":"Chase","last_four":"4521"}' | python3 -m json.tool

# Test list again (should show 1 record with usage_count: 0)
curl -s -X GET http://localhost:8000/financial/payment-methods \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**Acceptance:**
- List returns 200 with an array
- Create returns 201 with the created record including `usage_count` and `last_used_date`
- List after create shows the new record
- Each response includes all expected fields

**Do NOT:**
- Skip the smoke test — it catches integration issues early
- Leave test data behind (it's fine for development, the test data is scoped to the test tenant)

---

## Patterns to Apply

### Controller Import Pattern (from existing financial controllers)

```typescript
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
```

### Controller Class Decoration Pattern

```typescript
@ApiTags('Module Name')
@ApiBearerAuth()
@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SomeController {
  constructor(private readonly service: SomeService) {}
}
```

### Method Decoration Pattern

```typescript
@Post('path')
@Roles('Owner', 'Admin', 'Bookkeeper')
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Brief description' })
@ApiResponse({ status: 201, description: 'Success message' })
@ApiResponse({ status: 400, description: 'Error description' })
async methodName(@Request() req, @Body() dto: SomeDto) {
  return this.service.method(req.user.tenant_id, req.user.id, dto);
}
```

### Module Registration Pattern (from `financial.module.ts`)

```typescript
@Module({
  imports: [PrismaModule, AuditModule, FilesModule],
  controllers: [
    // Existing controllers...
    PaymentMethodRegistryController,  // NEW
  ],
  providers: [
    // Existing services...
    PaymentMethodRegistryService,  // NEW
  ],
  exports: [
    // Existing exports...
    PaymentMethodRegistryService,  // NEW - exported for F-04
  ],
})
```

---

## Business Rules Enforced in This Sprint

- BR-01: RBAC — Only Owner/Admin/Bookkeeper can create and update. Only Owner/Admin can delete. All roles can read.
- BR-02: The `set-default` endpoint uses POST (per contract), not PATCH.
- BR-03: DELETE returns 200 with the deactivated record, not 204.
- BR-04: All endpoints require JWT authentication (`JwtAuthGuard`).
- BR-05: All endpoints enforce role-based access (`RolesGuard` + `@Roles()`).

---

## API Endpoint Summary

| Method | Path | Roles | Response |
|---|---|---|---|
| `GET` | `/financial/payment-methods` | All | 200 — Array |
| `POST` | `/financial/payment-methods` | Owner, Admin, Bookkeeper | 201 — Created record |
| `GET` | `/financial/payment-methods/:id` | All | 200 — Single record |
| `PATCH` | `/financial/payment-methods/:id` | Owner, Admin, Bookkeeper | 200 — Updated record |
| `DELETE` | `/financial/payment-methods/:id` | Owner, Admin | 200 — Deactivated record |
| `POST` | `/financial/payment-methods/:id/set-default` | Owner, Admin, Bookkeeper | 200 — Updated record |

---

## Integration Points

| Dependency | Import Path | What It Provides |
|---|---|---|
| `PaymentMethodRegistryService` | `'../services/payment-method-registry.service'` | All business logic |
| `JwtAuthGuard` | `'../../auth/guards/jwt-auth.guard'` | JWT authentication |
| `RolesGuard` | `'../../auth/guards/roles.guard'` | Role-based access control |
| `Roles` | `'../../auth/decorators/roles.decorator'` | Role specification decorator |
| DTOs | `'../dto/create-payment-method-registry.dto'` etc. | Request validation |

---

## Acceptance Criteria

- [ ] `payment-method-registry.controller.ts` exists at the correct path
- [ ] All 6 endpoints are implemented with correct HTTP methods and paths
- [ ] RBAC roles match the contract exactly (All for GET, Owner/Admin/Bookkeeper for POST/PATCH, Owner/Admin for DELETE)
- [ ] DELETE returns 200 (not 204)
- [ ] Set-default uses POST (not PATCH)
- [ ] Controller is registered in `FinancialModule` controllers array
- [ ] `PaymentMethodRegistryService` is registered in providers AND exports arrays
- [ ] All 6 endpoints appear in Swagger docs
- [ ] Smoke test: list and create endpoints respond correctly
- [ ] No existing controllers, services, or module registrations were modified or removed
- [ ] No frontend code was modified
- [ ] Dev server is shut down before sprint is marked complete

---

## Gate Marker

**STOP** — Do not proceed to Sprint 3_5 until:
1. All 6 endpoints appear in Swagger docs
2. Smoke test confirms list and create work correctly
3. Module registration is correct (controller, provider, export)
4. Dev server compiles and health check passes

---

## Handoff Notes

**For Sprint 3_5 (Financial Entry Auto-Copy Integration):**
- The `PaymentMethodRegistryService` is now available as a dependency — import from `'../services/payment-method-registry.service'` (within the financial module) or via the `FinancialModule` export (from other modules)
- `findOne(tenantId, id)` can be used to look up a registry record's `type` when creating a financial entry with a `payment_method_registry_id`
- The controller uses `@Controller('financial')` with method-level path `'payment-methods'` and `'payment-methods/:id'`
