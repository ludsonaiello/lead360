# Sprint 5 — Users Module DTOs and Validation
**Module:** users
**File:** ./documentation/sprints/users/sprint_5.md
**Type:** Backend — DTOs
**Depends On:** Sprint 4 (schema finalized, user has no tenant_id)
**Gate:** STOP — All DTOs must compile with no TypeScript errors. Verify before Sprint 6.
**Estimated Complexity:** Low

---

## Objective

Create the full DTO layer for the Users module. These are the request and response data transfer objects that define the shape of all API input validation and output serialization. No service or controller logic is written in this sprint — only the DTO files.

All DTOs live in `src/modules/users/dto/`.

---

## Pre-Sprint Checklist
- [ ] Sprint 4 gate verified (user.tenant_id removed, login works)
- [ ] Confirm `class-validator` and `class-transformer` are installed: `cat /var/www/lead360.app/api/package.json | grep class-validator`
- [ ] Confirm the directory `src/modules/users/` does NOT yet exist (this sprint creates it)

---

## Dev Server

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   ← must return nothing before proceeding

START the dev server:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT — the server takes 60 to 120 seconds to compile and become ready.
Do NOT attempt to hit any endpoint until the health check passes:
  curl -s http://localhost:8000/health   ← must return 200 before proceeding

Keep retrying the health check every 10 seconds until it responds.

KEEP the server running for the entire duration of the sprint.
Do NOT stop and restart between tests — keep it open.

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID}
  Confirm port is free: lsof -i :8000   ← must return nothing
```

---

## Tasks

### Task 1 — Create Directory Structure

**What:** Create the module directory structure:
```
src/modules/users/
  dto/
```

No files yet — just the directories.

---

### Task 2 — Create InviteUserDto

**What:** Create `src/modules/users/dto/invite-user.dto.ts`:

```typescript
import { IsEmail, IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class InviteUserDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email: string;

  @ApiProperty({ example: 'a1b2c3d4-...', description: 'UUID of the role to assign' })
  @IsUUID()
  role_id: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  first_name: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  last_name: string;
}
```

---

### Task 3 — Create AcceptInviteDto

**What:** Create `src/modules/users/dto/accept-invite.dto.ts`:

Password rules per contract: minimum 8 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special character.

```typescript
import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptInviteDto {
  @ApiProperty({
    description:
      'Password — min 8 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special character',
    example: 'MyP@ssw0rd',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/, {
    message:
      'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character',
  })
  password: string;
}
```

---

### Task 4 — Create UpdateUserRoleDto

**What:** Create `src/modules/users/dto/update-user-role.dto.ts`:

```typescript
import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserRoleDto {
  @ApiProperty({ description: 'UUID of the new role to assign' })
  @IsUUID()
  role_id: string;
}
```

---

### Task 5 — Create DeactivateUserDto

**What:** Create `src/modules/users/dto/deactivate-user.dto.ts`:

```typescript
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DeactivateUserDto {
  @ApiPropertyOptional({ example: 'User left the company' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
```

---

### Task 6 — Create ListUsersQueryDto

**What:** Create `src/modules/users/dto/list-users-query.dto.ts`:

```typescript
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum MembershipStatusFilter {
  INVITED = 'INVITED',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class ListUsersQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ enum: MembershipStatusFilter })
  @IsOptional()
  @IsEnum(MembershipStatusFilter)
  status?: MembershipStatusFilter;

  @ApiPropertyOptional({ description: 'Filter by role UUID' })
  @IsOptional()
  @IsUUID()
  role_id?: string;
}
```

---

### Task 7 — Create UpdateMeDto

**What:** Create `src/modules/users/dto/update-me.dto.ts`:

```typescript
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  first_name?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  last_name?: string;

  @ApiPropertyOptional({ example: '+1 (555) 555-5555' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatar.jpg' })
  @IsOptional()
  @IsUrl()
  avatar_url?: string;
}
```

---

### Task 8 — Create ChangePasswordDto

**What:** Create `src/modules/users/dto/change-password.dto.ts`:

```typescript
import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password for verification' })
  @IsString()
  @MinLength(1)
  current_password: string;

  @ApiProperty({
    description:
      'New password — min 8 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special character',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/, {
    message:
      'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character',
  })
  new_password: string;
}
```

---

### Task 9 — Create CreateUserAdminDto (Superadmin Direct Creation)

**What:** Create `src/modules/users/dto/create-user-admin.dto.ts`:

Used by `POST /admin/tenants/:tenantId/users` — creates user + membership directly, bypassing invite.

```typescript
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserAdminDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  first_name: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  last_name: string;

  @ApiProperty({ description: 'UUID of the role to assign' })
  @IsUUID()
  role_id: string;

  @ApiProperty({
    description:
      'Initial password — min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/, {
    message:
      'Password must meet complexity requirements',
  })
  password: string;

  @ApiPropertyOptional({ example: '+1 (555) 555-5555' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
```

---

### Task 10 — Create Response DTOs

**What:** Create `src/modules/users/dto/membership-response.dto.ts`:

```typescript
export class RoleDto {
  id: string;
  name: string;
}

export class InvitedByDto {
  id: string;
  first_name: string;
  last_name: string;
}

export class MembershipResponseDto {
  id: string;              // membership UUID
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: RoleDto;
  status: string;          // 'INVITED' | 'ACTIVE' | 'INACTIVE'
  joined_at: string | null;  // ISO datetime
  left_at: string | null;    // ISO datetime
  invited_by: InvitedByDto | null;
  created_at: string;
}

export class PaginatedMembershipsDto {
  data: MembershipResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}
```

Create `src/modules/users/dto/user-me-response.dto.ts`:

```typescript
export class MembershipDetailDto {
  id: string;
  tenant_id: string;
  role: { id: string; name: string };
  status: string;
  joined_at: string | null;
}

export class UserMeResponseDto {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  membership: MembershipDetailDto;
}
```

Create `src/modules/users/dto/invite-token-info.dto.ts`:

```typescript
export class InviteTokenInfoDto {
  tenant_name: string;
  role_name: string;
  invited_by_name: string;
  email: string;
  expires_at: string; // ISO datetime
}
```

Create `src/modules/users/dto/invite-response.dto.ts` (response to POST /users/invite):

```typescript
export class InviteResponseDto {
  id: string;         // membership UUID
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: { id: string; name: string };
  status: string;     // 'INVITED'
  created_at: string;
}
```

Create `src/modules/users/dto/accept-invite-response.dto.ts`:

```typescript
export class AcceptInviteResponseDto {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  tenant: {
    id: string;
    company_name: string;
  };
  role: string;
}
```

---

## Business Rules Enforced in This Sprint
- Password validation (DTOs for AcceptInvite and ChangePassword): min 8 chars, 1 upper, 1 lower, 1 number, 1 special — enforced via `@Matches` regex
- Email normalization: always lowercased and trimmed via `@Transform` in InviteUserDto and CreateUserAdminDto
- Pagination limits: max 100 per page enforced in ListUsersQueryDto

---

## Integration Points
None — this sprint creates pure TypeScript class definitions with class-validator decorators. No Prisma, no external services.

---

## Acceptance Criteria
- [ ] All files in `src/modules/users/dto/` compile with zero TypeScript errors (run `npx tsc --noEmit` in `/api/`)
- [ ] Password regex correctly rejects: `password`, `Password1`, `P@ss` (too short), `MYPASSWORD1!` (no lowercase)
- [ ] Password regex correctly accepts: `MyP@ssw0rd`, `Secure#99x`
- [ ] Dev server starts with no new errors after adding the DTO files (even though the module is not yet registered)
- [ ] No frontend code modified
- [ ] Dev server shut down cleanly before marking sprint complete

---

## Gate Marker
**STOP** — Do not start Sprint 6 until:
1. `npx tsc --noEmit` in `/var/www/lead360.app/api/` returns zero errors
2. Dev server starts and health check passes

---

## Handoff Notes
- DTO file locations for Sprint 6 (service) imports:
  - `InviteUserDto` → `../dto/invite-user.dto`
  - `AcceptInviteDto` → `../dto/accept-invite.dto`
  - `UpdateUserRoleDto` → `../dto/update-user-role.dto`
  - `DeactivateUserDto` → `../dto/deactivate-user.dto`
  - `ListUsersQueryDto` → `../dto/list-users-query.dto`
  - `UpdateMeDto` → `../dto/update-me.dto`
  - `ChangePasswordDto` → `../dto/change-password.dto`
  - `CreateUserAdminDto` → `../dto/create-user-admin.dto`
  - Response DTOs → `../dto/membership-response.dto`, etc.
- The `avatar_url` field is not yet stored in the `user` table schema. If the schema does not have `avatar_url` on `user`, the service (Sprint 6) will need to handle it as a nullable field from the file module, or it can be deferred. Check the user model fields and handle accordingly.
