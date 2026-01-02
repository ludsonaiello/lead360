# Backend Module: Authentication System

**Module Name**: Authentication  
**Sprint**: Sprint 0 - Platform Foundation  
**Feature Contract**: `/documentation/contracts/authentication-contract.md`  
**Agent**: Backend Specialist  
**Status**: Ready for Development

---

## Overview

This module implements the authentication and user management system for Lead360. You will build:
- User registration and account activation
- Login/logout with JWT tokens
- Password reset flow
- Session management (multiple devices)
- Token refresh mechanism
- User profile management

**Read First**:
- `/documentation/contracts/authentication-contract.md` (complete API specification)
- `/documentation/shared/security-rules.md` (password hashing, JWT standards)
- `/documentation/shared/api-conventions.md` (REST patterns)

---

## Database Schema (Prisma)

### **Implementation Order**

1. Create `user` table
2. Create `refresh_token` table
3. Create indexes
4. Generate migration
5. Run migration

---

### **Table: user**

**Location**: `prisma/schema.prisma`

**Purpose**: Store all user accounts (tenant users and platform admins)

**Schema Definition**:

```prisma
model User {
  id                        String    @id @default(uuid())
  tenant_id                 String?   @db.VarChar(36)
  email                     String    @db.VarChar(255)
  password_hash             String    @db.VarChar(255)
  first_name                String    @db.VarChar(100)
  last_name                 String    @db.VarChar(100)
  phone                     String?   @db.VarChar(20)
  is_active                 Boolean   @default(false)
  is_platform_admin         Boolean   @default(false)
  email_verified            Boolean   @default(false)
  email_verified_at         DateTime?
  activation_token          String?   @db.VarChar(255)
  activation_token_expires  DateTime?
  password_reset_token      String?   @db.VarChar(255)
  password_reset_expires    DateTime?
  last_login_at             DateTime?
  mfa_enabled               Boolean   @default(false)
  mfa_secret                String?   @db.VarChar(255)
  oauth_provider            String?   @db.VarChar(50)
  oauth_provider_id         String?   @db.VarChar(255)
  created_at                DateTime  @default(now())
  updated_at                DateTime  @updatedAt
  deleted_at                DateTime?

  // Relations
  tenant                    Tenant?        @relation(fields: [tenant_id], references: [id])
  refresh_tokens            RefreshToken[]
  user_roles                UserRole[]
  audit_logs                AuditLog[]

  @@unique([email, tenant_id], name: "email_tenant_unique")
  @@index([tenant_id, is_active])
  @@index([email])
  @@index([activation_token])
  @@index([password_reset_token])
  @@index([oauth_provider, oauth_provider_id])
  @@map("user")
}
```

**Key Design Decisions**:
- `tenant_id` is **nullable** (platform admins have null tenant_id)
- Email is unique **per tenant** (same email can exist across different tenants)
- `is_platform_admin = true` means user can access admin panel
- Soft delete via `deleted_at` (don't hard delete users with historical data)
- MFA and OAuth fields exist but not used in MVP (future-ready)

---

### **Table: refresh_token**

**Purpose**: Store refresh tokens for session management (supports multiple devices)

**Schema Definition**:

```prisma
model RefreshToken {
  id              String    @id @default(uuid())
  user_id         String    @db.VarChar(36)
  token_hash      String    @db.VarChar(255)
  device_name     String?   @db.VarChar(255)
  ip_address      String?   @db.VarChar(45)
  user_agent      String?   @db.VarChar(500)
  expires_at      DateTime
  created_at      DateTime  @default(now())
  revoked_at      DateTime?

  // Relations
  user            User      @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id, expires_at])
  @@index([token_hash])
  @@index([user_id, revoked_at])
  @@map("refresh_token")
}
```

**Key Design Decisions**:
- Store **hash** of refresh token, never plain text
- `device_name` extracted from user-agent (e.g., "Chrome on MacOS")
- `revoked_at` set when user logs out or changes password
- Cascade delete when user is deleted
- Supports multiple active tokens (multiple devices)

---

### **Migration Workflow**

1. Add models to `prisma/schema.prisma`
2. Run: `npx prisma migrate dev --name add_authentication_tables`
3. Verify migration file created in `prisma/migrations/`
4. Run: `npx prisma generate` to update Prisma Client
5. Commit both schema and migration files

---

## NestJS Module Structure

### **Directory Structure**

Create the following structure in `src/modules/auth/`:

```
src/modules/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── strategies/
│   ├── jwt.strategy.ts
│   └── jwt-refresh.strategy.ts
├── guards/
│   ├── jwt-auth.guard.ts
│   └── jwt-refresh.guard.ts
├── decorators/
│   ├── current-user.decorator.ts
│   └── public.decorator.ts
├── dto/
│   ├── register.dto.ts
│   ├── login.dto.ts
│   ├── refresh-token.dto.ts
│   ├── forgot-password.dto.ts
│   ├── reset-password.dto.ts
│   ├── activate-account.dto.ts
│   ├── change-password.dto.ts
│   ├── update-profile.dto.ts
│   └── auth-response.dto.ts
├── entities/
│   └── session.entity.ts
└── auth.service.spec.ts
```

---

## Implementation Steps

### **Step 1: Install Dependencies**

```bash
cd /var/www/lead360.app/api
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
npm install -D @types/passport-jwt @types/bcrypt
```

---

### **Step 2: Create DTOs (Data Transfer Objects)**

**Purpose**: Validate all incoming request bodies

**Location**: `src/modules/auth/dto/`

#### **register.dto.ts**

**Validation Rules**:
- `email`: Valid email format, lowercase normalized
- `password`: Min 8 chars, must contain uppercase, lowercase, special char
- `first_name`: 1-100 chars
- `last_name`: 1-100 chars
- `phone`: Optional, E.164 format
- `tenant_subdomain`: 3-63 chars, alphanumeric + hyphens, lowercase
- `company_name`: 2-200 chars

**Use**: `class-validator` decorators
- `@IsEmail()`
- `@MinLength()`, `@MaxLength()`
- `@Matches()` for password pattern
- `@Transform()` for lowercasing email

#### **login.dto.ts**

**Validation Rules**:
- `email`: Valid email format
- `password`: Required (no validation on login - check against hash)
- `remember_me`: Optional boolean

#### **forgot-password.dto.ts**

**Validation Rules**:
- `email`: Valid email format

#### **reset-password.dto.ts**

**Validation Rules**:
- `token`: Required string
- `password`: Same rules as register

#### **activate-account.dto.ts**

**Validation Rules**:
- `token`: Required string

#### **change-password.dto.ts**

**Validation Rules**:
- `current_password`: Required
- `new_password`: Same rules as register

#### **update-profile.dto.ts**

**Validation Rules**:
- `first_name`: Optional, 1-100 chars
- `last_name`: Optional, 1-100 chars
- `phone`: Optional, E.164 format

#### **auth-response.dto.ts**

**Purpose**: Standard response shape for login/register

**Fields**:
- `access_token`: JWT string
- `refresh_token`: JWT string
- `token_type`: Always "Bearer"
- `expires_in`: Seconds until access token expires
- `user`: User object (without sensitive fields)

---

### **Step 3: Create JWT Strategy**

**Location**: `src/modules/auth/strategies/jwt.strategy.ts`

**Purpose**: Validate JWT access tokens on protected routes

**Configuration**:
- Secret: From `process.env.JWT_SECRET`
- Extract from: Authorization header as Bearer token
- Validate: Signature, expiration
- Return: User payload (userId, tenantId, roles)

**Passport Strategy**: Use `passport-jwt` with `ExtractJwt.fromAuthHeaderAsBearerToken()`

**Validation Logic**:
1. Extract token from header
2. Verify signature with JWT_SECRET
3. Check expiration
4. Return decoded payload

---

### **Step 4: Create JWT Refresh Strategy**

**Location**: `src/modules/auth/strategies/jwt-refresh.strategy.ts`

**Purpose**: Validate refresh tokens for token refresh endpoint

**Configuration**:
- Secret: From `process.env.JWT_REFRESH_SECRET`
- Extract from: Authorization header as Bearer token
- Validate: Signature, expiration, not revoked

**Additional Validation**:
1. Verify signature
2. Check expiration
3. Query database to verify token not revoked
4. Return user payload

---

### **Step 5: Create Guards**

#### **jwt-auth.guard.ts**

**Purpose**: Protect routes that require authentication

**Usage**: `@UseGuards(JwtAuthGuard)`

**Behavior**:
- If valid token → allow request, inject user into request object
- If invalid/missing token → throw 401 Unauthorized

#### **jwt-refresh.guard.ts**

**Purpose**: Protect refresh token endpoint

**Usage**: `@UseGuards(JwtRefreshGuard)`

**Behavior**: Same as JwtAuthGuard but uses refresh token secret

---

### **Step 6: Create Decorators**

#### **current-user.decorator.ts**

**Purpose**: Extract current user from request

**Usage**: `@CurrentUser() user: JwtPayload`

**Behavior**: Returns user object from `request.user` (injected by guard)

#### **public.decorator.ts**

**Purpose**: Mark routes as public (no auth required)

**Usage**: `@Public()`

**Behavior**: Bypass JwtAuthGuard for this route

---

### **Step 7: Implement Auth Service**

**Location**: `src/modules/auth/auth.service.ts`

**Purpose**: Business logic for all auth operations

#### **Methods to Implement**

1. **register(registerDto: RegisterDto)**
   - Validate email uniqueness (per tenant)
   - Hash password with bcrypt (cost 10)
   - Create tenant (check subdomain availability)
   - Create user with `is_active = false`
   - Generate activation token (crypto.randomBytes)
   - Set `activation_token_expires = now() + 24 hours`
   - Queue activation email
   - Return success message

2. **login(loginDto: LoginDto)**
   - Find user by email (case-insensitive)
   - Verify password with bcrypt.compare()
   - Check `is_active = true` and `email_verified = true`
   - Generate access token (payload: userId, tenantId, roles, email)
   - Generate refresh token
   - Hash refresh token and store in database
   - Update `last_login_at`
   - Return tokens + user profile

3. **refresh(refreshToken: string)**
   - Verify refresh token signature
   - Check token not revoked in database
   - Check token not expired
   - Generate new access token (same payload)
   - Return new access token

4. **logout(userId: string, refreshTokenHash: string)**
   - Find refresh token by hash
   - Set `revoked_at = now()`
   - Return success

5. **logoutAll(userId: string)**
   - Find all active refresh tokens for user
   - Set `revoked_at = now()` for all
   - Return count of revoked sessions

6. **forgotPassword(email: string)**
   - Find user by email (case-insensitive)
   - If user exists and is_active:
     - Generate password reset token (crypto.randomBytes)
     - Set `password_reset_token` and `password_reset_expires = now() + 1 hour`
     - Queue password reset email
   - Always return success (don't reveal if email exists)

7. **resetPassword(token: string, newPassword: string)**
   - Find user by `password_reset_token`
   - Check token not expired
   - Validate new password strength
   - Hash new password with bcrypt
   - Update user password
   - Clear reset token fields
   - Revoke all refresh tokens (force re-login)
   - Queue "password changed" email
   - Return success

8. **activateAccount(token: string)**
   - Find user by `activation_token`
   - Check token not expired
   - Set `is_active = true`, `email_verified = true`, `email_verified_at = now()`
   - Clear activation token fields
   - Queue "welcome" email
   - Return success

9. **changePassword(userId: string, currentPassword: string, newPassword: string)**
   - Find user by ID
   - Verify current password
   - Validate new password strength
   - Hash new password
   - Update user password
   - Revoke all other refresh tokens (keep current session)
   - Queue "password changed" email
   - Return success

10. **getProfile(userId: string)**
    - Find user by ID with roles
    - Return user profile (exclude password_hash, tokens)

11. **updateProfile(userId: string, updateDto: UpdateProfileDto)**
    - Find user by ID
    - Update allowed fields (first_name, last_name, phone)
    - Return updated profile

12. **listSessions(userId: string, currentTokenHash: string)**
    - Find all active refresh tokens for user
    - Mark current session
    - Return session list

13. **revokeSession(userId: string, sessionId: string)**
    - Find refresh token by ID
    - Verify belongs to user
    - Set `revoked_at = now()`
    - Return success

---

### **Step 8: Implement Auth Controller**

**Location**: `src/modules/auth/auth.controller.ts`

**Purpose**: Define HTTP routes and delegate to service

#### **Routes to Implement**

All routes should be under `/auth` prefix.

1. **POST /auth/register**
   - DTO: RegisterDto
   - Response: 201 Created
   - No auth required

2. **POST /auth/login**
   - DTO: LoginDto
   - Response: 200 OK with tokens
   - No auth required

3. **POST /auth/refresh**
   - Guard: JwtRefreshGuard
   - Response: 200 OK with new access token
   - Requires refresh token in header

4. **POST /auth/logout**
   - Guard: JwtAuthGuard
   - Extract current refresh token from request
   - Response: 200 OK

5. **POST /auth/logout-all**
   - Guard: JwtAuthGuard
   - Response: 200 OK with count

6. **POST /auth/forgot-password**
   - DTO: ForgotPasswordDto
   - Response: 200 OK (always, even if email doesn't exist)
   - No auth required

7. **POST /auth/reset-password**
   - DTO: ResetPasswordDto
   - Response: 200 OK
   - No auth required

8. **POST /auth/activate**
   - DTO: ActivateAccountDto
   - Response: 200 OK
   - No auth required

9. **GET /auth/me**
   - Guard: JwtAuthGuard
   - Decorator: @CurrentUser()
   - Response: 200 OK with user profile

10. **PATCH /auth/me**
    - Guard: JwtAuthGuard
    - DTO: UpdateProfileDto
    - Response: 200 OK with updated profile

11. **PATCH /auth/change-password**
    - Guard: JwtAuthGuard
    - DTO: ChangePasswordDto
    - Response: 200 OK

12. **GET /auth/sessions**
    - Guard: JwtAuthGuard
    - Response: 200 OK with session list

13. **DELETE /auth/sessions/:id**
    - Guard: JwtAuthGuard
    - Response: 200 OK

---

### **Step 9: Error Handling**

**Use NestJS Exception Filters**:

- `UnauthorizedException` (401): Invalid credentials, token expired
- `ForbiddenException` (403): Account not activated
- `BadRequestException` (400): Validation failed, invalid token
- `ConflictException` (409): Email already registered
- `NotFoundException` (404): User not found

**Error Response Format** (from api-conventions.md):
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    {
      "field": "password",
      "message": "Password must contain uppercase, lowercase, and special character"
    }
  ]
}
```

---

### **Step 10: Password Hashing**

**Use bcrypt with cost factor 10**

**Hashing**:
```typescript
import * as bcrypt from 'bcrypt';

const saltRounds = 10;
const passwordHash = await bcrypt.hash(plainPassword, saltRounds);
```

**Verification**:
```typescript
const isMatch = await bcrypt.compare(plainPassword, storedHash);
```

**NEVER**:
- Log passwords (plain or hashed)
- Return password_hash in API responses
- Use MD5, SHA1, or plain text

---

### **Step 11: JWT Token Generation**

**Access Token**:
```typescript
import { JwtService } from '@nestjs/jwt';

const payload = {
  sub: user.id,
  email: user.email,
  tenant_id: user.tenant_id,
  roles: user.roles.map(r => r.name),
  is_platform_admin: user.is_platform_admin,
};

const accessToken = this.jwtService.sign(payload, {
  secret: process.env.JWT_SECRET,
  expiresIn: '24h',
});
```

**Refresh Token**:
```typescript
const refreshToken = this.jwtService.sign(
  { sub: user.id },
  {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: rememberMe ? '30d' : '7d',
  }
);
```

**Token Hash** (for database storage):
```typescript
import * as crypto from 'crypto';

const tokenHash = crypto
  .createHash('sha256')
  .update(refreshToken)
  .digest('hex');
```

---

### **Step 12: Email Queueing**

**Use BullMQ to queue emails** (don't send synchronously)

**Email Types**:
- Account activation
- Password reset
- Welcome email
- Password changed notification

**Queue Job**:
```typescript
await this.emailQueue.add('send-email', {
  to: user.email,
  template: 'activation',
  data: {
    first_name: user.first_name,
    activation_link: `${process.env.APP_URL}/activate?token=${activationToken}`,
  },
});
```

**Email Service Implementation**: Defer to separate email module

---

### **Step 13: Environment Variables**

**Required in `.env`**:

```
JWT_SECRET=your-very-long-random-secret-here
JWT_REFRESH_SECRET=different-very-long-random-secret-here
APP_URL=https://app.lead360.com
ACTIVATION_TOKEN_EXPIRY=86400000
RESET_TOKEN_EXPIRY=3600000
```

**Generation**:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Testing Requirements

### **Unit Tests (auth.service.spec.ts)**

**Test Coverage >80%**

1. **register()**
   - ✅ Successfully creates user and tenant
   - ✅ Throws ConflictException if email exists
   - ✅ Throws ConflictException if subdomain taken
   - ✅ Hashes password with bcrypt
   - ✅ Sets is_active = false
   - ✅ Generates activation token
   - ✅ Queues activation email

2. **login()**
   - ✅ Returns tokens for valid credentials
   - ✅ Throws UnauthorizedException for invalid password
   - ✅ Throws ForbiddenException if account not activated
   - ✅ Updates last_login_at
   - ✅ Creates refresh token record

3. **refresh()**
   - ✅ Returns new access token
   - ✅ Throws UnauthorizedException for expired token
   - ✅ Throws UnauthorizedException for revoked token

4. **logout()**
   - ✅ Revokes refresh token
   - ✅ Sets revoked_at

5. **logoutAll()**
   - ✅ Revokes all user's refresh tokens
   - ✅ Returns count

6. **forgotPassword()**
   - ✅ Generates reset token for existing user
   - ✅ Queues reset email
   - ✅ Returns success even if email doesn't exist

7. **resetPassword()**
   - ✅ Resets password with valid token
   - ✅ Throws BadRequestException for invalid token
   - ✅ Throws BadRequestException for expired token
   - ✅ Revokes all refresh tokens

8. **activateAccount()**
   - ✅ Activates account with valid token
   - ✅ Sets is_active and email_verified
   - ✅ Throws BadRequestException for invalid token

9. **changePassword()**
   - ✅ Changes password successfully
   - ✅ Throws BadRequestException for incorrect current password
   - ✅ Revokes other sessions

---

### **Integration Tests (auth.controller.spec.ts)**

**Test Coverage >70%**

1. **POST /auth/register**
   - ✅ 201: Valid registration
   - ✅ 400: Invalid email format
   - ✅ 400: Weak password
   - ✅ 409: Email already exists

2. **POST /auth/login**
   - ✅ 200: Valid login
   - ✅ 401: Invalid credentials
   - ✅ 403: Account not activated

3. **POST /auth/refresh**
   - ✅ 200: Valid refresh token
   - ✅ 401: Invalid/expired token

4. **POST /auth/logout**
   - ✅ 200: Success
   - ✅ 401: No auth header

5. **POST /auth/forgot-password**
   - ✅ 200: Always success

6. **POST /auth/reset-password**
   - ✅ 200: Valid token
   - ✅ 400: Invalid token

7. **POST /auth/activate**
   - ✅ 200: Valid token
   - ✅ 400: Invalid token

8. **GET /auth/me**
   - ✅ 200: Returns user profile
   - ✅ 401: No auth

9. **PATCH /auth/me**
   - ✅ 200: Updates profile
   - ✅ 400: Validation error

10. **PATCH /auth/change-password**
    - ✅ 200: Success
    - ✅ 400: Incorrect current password

11. **GET /auth/sessions**
    - ✅ 200: Returns session list
    - ✅ 401: No auth

12. **DELETE /auth/sessions/:id**
    - ✅ 200: Revokes session
    - ✅ 404: Session not found

---

### **Security Tests**

1. **Password Security**
   - ✅ Password never logged
   - ✅ Password never returned in responses
   - ✅ Password stored as bcrypt hash

2. **Token Security**
   - ✅ JWT signature verified
   - ✅ Expired tokens rejected
   - ✅ Refresh token stored as hash

3. **Multi-Tenant Isolation**
   - ✅ User can only access own profile
   - ✅ Email uniqueness enforced per tenant

---

## Audit Logging

**Log These Actions**:
- User registration
- User login (success and failure)
- Password change
- Password reset request
- Password reset completion
- Account activation
- Logout (single and all)
- Profile update

**Use Audit Log Service**:
```typescript
await this.auditLog.create({
  actor_user_id: user.id,
  entity_type: 'user',
  entity_id: user.id,
  action: 'login',
  metadata_json: {
    ip_address: request.ip,
    user_agent: request.headers['user-agent'],
  },
});
```

---

## Swagger Documentation

**Generate API Documentation**

**Use NestJS Swagger decorators**:

```typescript
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  
  @Post('login')
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    // ...
  }
}
```

**Document ALL endpoints with**:
- `@ApiOperation()`
- `@ApiBody()`
- `@ApiResponse()`
- `@ApiBearerAuth()` (for protected routes)

---

## Completion Checklist

**Module is complete when**:

- [ ] Prisma schema created (user, refresh_token)
- [ ] Migration generated and run
- [ ] All DTOs created with validation
- [ ] JWT strategies created (access + refresh)
- [ ] Guards created (JwtAuthGuard, JwtRefreshGuard)
- [ ] Decorators created (CurrentUser, Public)
- [ ] Auth service implemented (all 13 methods)
- [ ] Auth controller implemented (all 13 routes)
- [ ] Error handling implemented
- [ ] Password hashing with bcrypt
- [ ] JWT token generation working
- [ ] Email queueing integrated
- [ ] Environment variables configured
- [ ] Unit tests written (>80% coverage)
- [ ] Integration tests written (>70% coverage)
- [ ] Security tests passing
- [ ] Audit logging implemented
- [ ] Swagger documentation complete (all endpoints)
- [ ] All tests passing (`npm test`)
- [ ] No TypeScript errors (`npm run build`)

---

## Common Pitfalls to Avoid

1. **Don't hash refresh tokens before storage**
   - ❌ Store plain refresh token in database
   - ✅ Store SHA-256 hash of refresh token

2. **Don't forget email normalization**
   - ❌ Store email as-is
   - ✅ Convert to lowercase before storage

3. **Don't skip token expiry checks**
   - ❌ Trust JWT expiry alone
   - ✅ Check database for revoked tokens

4. **Don't return sensitive data**
   - ❌ Return password_hash, tokens in /auth/me
   - ✅ Exclude sensitive fields

5. **Don't hard-code secrets**
   - ❌ JWT_SECRET in code
   - ✅ Use environment variables

6. **Don't forget tenant_id**
   - ❌ Query users without tenant filter
   - ✅ Always filter by tenant_id (except platform admins)

---

## Questions or Blockers?

If you encounter:
- **Unclear requirements**: Re-read feature contract
- **API design questions**: Check api-conventions.md
- **Security questions**: Check security-rules.md
- **Multi-tenant questions**: Check multi-tenant-rules.md
- **Technical blockers**: Document and escalate to Architect agent

**Never make assumptions. Always ask.**

---

**End of Backend Module Documentation**

This module must follow all specifications in the authentication contract.