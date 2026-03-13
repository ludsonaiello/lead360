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

No schema migration. No new module registration in app.module.ts beyond AuthModule. This sprint only modifies auth infrastructure and creates a new core service.

---

## Pre-Sprint Checklist
- [ ] Read `/var/www/lead360.app/api/src/modules/auth/auth.service.ts` (full file)
- [ ] Read `/var/www/lead360.app/api/src/modules/auth/strategies/jwt.strategy.ts`
- [ ] Read `/var/www/lead360.app/api/src/modules/auth/guards/jwt-auth.guard.ts`
- [ ] Read `/var/www/lead360.app/api/src/modules/auth/entities/jwt-payload.entity.ts`
- [ ] Read `/var/www/lead360.app/api/src/core/cache/cache.service.ts` FULLY — the service auto-serializes values with `JSON.stringify` on `set()` and auto-deserializes with `JSON.parse` on `get()`. Always pass raw typed objects to `set()` and use typed generics on `get<T>()`. Never pre-stringify values.
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

**What:** Create `src/core/token-blocklist/token-blocklist.service.ts`.

The `CacheService` auto-serializes with `JSON.stringify` on write and auto-deserializes with `JSON.parse` on read. Pass typed objects directly — never call `JSON.stringify` yourself.

```typescript
// src/core/token-blocklist/token-blocklist.service.ts
import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';

interface ActiveTokenRecord {
  jti: string;
  exp: number; // Unix timestamp in seconds
}

@Injectable()
export class TokenBlocklistService {
  private readonly TRACK_PREFIX = 'user_active_token';
  private readonly BLOCK_PREFIX = 'blocked_token';

  constructor(private readonly cache: CacheService) {}

  /**
   * Called at login/refresh: records the user's current active jti so it can
   * be blocked later on deactivation.
   *
   * @param userId - user.id
   * @param jti    - UUID jti embedded in the access token
   * @param exp    - Unix timestamp (seconds) when the token expires
   */
  async trackToken(userId: string, jti: string, exp: number): Promise<void> {
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl <= 0) return; // already expired — nothing to track
    // CacheService auto-serializes: pass the typed object directly
    const record: ActiveTokenRecord = { jti, exp };
    await this.cache.set(`${this.TRACK_PREFIX}:${userId}`, record, ttl);
  }

  /**
   * Called on user deactivation: reads the user's tracked active token and
   * adds its jti to the blocklist with the remaining TTL.
   *
   * @param userId - user.id of the user being deactivated
   */
  async blockUserTokens(userId: string): Promise<void> {
    // CacheService auto-deserializes: get the typed object directly
    const record = await this.cache.get<ActiveTokenRecord>(`${this.TRACK_PREFIX}:${userId}`);
    if (!record) return; // user has no active tracked token — nothing to block

    const remaining = record.exp - Math.floor(Date.now() / 1000);
    if (remaining <= 0) return; // already expired — token is naturally invalid

    // Store the jti in the blocklist with the remaining lifetime as TTL
    await this.cache.set(`${this.BLOCK_PREFIX}:${record.jti}`, '1', remaining);

    // Clean up the tracking key — user is now deactivated
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

**Do NOT:** Add any database calls. This service is Redis-only. Do NOT call `JSON.stringify` or `JSON.parse` — the CacheService handles that automatically.

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

**What:** Open `src/modules/auth/entities/jwt-payload.entity.ts`.

Add `jti` and `membershipId` as optional fields to both the `JwtPayload` interface and the `AuthenticatedUser` interface. Do not change any existing field.

Add to `JwtPayload`:
```typescript
jti?: string;          // UUID — required for blocklist; optional in Sprint 1 (all tokens get it from Sprint 3 onward)
membershipId?: string; // UUID — populated from Sprint 3 auth update onward
```

Add to `AuthenticatedUser`:
```typescript
jti?: string;
membershipId?: string;
```

**Do NOT** change any required field to optional. Only add these two new optional fields.

---

### Task 4 — Add jti to Token Generation in auth.service.ts

**What:** Open `src/modules/auth/auth.service.ts`.

**Step 1** — Add to imports at the top of the file:
```typescript
import { randomUUID } from 'crypto'; // add randomUUID to the crypto import
import { TokenBlocklistService } from '../../core/token-blocklist/token-blocklist.service';
```

**Step 2** — Add `TokenBlocklistService` to the constructor parameter list:
```typescript
private readonly tokenBlocklist: TokenBlocklistService,
```

**Step 3** — Find the private `generateTokens()` method (it calls `this.jwtService.sign(payload, ...)` for the access token; approximately at line 972). Its current payload:
```typescript
const payload: JwtPayload = {
  sub: user.id,
  email: user.email,
  tenant_id: user.tenant_id,
  roles,
  is_platform_admin: user.is_platform_admin,
};
```

Change it to:
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

After the `accessToken` is signed, track the token in Redis. The `ACCESS_TOKEN_EXPIRY` constant is `'24h'` = 86400 seconds:
```typescript
const accessToken = this.jwtService.sign(payload, { ... });

const expTimestamp = Math.floor(Date.now() / 1000) + 86400; // matches ACCESS_TOKEN_EXPIRY = '24h'
await this.tokenBlocklist.trackToken(user.id, jti, expTimestamp);
```

**Step 4** — Also find the token refresh flow (around line 378 — the `/auth/refresh` endpoint re-signs the access token with an inline payload). Update that payload the same way:
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
// After signing:
const expTimestamp = Math.floor(Date.now() / 1000) + 86400;
await this.tokenBlocklist.trackToken(user.id, jti, expTimestamp);
```

**Do NOT** modify the refresh token signing call (the separate `{ sub: user.id }` payload for the refresh token itself has no jti).

---

### Task 5 — Update AuthModule to Import TokenBlocklistModule

**What:** Open `src/modules/auth/auth.module.ts`. Add to the imports array:

```typescript
import { TokenBlocklistModule } from '../../core/token-blocklist/token-blocklist.module';
// In @Module({ imports: [...] }): add TokenBlocklistModule
```

Since `TokenBlocklistModule` exports `TokenBlocklistService`, it becomes available to all providers within `AuthModule` (including `AuthService` and `JwtStrategy`) via NestJS DI.

---

### Task 6 — Update JwtStrategy to Check Blocklist

**What:** Open `src/modules/auth/strategies/jwt.strategy.ts`.

Add to imports and constructor:
```typescript
import { TokenBlocklistService } from '../../../core/token-blocklist/token-blocklist.service';

// In constructor parameter list, add:
private readonly tokenBlocklist: TokenBlocklistService,
```

In the `validate()` method, add the blocklist check as the **first operation**, before any database lookup:
```typescript
async validate(req: any, payload: JwtPayload): Promise<AuthenticatedUser> {
  // Check token blocklist FIRST — Redis roundtrip avoids unnecessary DB query for blocked tokens
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
    tenant_id,
    roles: payload.roles,
    is_platform_admin: payload.is_platform_admin,
    jti: payload.jti,
    membershipId: payload.membershipId, // undefined until Sprint 3
  };
}
```

**Why:** BR-13 — JWT guard must check the Redis blocklist on every authenticated request. Blocked token → HTTP 401 with message `Token has been revoked.`

**Do NOT** change `passReqToCallback: true` or any other strategy configuration option.

---

## Patterns to Apply

### CacheService Contract
```typescript
// src/core/cache/cache.service.ts — auto-serializes on set(), auto-deserializes on get()
async get<T>(key: string): Promise<T | null>          // returns JSON.parse(stored_value) as T
async set(key: string, value: any, ttlSeconds: number): Promise<void>  // stores JSON.stringify(value)
async del(key: string): Promise<void>
async exists(key: string): Promise<boolean>

// Import path: import { CacheService } from '../cache/cache.service'
// Module path: import { CacheModule } from '../cache/cache.module'
```

---

## Business Rules Enforced in This Sprint
- **BR-13:** JWT guard checks the Redis blocklist on every authenticated request before allowing access. Blocked token → HTTP 401 `Token has been revoked.`
- **BR-04 (partial):** Blocklist infrastructure is in place and ready for use by the deactivation flow in Sprint 6.

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
- [ ] Redis blocklist blocks token correctly: `redis-cli SET "blocked_token:{paste_jti_here}" 1 EX 3600`, then make a request with that JWT → must return 401 with `{ "message": "Token has been revoked." }`
- [ ] Normal (non-blocked) login and refresh flows return 200
- [ ] Server compiles with zero TypeScript errors (`npx tsc --noEmit` in `/api/`)
- [ ] No frontend code modified
- [ ] Dev server shut down cleanly before marking sprint complete

---

## Gate Marker
**STOP** — Do not start Sprint 2 until:
1. Login returns JWT with `jti` UUID field (verified by decoding the token)
2. Manual Redis blocklist test passes (401 returned for blocked jti)
3. Normal login flow returns 200

---

## Handoff Notes
- `TokenBlocklistService` path: `src/core/token-blocklist/token-blocklist.service.ts`
- `TokenBlocklistModule` must be imported in any NestJS module that needs `TokenBlocklistService` — Sprint 6 `UsersModule` will import it
- `trackToken(userId, jti, exp)`: stores `{ jti, exp }` as typed object in Redis (CacheService auto-serializes)
- `blockUserTokens(userId)`: reads typed `ActiveTokenRecord` from Redis, moves jti to blocklist — called by `UsersService.deactivateUser()` in Sprint 6
- `isBlocked(jti)`: checked on every request by `JwtStrategy.validate()`
- The `if (payload.jti)` guard in `validate()` allows pre-Sprint-1 tokens without jti to continue working during transition. From Sprint 3 onward all tokens will carry jti.
