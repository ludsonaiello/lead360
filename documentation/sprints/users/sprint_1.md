# Sprint 1 — JWT jti + Redis Token Blocklist Infrastructure
**Module:** users
**File:** ./documentation/sprints/users/sprint_1.md
**Type:** Backend — Infrastructure
**Depends On:** NONE
**Gate:** STOP — JWT tokens must carry `jti`; every authenticated request must check Redis blocklist; existing login and refresh must still work. Verify before Sprint 2 starts.
**Estimated Complexity:** Medium

---

## Objective

Add a unique `jti` (JWT ID) field to every access token issued by the platform, then build a Redis-backed token blocklist service that can immediately invalidate a specific token by its `jti`. Update the JWT strategy to reject blocked tokens on every request. This infrastructure is required by the Users module deactivation flow (BR-04, BR-13) and must be in place before any user service is built.

No schema migration. No new module registration in app.module.ts. This sprint only modifies auth and creates a new core service.

---

## Pre-Sprint Checklist
- [ ] Read `/var/www/lead360.app/api/src/modules/auth/auth.service.ts` (full file)
- [ ] Read `/var/www/lead360.app/api/src/modules/auth/strategies/jwt.strategy.ts`
- [ ] Read `/var/www/lead360.app/api/src/modules/auth/guards/jwt-auth.guard.ts`
- [ ] Read `/var/www/lead360.app/api/src/modules/auth/entities/jwt-payload.entity.ts`
- [ ] Read `/var/www/lead360.app/api/src/core/cache/cache.service.ts`
- [ ] Read `/var/www/lead360.app/api/src/core/cache/cache.module.ts`
- [ ] Read `/var/www/lead360.app/api/src/modules/auth/auth.module.ts`
- [ ] Confirm Redis is running: `redis-cli ping` must return `PONG`

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

### Task 1 — Create TokenBlocklistService

**What:** Create a new service at `src/core/token-blocklist/token-blocklist.service.ts` with three methods:

```typescript
// src/core/token-blocklist/token-blocklist.service.ts
import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class TokenBlocklistService {
  private readonly TRACK_PREFIX = 'user_active_token';
  private readonly BLOCK_PREFIX = 'blocked_token';

  constructor(private readonly cache: CacheService) {}

  /**
   * Called at login/refresh: records the user's current active jti so we
   * can block it later on deactivation.
   *
   * @param userId    - user.id
   * @param jti       - UUID jti embedded in the access token
   * @param exp       - Unix timestamp (seconds) when the token expires
   */
  async trackToken(userId: string, jti: string, exp: number): Promise<void> {
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl <= 0) return; // already expired — nothing to track
    await this.cache.set(
      `${this.TRACK_PREFIX}:${userId}`,
      JSON.stringify({ jti, exp }),
      ttl,
    );
  }

  /**
   * Called on user deactivation: reads the user's tracked active token and
   * adds its jti to the blocklist with the remaining TTL.
   *
   * @param userId - user.id of the user being deactivated
   */
  async blockUserTokens(userId: string): Promise<void> {
    const raw = await this.cache.get<string>(`${this.TRACK_PREFIX}:${userId}`);
    if (!raw) return; // user has no active tracked token — nothing to block

    let parsed: { jti: string; exp: number };
    try {
      parsed = JSON.parse(raw as unknown as string);
    } catch {
      return;
    }

    const remaining = parsed.exp - Math.floor(Date.now() / 1000);
    if (remaining <= 0) return; // already expired

    await this.cache.set(
      `${this.BLOCK_PREFIX}:${parsed.jti}`,
      '1',
      remaining,
    );

    // Clean up the tracking key
    await this.cache.del(`${this.TRACK_PREFIX}:${userId}`);
  }

  /**
   * Called on every authenticated request: returns true if the token is blocked.
   *
   * @param jti - UUID jti from the incoming JWT payload
   */
  async isBlocked(jti: string): Promise<boolean> {
    return this.cache.exists(`${this.BLOCK_PREFIX}:${jti}`);
  }
}
```

**Why:** The Users deactivation flow (BR-04) requires immediate JWT invalidation without shortening all token lifetimes. The token blocklist achieves this by storing the `jti` of the deactivated user's token in Redis with a TTL matching the remaining token lifetime.

**Expected output:** `src/core/token-blocklist/token-blocklist.service.ts`

**Acceptance:** Service compiles with no TypeScript errors.

**Do NOT:** Add any database calls. This service is Redis-only.

---

### Task 2 — Create TokenBlocklistModule

**What:** Create `src/core/token-blocklist/token-blocklist.module.ts`:

```typescript
// src/core/token-blocklist/token-blocklist.module.ts
import { Module } from '@nestjs/common';
import { TokenBlocklistService } from './token-blocklist.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  providers: [TokenBlocklistService],
  exports: [TokenBlocklistService],
})
export class TokenBlocklistModule {}
```

**Expected output:** `src/core/token-blocklist/token-blocklist.module.ts`

---

### Task 3 — Update JwtPayload Entity

**What:** Open `src/modules/auth/entities/jwt-payload.entity.ts`. Add `jti` field. Also add `membershipId` field (will be populated in Sprint 3, but declare it now so TypeScript is ready):

The interface/type should be updated to include:
```typescript
jti?: string;          // UUID — required for blocklist; optional during transition
membershipId?: string; // UUID — populated after Sprint 3 auth update
```

If the file exports a `JwtPayload` interface or type, add these two optional fields to it.
If the file also exports an `AuthenticatedUser` interface, add `jti?: string` and `membershipId?: string` to it as well.

**Expected output:** Updated `src/modules/auth/entities/jwt-payload.entity.ts`

**Do NOT:** Change any required field to optional or add other fields not listed here.

---

### Task 4 — Add jti to Token Generation in auth.service.ts

**What:** Open `src/modules/auth/auth.service.ts`.

Add `import { randomUUID } from 'crypto';` to the imports at the top of the file (if not already present).

Inject `TokenBlocklistService` into the constructor:
```typescript
// Add to constructor parameters:
private readonly tokenBlocklist: TokenBlocklistService,
```

Find the private `generateTokens()` method (it contains `this.jwtService.sign(payload, ...)`). This method is at approximately line 972.

**Current payload construction:**
```typescript
const payload: JwtPayload = {
  sub: user.id,
  email: user.email,
  tenant_id: user.tenant_id,
  roles,
  is_platform_admin: user.is_platform_admin,
};
```

**Change it to:**
```typescript
const jti = randomUUID();
const payload: JwtPayload = {
  sub: user.id,
  email: user.email,
  tenant_id: user.tenant_id,
  roles,
  is_platform_admin: user.is_platform_admin,
  jti,
};
```

After signing the accessToken, calculate `exp` and call `trackToken`:
```typescript
const accessToken = this.jwtService.sign(payload, {
  secret: this.configService.get<string>('JWT_SECRET'),
  expiresIn: this.ACCESS_TOKEN_EXPIRY,
});

// Track the active token for potential blocklist use
const expTimestamp = Math.floor(Date.now() / 1000) + 86400; // 24h from now
await this.tokenBlocklist.trackToken(user.id, jti, expTimestamp);
```

**Also find the second location** where `jwtService.sign` is called for refresh token handling (around line 378 — the `/auth/refresh` endpoint flow). Update that payload the same way — add `jti: randomUUID()` and call `trackToken`.

**Expected output:** Updated `auth.service.ts` with jti in every access token signed.

**Acceptance:** After login, decode the returned JWT at jwt.io — it must contain a `jti` field.

**Do NOT:** Modify the refresh token signing (the `{ sub: user.id }` refresh token payload does not get a jti — only access tokens need jti).

---

### Task 5 — Update AuthModule to Import TokenBlocklistModule

**What:** Open `src/modules/auth/auth.module.ts`. Add `TokenBlocklistModule` to the imports array:

```typescript
import { TokenBlocklistModule } from '../../core/token-blocklist/token-blocklist.module';
// Add to @Module imports: TokenBlocklistModule
```

Also add `TokenBlocklistService` to the providers if it is not exported from the module — but since it comes from `TokenBlocklistModule`, just importing the module is sufficient.

**Expected output:** Updated `auth.module.ts`.

---

### Task 6 — Update JwtStrategy to Check Blocklist

**What:** Open `src/modules/auth/strategies/jwt.strategy.ts`.

Inject `TokenBlocklistService`:
```typescript
import { TokenBlocklistService } from '../../../core/token-blocklist/token-blocklist.service';

// Add to constructor parameters:
private readonly tokenBlocklist: TokenBlocklistService,
```

In the `validate()` method, add blocklist check BEFORE the user database lookup:
```typescript
async validate(req: any, payload: JwtPayload): Promise<AuthenticatedUser> {
  // Check token blocklist FIRST — fastest check, avoid DB if blocked
  if (payload.jti) {
    const blocked = await this.tokenBlocklist.isBlocked(payload.jti);
    if (blocked) {
      throw new UnauthorizedException('Token has been revoked.');
    }
  }

  // Existing: verify user still exists and is active
  const user = await this.prisma.user.findFirst({
    where: {
      id: payload.sub,
      is_active: true,
      deleted_at: null,
    },
  });

  if (!user) {
    throw new UnauthorizedException('User not found or inactive');
  }

  const tenant_id = req.tenant_id || payload.tenant_id;

  return {
    id: payload.sub,
    email: payload.email,
    tenant_id: tenant_id,
    roles: payload.roles,
    is_platform_admin: payload.is_platform_admin,
    jti: payload.jti,            // pass through for downstream use
    membershipId: payload.membershipId, // will be set after Sprint 3
  };
}
```

**Why:** BR-13 — JWT guard must check the Redis blocklist on every authenticated request. A blocked `jti` returns HTTP 401 with message `Token has been revoked.`

**Expected output:** Updated `jwt.strategy.ts` with blocklist check before DB lookup.

**Do NOT:** Change the existing `passReqToCallback: true` or any other strategy configuration.

---

## Patterns to Apply

### CacheService (already exists)
```typescript
// src/core/cache/cache.service.ts
// Methods available:
async get<T>(key: string): Promise<T | null>
async set(key: string, value: unknown, ttl?: number): Promise<void>  // ttl in seconds
async del(key: string): Promise<void>
async exists(key: string): Promise<boolean>

// Import path: import { CacheService } from '../../../core/cache/cache.service'
// Module path: import { CacheModule } from '../../../core/cache/cache.module'
```

### JWT Strategy Override Pattern
```typescript
// To inject dependencies into the JWT strategy constructor, the strategy
// must be a NestJS Injectable. The existing strategy already is — just add
// constructor parameters and NestJS DI handles the rest.
```

---

## Business Rules Enforced in This Sprint
- **BR-13:** JWT guard must check the Redis blocklist on every authenticated request before allowing access. Blocked token returns HTTP 401 with message: `Token has been revoked.`
- **BR-04 (partial):** Blocklist infrastructure is prepared for deactivation use in Sprint 6.

---

## Integration Points
| What | Path |
|---|---|
| CacheService | `src/core/cache/cache.service.ts` |
| CacheModule | `src/core/cache/cache.module.ts` |
| JwtStrategy | `src/modules/auth/strategies/jwt.strategy.ts` |
| auth.service.ts | `src/modules/auth/auth.service.ts` |
| JwtPayload entity | `src/modules/auth/entities/jwt-payload.entity.ts` |
| AuthModule | `src/modules/auth/auth.module.ts` |

---

## Acceptance Criteria
- [ ] `POST /api/v1/auth/login` returns a JWT that when decoded contains a `jti` UUID field
- [ ] `POST /api/v1/auth/refresh` returns a new access token that also contains a `jti`
- [ ] Every authenticated request checks Redis for `blocked_token:{jti}` — verify by inserting a test key manually: `redis-cli SET "blocked_token:{jti_from_login}" 1 EX 3600` then make a request with that token and confirm 401 with body `{ message: "Token has been revoked." }`
- [ ] Login and refresh still work normally for non-blocked tokens (200 responses)
- [ ] Server compiles with zero TypeScript errors
- [ ] No frontend code modified
- [ ] Dev server shut down cleanly before marking sprint complete

---

## Gate Marker
**STOP** — Do not start Sprint 2 until:
1. Login returns a JWT with `jti` UUID field confirmed via `jwt.io` decode
2. Manual Redis blocklist test passes (401 on blocked token)
3. Normal login flow still works (200)

---

## Handoff Notes
- `TokenBlocklistService` is available at `src/core/token-blocklist/token-blocklist.service.ts`
- `TokenBlocklistModule` must be imported wherever `TokenBlocklistService` is needed (Sprint 6 Users Service will need it)
- The `trackToken(userId, jti, exp)` method signature: userId = `user.id`, jti = UUID from payload, exp = Unix timestamp in seconds
- The `blockUserTokens(userId)` method will be called from `UsersService.deactivateUser()` in Sprint 6
- The `isBlocked(jti)` method is called from `JwtStrategy.validate()` on every request
