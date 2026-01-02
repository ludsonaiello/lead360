export interface JwtPayload {
  sub: string; // user id
  email: string;
  tenant_id: string | null;
  roles: string[];
  is_platform_admin: boolean;
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
  roles: string[];
  is_platform_admin: boolean;
}
