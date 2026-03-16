export interface PortalJwtPayload {
  sub: string; // portal_account.id
  tenant_id: string;
  lead_id: string;
  customer_slug: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedPortalUser {
  portal_account_id: string;
  tenant_id: string;
  lead_id: string;
  customer_slug: string;
}
