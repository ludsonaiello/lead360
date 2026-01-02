# Security Rules & Standards

**Platform**: Lead360 Multi-Tenant SaaS CRM/ERP  
**Applies To**: Backend Agent, Frontend Agent  
**Criticality**: ABSOLUTE - Security violations = Platform compromise

---

## Security Principles

1. **Defense in Depth**: Multiple layers of security
2. **Least Privilege**: Grant minimum permissions necessary
3. **Zero Trust**: Validate everything, trust nothing
4. **Fail Secure**: Errors should deny access, not grant it
5. **Audit Everything**: Log security-relevant events

---

## Authentication

### **Authentication Method**

**JWT (JSON Web Token)** with Bearer authentication.

---

### **JWT Token Structure**

**Payload**:
```json
{
  "userId": "user-uuid",
  "tenantId": "tenant-uuid",
  "roles": ["Owner"],
  "email": "user@example.com",
  "iat": 1642329600,
  "exp": 1642416000
}
```

**Critical Fields**:
- `userId`: Identifies the user
- `tenantId`: Identifies the business (for multi-tenant isolation)
- `roles`: User's roles (for RBAC)
- `exp`: Expiration timestamp (Unix timestamp)

---

### **Token Generation (Backend)**

```typescript
// On successful login
const payload = {
  userId: user.id,
  tenantId: user.tenant_id,
  roles: user.roles,  // Array of role names
  email: user.email,
};

const token = this.jwtService.sign(payload, {
  secret: process.env.JWT_SECRET,
  expiresIn: '7d',  // Or configurable
});

return { token, user };
```

**Token Security**:
- Use strong secret (min 32 characters, random)
- Store secret in environment variable (never hardcode)
- Set reasonable expiration (7-30 days max)
- Use HTTPS only (never send token over HTTP)

---

### **Token Validation (Backend)**

**JwtAuthGuard** (applies to all protected endpoints):

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
```

**Usage**:
```typescript
@Controller('api/v1/leads')
@UseGuards(JwtAuthGuard)  // All endpoints require auth
export class LeadsController {
  // ...
}
```

---

### **Token Storage (Frontend)**

**Options**:
1. **localStorage** (simple, vulnerable to XSS)
2. **sessionStorage** (cleared on tab close)
3. **httpOnly cookie** (most secure, requires backend setup)

**Recommended: httpOnly Cookie**

**Backend**:
```typescript
res.cookie('token', jwtToken, {
  httpOnly: true,    // Not accessible via JavaScript
  secure: true,      // HTTPS only
  sameSite: 'strict', // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});
```

**Frontend**: No manual token handling needed, browser sends automatically.

---

### **Unauthenticated Endpoints**

**Only these endpoints should NOT require authentication**:

- `POST /auth/login` - Login
- `POST /auth/register` - Registration
- `POST /auth/forgot-password` - Password reset request
- `GET /health` - Health check
- `GET /public/quotes/:token` - Public quote view (token-based)

**All other endpoints MUST require JWT.**

---

## Authorization (RBAC)

### **Role Definitions**

| Role | Description | Access Level |
|------|-------------|--------------|
| **Owner** | Business owner | Full access to everything |
| **Admin** | Administrator | Almost full access (no subscription/billing) |
| **Estimator** | Sales/estimator | Leads, quotes, projects (limited financial) |
| **Project Manager** | PM | Projects, tasks, change orders |
| **Bookkeeper** | Financial manager | Invoices, payments, financial entries |
| **Employee** | Field worker | Time clock, assigned tasks (limited visibility) |
| **Read-only** | Viewer | Reports and dashboards only |

---

### **Permission Matrix**

| Resource | Owner | Admin | Estimator | PM | Bookkeeper | Employee | Read-only |
|----------|-------|-------|-----------|----|-----------| ---------|-----------|
| **Leads** |
| Create | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Quotes** |
| Create | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Edit (draft) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit (sent) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Send | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Projects** |
| Create | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Complete | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Invoices** |
| Create | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| View | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Edit (draft) | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Edit (sent) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Financial** |
| View | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Create entries | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Edit entries | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Time Clock** |
| Clock in/out | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View own | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View all | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Edit logs | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Settings** |
| Integrations | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Users/roles | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Branding | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Billing | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

### **RBAC Implementation (Backend)**

**RolesGuard**:
```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredRoles) {
      return true;  // No roles required
    }
    
    const { user } = context.switchToHttp().getRequest();
    
    // Check if user has any of the required roles
    return requiredRoles.some(role => user.roles.includes(role));
  }
}
```

**Usage**:
```typescript
@Controller('api/v1/quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuotesController {
  
  @Post()
  @Roles('Owner', 'Admin', 'Estimator')
  async create() {
    // Only Owner, Admin, or Estimator can create
  }
  
  @Patch(':id/send')
  @Roles('Owner', 'Admin', 'Estimator')
  async send() {
    // Only Owner, Admin, or Estimator can send
  }
  
  @Patch(':id')
  async update(@CurrentUser() user: User, @Param('id') id: string) {
    // Custom logic: check if quote is sent
    const quote = await this.service.findOne(id);
    
    if (quote.status === 'SENT' && !['Owner', 'Admin'].includes(user.roles[0])) {
      throw new ForbiddenException('Only Owner/Admin can edit sent quotes');
    }
    
    // Continue with update
  }
}
```

**Roles Decorator**:
```typescript
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
```

---

### **RBAC in Frontend**

**Use user's roles to show/hide UI elements**:

```typescript
const { user } = useAuth();

const canCreateQuote = user.roles.some(role => 
  ['Owner', 'Admin', 'Estimator'].includes(role)
);

const canEditSentQuote = user.roles.some(role =>
  ['Owner', 'Admin'].includes(role)
);

return (
  <div>
    {canCreateQuote && (
      <Button onClick={openQuoteForm}>Create Quote</Button>
    )}
    
    {(quote.status === 'DRAFT' && canCreateQuote) || canEditSentQuote ? (
      <Button onClick={editQuote}>Edit</Button>
    ) : null}
  </div>
);
```

**IMPORTANT**: Frontend checks are for UX only. Backend MUST enforce permissions.

---

## Input Validation

### **Backend Validation**

**Always validate ALL user inputs**:

```typescript
import { IsString, IsEmail, IsOptional, Length, Matches } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @Length(2, 100)
  name: string;

  @IsString()
  @Matches(/^\d{10,15}$/, { message: 'Phone must be 10-15 digits' })
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}
```

**Validation happens automatically in NestJS**:
```typescript
@Post()
async create(@Body() dto: CreateLeadDto) {
  // DTO is already validated by NestJS
}
```

---

### **Common Validation Rules**

**Strings**:
```typescript
@IsString()
@Length(min, max)
@IsNotEmpty()
@Matches(/regex/)
```

**Numbers**:
```typescript
@IsNumber()
@Min(value)
@Max(value)
@IsPositive()
```

**Emails**:
```typescript
@IsEmail()
```

**Dates**:
```typescript
@IsDateString()
@IsISO8601()
```

**Enums**:
```typescript
@IsEnum(LeadStatus)
status: LeadStatus;
```

**Arrays**:
```typescript
@IsArray()
@ArrayMinSize(min)
@ArrayMaxSize(max)
@ValidateNested({ each: true })
@Type(() => AddressDto)
addresses: AddressDto[];
```

---

### **Frontend Validation**

**Client-side validation is for UX only** - always validate server-side.

```typescript
const validateForm = () => {
  const errors: Record<string, string> = {};
  
  if (!name.trim()) {
    errors.name = 'Name is required';
  } else if (name.length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }
  
  if (!phone.trim()) {
    errors.phone = 'Phone is required';
  } else if (!/^\d{10,15}$/.test(phone.replace(/\D/g, ''))) {
    errors.phone = 'Phone must be 10-15 digits';
  }
  
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Invalid email address';
  }
  
  return errors;
};
```

---

## SQL Injection Prevention

### **Prisma Prevents SQL Injection**

**Prisma uses parameterized queries automatically**:

```typescript
// ✅ SAFE - Prisma parameterizes this
const leads = await prisma.lead.findMany({
  where: {
    tenant_id: tenantId,
    name: { contains: userInput },  // Safe - parameterized
  },
});

// ❌ DANGEROUS - Raw SQL (avoid unless necessary)
const leads = await prisma.$queryRaw`
  SELECT * FROM lead WHERE tenant_id = ${tenantId} AND name LIKE '%${userInput}%'
`;
// If you must use raw SQL, use parameterized queries
```

**If raw SQL is absolutely necessary**:
```typescript
// ✅ SAFE - Parameterized
const leads = await prisma.$queryRaw`
  SELECT * FROM lead WHERE tenant_id = ${tenantId} AND name LIKE ${`%${userInput}%`}
`;
```

**Rule**: Prefer Prisma's query builder over raw SQL.

---

## XSS (Cross-Site Scripting) Prevention

### **Backend: Sanitize User Input**

**For HTML content**:
```typescript
import * as sanitizeHtml from 'sanitize-html';

const cleanHtml = sanitizeHtml(userInput, {
  allowedTags: ['b', 'i', 'em', 'strong', 'a'],
  allowedAttributes: {
    'a': ['href']
  },
});
```

**For plain text** (store as-is, sanitize on output):
- Store user input without modification
- Escape on output (React does this automatically)

---

### **Frontend: React Auto-Escapes**

**React automatically escapes**:
```typescript
// ✅ SAFE - React escapes HTML
<div>{userInput}</div>

// ❌ DANGEROUS - Bypasses React's escaping
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

**Rule**: Never use `dangerouslySetInnerHTML` with user input.

---

## CSRF (Cross-Site Request Forgery) Prevention

### **Next.js Handles CSRF**

Next.js automatically protects against CSRF for same-origin requests.

**If using separate frontend/backend**:
- Use SameSite cookie attribute: `sameSite: 'strict'`
- Or implement CSRF token validation

---

## Password Security

### **Password Hashing (Backend)**

**Use bcrypt**:
```typescript
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

// Hash password on registration
const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);

// Verify password on login
const isValid = await bcrypt.compare(plainPassword, hashedPassword);
```

**NEVER**:
- Store passwords in plain text
- Use MD5 or SHA1 (weak)
- Log passwords

---

### **Password Requirements**

**Minimum requirements**:
- Min length: 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character

**Validation**:
```typescript
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

@Matches(PASSWORD_REGEX, {
  message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
})
password: string;
```

---

## Rate Limiting

### **Purpose**

Prevent abuse:
- Brute force attacks
- DDoS attacks
- API abuse

### **Implementation** (to be added)

**Recommended library**: `@nestjs/throttler`

```typescript
// Rate limit: 100 requests per 15 minutes
@Throttle(100, 900)
@Controller('api/v1/auth')
export class AuthController {
  // ...
}
```

---

## Audit Logging

### **What to Audit**

**Critical actions**:
- User login/logout
- Quote creation/editing (especially after sent)
- Invoice creation/editing
- Payment recording
- Time clock edits
- Financial entry creation/editing
- Role/permission changes
- User creation/deletion

---

### **Audit Log Schema**

```prisma
model audit_log {
  id            String   @id @default(uuid())
  tenant_id     String
  actor_user_id String?  // Who did it (null for system)
  entity_type   String   // "Quote", "Invoice", "TimeClockEvent"
  entity_id     String   // ID of affected record
  action        String   // "CREATE", "UPDATE", "DELETE"
  before_json   Json?    // State before change
  after_json    Json?    // State after change
  ip_address    String?
  user_agent    String?
  created_at    DateTime @default(now())
  
  tenant        tenant   @relation(fields: [tenant_id], references: [id])
  user          user?    @relation(fields: [actor_user_id], references: [id])
  
  @@index([tenant_id, entity_type, entity_id])
  @@index([tenant_id, created_at])
}
```

---

### **Audit Logging Pattern**

```typescript
async updateQuote(tenantId: string, userId: string, quoteId: string, updateDto: UpdateQuoteDto) {
  // Get current state
  const before = await prisma.quote.findUnique({
    where: { id: quoteId, tenant_id: tenantId },
  });
  
  if (!before) {
    throw new NotFoundException('Quote not found');
  }
  
  // Update quote
  const after = await prisma.quote.update({
    where: { id: quoteId, tenant_id: tenantId },
    data: updateDto,
  });
  
  // Create audit log
  await prisma.audit_log.create({
    data: {
      tenant_id: tenantId,
      actor_user_id: userId,
      entity_type: 'Quote',
      entity_id: quoteId,
      action: 'UPDATE',
      before_json: before,
      after_json: after,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    },
  });
  
  return after;
}
```

---

## Sensitive Data Handling

### **What is Sensitive Data?**

- Passwords
- JWT secrets
- API keys
- Payment information
- Social Security Numbers
- Bank account numbers

---

### **Storage**

**Environment Variables**:
```env
# ✅ CORRECT - Sensitive data in .env
JWT_SECRET=very-long-random-secret-key-min-32-chars
DATABASE_URL=mysql://user:password@localhost:3306/lead360
TWILIO_AUTH_TOKEN=your-twilio-auth-token

# ❌ WRONG - Hardcoded in code
const JWT_SECRET = 'my-secret';  // Never do this
```

**Never commit `.env` to git**:
```gitignore
.env
.env.local
.env.*.local
```

---

### **Logging**

**NEVER log**:
- Passwords (plain or hashed)
- JWT tokens
- API keys
- Payment details

**Redact sensitive fields**:
```typescript
const safeUser = {
  ...user,
  password: undefined,  // Remove password
};

logger.log('User created', safeUser);
```

---

## HTTPS Enforcement

### **All Production Traffic Over HTTPS**

**Nginx configuration** (already set up):
- HTTP (port 80) redirects to HTTPS (port 443)
- All API and app traffic uses HTTPS

**Frontend**: Always use `https://` URLs.

**Backend**: Expect `Authorization` header only over HTTPS.

---

## Security Checklist

Before deploying any module, verify:

### **Authentication & Authorization**
- [ ] JWT authentication required on all protected endpoints
- [ ] RBAC guards applied to sensitive operations
- [ ] Token expiration set appropriately
- [ ] Unauthenticated endpoints documented and minimal

### **Input Validation**
- [ ] All request bodies validated with DTOs
- [ ] All query parameters validated
- [ ] All path parameters validated
- [ ] Enum values validated

### **Multi-Tenancy**
- [ ] All queries filter by `tenant_id`
- [ ] `tenant_id` extracted from JWT (never from client)
- [ ] Tenant isolation tested

### **Data Security**
- [ ] No SQL injection vulnerabilities (use Prisma)
- [ ] No XSS vulnerabilities (React auto-escapes)
- [ ] Passwords hashed with bcrypt
- [ ] Sensitive data not logged

### **Audit & Monitoring**
- [ ] Critical actions logged in audit_log
- [ ] Before/after state captured for edits
- [ ] Actor user ID recorded

### **HTTPS & Transport**
- [ ] All traffic over HTTPS (production)
- [ ] Sensitive data not in URL query params
- [ ] CORS configured correctly

---

## Security Testing

### **Tests Required**

**1. Authentication Tests**:
```typescript
it('should return 401 if no token provided', async () => {
  const response = await request(app.getHttpServer())
    .get('/api/v1/leads')
    .expect(401);
});

it('should return 401 if invalid token provided', async () => {
  const response = await request(app.getHttpServer())
    .get('/api/v1/leads')
    .set('Authorization', 'Bearer invalid-token')
    .expect(401);
});
```

**2. Authorization Tests**:
```typescript
it('should return 403 if user lacks required role', async () => {
  const employeeToken = getToken({ roles: ['Employee'] });
  
  const response = await request(app.getHttpServer())
    .post('/api/v1/quotes')
    .set('Authorization', `Bearer ${employeeToken}`)
    .send(validQuoteDto)
    .expect(403);
});
```

**3. Tenant Isolation Tests**:
```typescript
it('should not access other tenant data', async () => {
  const leadA = await createLead({ tenant_id: 'tenant-a' });
  const tokenB = getToken({ tenantId: 'tenant-b' });
  
  const response = await request(app.getHttpServer())
    .get(`/api/v1/leads/${leadA.id}`)
    .set('Authorization', `Bearer ${tokenB}`)
    .expect(404);  // Not found (because tenant filter)
});
```

---

## Summary

**Security is NOT optional. It's foundational.**

**Key Principles**:
1. Authenticate every request (JWT)
2. Authorize every action (RBAC)
3. Validate every input (DTOs)
4. Filter by tenant_id (multi-tenancy)
5. Hash passwords (bcrypt)
6. Audit critical actions (audit_log)
7. Use HTTPS (production)
8. Test security (unit + integration tests)

**When in doubt about security, ASK. Never assume.**

---

**End of Security Rules**

All agents must follow these security standards without exception.