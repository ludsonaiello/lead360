export interface JwtPayload {
  sub: string; // user id
  email: string;
  tenant_id: string | null;
  membershipId: string | null; // user_tenant_membership.id — null for platform admins without a membership
  roles: string[];
  is_platform_admin: boolean;
  jti: string; // UUID — required from Sprint 1 for blocklist
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: string; // user id
  token_hash?: string; // for validation against database
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  tenant_id: string | null;
  membershipId: string | null; // null for platform admins without a membership
  roles: string[];
  is_platform_admin: boolean;
  jti?: string;
}
